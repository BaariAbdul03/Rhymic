from flask import Blueprint, request, jsonify, current_app
import os
import uuid
from datetime import timedelta, datetime, timezone
import random
import pyotp
import qrcode
import base64
from io import BytesIO
from sqlalchemy.exc import IntegrityError
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity, get_jwt
from backend.services.email_service import send_recovery_email
import re
from backend.extensions import db, bcrypt, limiter
from backend.models.user import User

auth_bp = Blueprint('auth', __name__)

def is_valid_email(email):
    regex = r'^\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b'
    return re.match(regex, email)

def validate_password(password):
    if len(password) < 8:
        return "Password must be at least 8 characters"
    if not re.search(r'\d', password):
        return "Password must contain at least 1 number"
    return None

def is_valid_username(name):
    return re.match(r'^\w{3,30}$', name)

@auth_bp.route('/signup', methods=['POST'])
@limiter.limit("3 per minute; 10 per hour")
def signup():
    data = request.get_json()
    
    if not data or 'email' not in data or 'password' not in data or 'name' not in data:
        return jsonify({"message": "Missing required fields"}), 400
        
    for key, val in data.items():
        if isinstance(val, str) and len(val) > 255:
            return jsonify({"message": f"Field '{key}' exceeds 255 characters"}), 400
            
    if not is_valid_email(data['email']):
        return jsonify({"message": "Invalid email format"}), 400
        
    if not is_valid_username(data['name']):
        return jsonify({"message": "Username must be 3-30 characters (alphanumeric and underscores only)"}), 400
        
    pwd_err = validate_password(data['password'])
    if pwd_err:
        return jsonify({"error": pwd_err}), 400

    # Pre-check (Fast)
    if User.query.filter_by(email=data['email']).first():
        return jsonify({"message": "Email already registered"}), 400
        
    hashed = bcrypt.generate_password_hash(data['password']).decode('utf-8')
    new_user = User(name=data['name'], email=data['email'], password=hashed)
    
    try:
        db.session.add(new_user)
        db.session.commit()
        return jsonify({"message": "User created successfully"}), 201
    except IntegrityError:
        db.session.rollback() # Undo the stuck transaction
        return jsonify({"message": "Email already registered"}), 400
    except Exception as e:
        db.session.rollback()
        print(f"Signup Error: {e}")
        return jsonify({"message": "Error creating account"}), 500

@auth_bp.route('/login', methods=['POST'])
@limiter.limit("5 per minute; 20 per hour")
def login():
    data = request.get_json()
    
    if not data or 'email' not in data or 'password' not in data:
        return jsonify({"message": "Missing email or password"}), 400
        
    for key, val in data.items():
        if isinstance(val, str) and len(val) > 255:
            return jsonify({"message": f"Field '{key}' exceeds 255 characters"}), 400
            
    user = User.query.filter_by(email=data['email']).first()
    if user and bcrypt.check_password_hash(user.password, data['password']):
        if user.is_two_factor_enabled:
            temp_token = create_access_token(identity=str(user.id), expires_delta=timedelta(minutes=5), additional_claims={"type": "temp_2fa"})
            return jsonify({"2fa_required": True, "temp_token": temp_token}), 200
            
        token = create_access_token(identity=str(user.id), expires_delta=timedelta(hours=24))
        return jsonify({"token": token, "user": user.to_dict()}), 200
        
    return jsonify({"message": "Invalid email or password"}), 401

@auth_bp.route('/forgot-password', methods=['POST'])
@limiter.limit("3 per minute; 10 per hour")
def forgot_password():
    data = request.get_json()
    email = data.get('email')
    if not email:
        return jsonify({"message": "Email is required"}), 400
        
    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"message": "If an account exists, a recovery code has been sent."}), 200
        
    pin = f"{random.randint(0, 999999):06d}"
    user.reset_token = pin
    user.reset_token_expiry = datetime.now(timezone.utc) + timedelta(minutes=15)
    db.session.commit()
    
    send_recovery_email(email, pin)
    
    return jsonify({"message": "If an account exists, a recovery code has been sent."}), 200

@auth_bp.route('/reset-password', methods=['POST'])
@limiter.limit("5 per minute; 20 per hour")
def reset_password():
    data = request.get_json()
    email = data.get('email')
    pin = data.get('pin')
    new_password = data.get('new_password')
    
    if not all([email, pin, new_password]):
        return jsonify({"message": "Missing required fields"}), 400
        
    pwd_err = validate_password(new_password)
    if pwd_err:
        return jsonify({"error": pwd_err}), 400
        
    user = User.query.filter_by(email=email).first()
    if not user or user.reset_token != pin:
        return jsonify({"message": "Invalid email or PIN"}), 400
        
    now = datetime.now(timezone.utc)
    if user.reset_token_expiry and user.reset_token_expiry.tzinfo is None:
        user.reset_token_expiry = user.reset_token_expiry.replace(tzinfo=timezone.utc)
        
    if not user.reset_token_expiry or now > user.reset_token_expiry:
        return jsonify({"message": "The recovery PIN has expired"}), 400
        
    user.password = bcrypt.generate_password_hash(new_password).decode('utf-8')
    user.reset_token = None
    user.reset_token_expiry = None
    db.session.commit()
    
    return jsonify({"message": "Password has been successfully reset"}), 200

@auth_bp.route('/2fa/verify', methods=['POST'])
@jwt_required()
def verify_2fa():
    claims = get_jwt()
    if claims.get("type") != "temp_2fa":
        return jsonify({"message": "Invalid token type for 2FA verification"}), 401
        
    data = request.get_json()
    code = data.get('code')
    if not code:
        return jsonify({"message": "Missing 2FA code"}), 400
        
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user or not user.is_two_factor_enabled:
        return jsonify({"message": "User not found or 2FA not enabled"}), 400
        
    totp = pyotp.TOTP(user.two_factor_secret)
    if totp.verify(code):
        token = create_access_token(identity=str(user.id), expires_delta=timedelta(hours=24))
        return jsonify({"token": token, "user": user.to_dict()}), 200
        
    return jsonify({"message": "Invalid 2FA code"}), 401

@auth_bp.route('/2fa/setup', methods=['POST'])
@jwt_required()
def setup_2fa():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return jsonify({"message": "User not found"}), 404
        
    if user.is_two_factor_enabled:
        return jsonify({"message": "2FA is already enabled"}), 400
        
    secret = pyotp.random_base32()
    totp = pyotp.TOTP(secret)
    uri = totp.provisioning_uri(name=user.email, issuer_name="Rhymic")
    
    # Generate QR Code image data
    qr = qrcode.make(uri)
    img_io = BytesIO()
    qr.save(img_io, 'PNG')
    img_io.seek(0)
    qr_b64 = "data:image/png;base64," + base64.b64encode(img_io.getvalue()).decode()
    
    # Store secret temporarily, waiting for confirmation
    user.two_factor_secret = secret
    db.session.commit()
    
    return jsonify({"secret": secret, "qr_code": qr_b64}), 200

@auth_bp.route('/2fa/enable', methods=['POST'])
@jwt_required()
def enable_2fa():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    data = request.get_json()
    code = data.get('code')
    
    if not user or not user.two_factor_secret:
        return jsonify({"message": "Setup 2FA first"}), 400
        
    totp = pyotp.TOTP(user.two_factor_secret)
    if totp.verify(code):
        user.is_two_factor_enabled = True
        db.session.commit()
        return jsonify({"message": "2FA successfully enabled"}), 200
        
    return jsonify({"message": "Invalid 2FA code"}), 400


@auth_bp.route('/user/me', methods=['GET'])
@jwt_required()
def get_current_user():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user: 
        return jsonify({"message": "User not found"}), 404
        
    return jsonify(user.to_dict())

@auth_bp.route('/user/upload_profile_pic', methods=['POST'])
@jwt_required()
def upload_profile_pic():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user: 
        return jsonify({"message": "User not found"}), 404

    if 'image' not in request.files:
        return jsonify({"message": "No file part"}), 400
    
    file = request.files['image']
    if file.filename == '':
        return jsonify({"message": "No selected file"}), 400

    if file:
        try:
            from backend.services.storage_service import upload_profile_pic as upload_to_supabase
            file_bytes = file.read()
            
            # Try Supabase upload first
            remote_url = upload_to_supabase(file_bytes, file.filename)
            
            if remote_url:
                img_url = remote_url
            else:
                # Reset file pointer for local save
                file.seek(0)
                # Create users directory if it doesn't exist
                users_dir = os.path.join(current_app.config['ASSETS_DIR'], 'users')
                os.makedirs(users_dir, exist_ok=True)
                
                # Generate UUID filename to prevent collisions and path traversal
                ext = os.path.splitext(file.filename)[1]
                if not ext:
                    ext = '.jpg' # fallback
                new_filename = f"{uuid.uuid4().hex}{ext}"
                file_path = os.path.join(users_dir, new_filename)
                
                # Save the file
                file.save(file_path)
                img_url = f"/assets/users/{new_filename}"

            # Update DB
            user.profile_pic = img_url
            db.session.commit()

            return jsonify({"message": "Uploaded successfully", "profile_pic": img_url})
        except Exception as e:
             print(f"Upload Error: {e}")
             return jsonify({"message": "Upload failed"}), 500

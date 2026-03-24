from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
import os
import uuid
from sqlalchemy.exc import IntegrityError
import re
from backend.extensions import db, bcrypt, limiter
from backend.models.user import User

auth_bp = Blueprint('auth', __name__)

def is_valid_email(email):
    # Basic regex validation since email_validator might not be installed yet
    regex = r'^\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b'
    return re.match(regex, email)

@auth_bp.route('/signup', methods=['POST'])
@limiter.limit("5 per minute")
def signup():
    data = request.get_json()
    
    if not data or 'email' not in data or 'password' not in data or 'name' not in data:
        return jsonify({"message": "Missing required fields"}), 400
        
    if not is_valid_email(data['email']):
        return jsonify({"message": "Invalid email format"}), 400
        
    if len(data['password']) < 6:
        return jsonify({"message": "Password must be at least 6 characters long"}), 400

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
@limiter.limit("10 per minute")
def login():
    data = request.get_json()
    
    if not data or 'email' not in data or 'password' not in data:
        return jsonify({"message": "Missing email or password"}), 400
        
    user = User.query.filter_by(email=data['email']).first()
    if user and bcrypt.check_password_hash(user.password, data['password']):
        token = create_access_token(identity=str(user.id))
        return jsonify({"token": token, "user": user.to_dict()}), 200
        
    return jsonify({"message": "Invalid email or password"}), 401

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
            
            # The URL to serve it from
            img_url = f"/assets/users/{new_filename}"

            # Update DB
            user.profile_pic = img_url
            db.session.commit()

            return jsonify({"message": "Uploaded successfully", "profile_pic": img_url})
        except Exception as e:
             print(f"Upload Error: {e}")
             return jsonify({"message": "Upload failed"}), 500

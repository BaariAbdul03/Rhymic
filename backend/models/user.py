from backend.extensions import db

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(60), nullable=False)
    profile_pic = db.Column(db.Text, default=None)  # Will be changed to URL later
    
    reset_token = db.Column(db.String(10), nullable=True)
    reset_token_expiry = db.Column(db.DateTime, nullable=True)
    two_factor_secret = db.Column(db.String(64), nullable=True)
    is_two_factor_enabled = db.Column(db.Boolean, default=False)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "profile_pic": self.profile_pic,
            "is_two_factor_enabled": self.is_two_factor_enabled
        }

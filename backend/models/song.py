from backend.extensions import db

class Song(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(150), nullable=False)
    artist = db.Column(db.String(100), default="Unknown Artist")
    src = db.Column(db.String(300), nullable=False, unique=True)
    cover = db.Column(db.String(300), default="/assets/default_cover.jpg")

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "artist": self.artist,
            "src": self.src,
            "cover": self.cover
        }

class ArtistImage(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    artist_name = db.Column(db.String(100), unique=True, nullable=False)
    image_url = db.Column(db.String(500), nullable=False)
    
    def to_dict(self):
        return {
            "id": self.id,
            "artist_name": self.artist_name,
            "image_url": self.image_url
        }

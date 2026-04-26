from backend.extensions import db

class Song(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(150), nullable=False)
    artist = db.Column(db.String(100), default="Unknown Artist")
    src = db.Column(db.String(300), nullable=False, unique=True)
    cover = db.Column(db.String(300), default="/assets/default_cover.jpg")
    youtube_id = db.Column(db.String(50), unique=True, nullable=True)
    source = db.Column(db.String(20), default="local", nullable=False)

    def to_dict(self):
        return {
            "id": self.youtube_id if self.source == "online" else self.id,
            "title": self.title,
            "artist": self.artist,
            "src": self.src,
            "cover": self.cover,
            "source": self.source,
            "db_id": self.id # Keep the true DB integer ID secretly
        }

    @staticmethod
    def ensure_online_song(song_data):
        from backend.extensions import db
        if not song_data: return None
        if song_data.get('source') != 'online':
            return song_data.get('id')
            
        y_id = str(song_data.get('id'))
        existing = Song.query.filter_by(youtube_id=y_id).first()
        if existing:
            return existing.id
            
        new_song = Song(
            title=song_data.get('title', 'Unknown'),
            artist=song_data.get('artist', 'Unknown'),
            src=song_data.get('src') or f"/api/stream/proxy/{y_id}",
            cover=song_data.get('cover', '/assets/default_cover.jpg'),
            youtube_id=y_id,
            source='online'
        )
        try:
            db.session.add(new_song)
            db.session.commit()
            return new_song.id
        except Exception as e:
            db.session.rollback()
            return None

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

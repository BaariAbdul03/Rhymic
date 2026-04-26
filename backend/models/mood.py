from backend.extensions import db
from datetime import datetime

class SongMood(db.Model):
    __tablename__ = 'song_moods'

    id = db.Column(db.Integer, primary_key=True)
    song_id = db.Column(db.Integer, db.ForeignKey('song.id'), nullable=False, unique=True)
    mood = db.Column(db.String(50), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'song_id': self.song_id,
            'mood': self.mood
        }

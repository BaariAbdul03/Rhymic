import os
from backend.extensions import db
from backend.models.song import Song
from backend.models.playlist import Playlist, PlaylistSong

def scan_library(app):
    """
    Scans the music directory and populates the database with songs and system playlists.
    """
    # Assuming ASSETS_DIR logic or config is available via app.config
    # Need to get ASSETS_DIR from app config or a smart default
    DIST_DIR = os.path.abspath(os.path.join(app.root_path, '..', 'rhymic-react', 'dist'))
    if os.path.exists(DIST_DIR):
        ASSETS_DIR = os.path.join(DIST_DIR, 'assets')
    else:
        ASSETS_DIR = os.path.abspath(os.path.join(app.root_path, '..', 'rhymic-react', 'public', 'assets'))

    music_dir = os.path.join(ASSETS_DIR, 'music')
    if not os.path.exists(music_dir): return

    for root, dirs, files in os.walk(music_dir):
        if root == music_dir: continue
        
        rel_path = os.path.relpath(root, music_dir)
        categories = rel_path.split(os.sep)
        
        folder_cover = "/assets/default_cover.jpg"
        for file in files:
            if file.lower().endswith(('.jpg', '.jpeg', '.png')):
                rel_path_img = os.path.relpath(os.path.join(root, file), os.path.join(ASSETS_DIR, '..'))
                folder_cover = f"/{rel_path_img.replace(os.sep, '/')}"
                break

        for file in files:
            if file.lower().endswith('.mp3'):
                rel_path_file = os.path.relpath(os.path.join(root, file), os.path.join(ASSETS_DIR, '..'))
                web_src = f"/{rel_path_file.replace(os.sep, '/')}"
                
                base_name = os.path.splitext(file)[0]
                clean_title = base_name
                clean_artist = "Unknown Artist"

                if ' - ' in base_name:
                    parts = base_name.split(' - ', 1)
                    clean_artist = parts[0].strip()
                    clean_title = parts[1].strip()

                song = Song.query.filter_by(src=web_src).first()
                
                if not song:
                    web_cover = folder_cover
                    for ext in ['.jpg', '.jpeg', '.png']:
                        if os.path.exists(os.path.join(root, base_name + ext)):
                            rel_c = os.path.relpath(os.path.join(root, base_name + ext), os.path.join(ASSETS_DIR, '..'))
                            web_cover = f"/{rel_c.replace(os.sep, '/')}"
                            break
                    
                    song = Song(title=clean_title, artist=clean_artist, src=web_src, cover=web_cover)
                    db.session.add(song)
                    db.session.commit()

                for category in categories:
                    if not category: continue
                    playlist = Playlist.query.filter_by(name=category, is_system=True).first()
                    if not playlist:
                        playlist = Playlist(name=category, is_system=True, user_id=None)
                        db.session.add(playlist)
                        db.session.commit()
                    
                    link = PlaylistSong.query.filter_by(playlist_id=playlist.id, song_id=song.id).first()
                    if not link:
                        link = PlaylistSong(playlist_id=playlist.id, song_id=song.id)
                        db.session.add(link)
                        db.session.commit()

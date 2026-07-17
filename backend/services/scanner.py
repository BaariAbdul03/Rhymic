import os
import time
from backend.extensions import db
from backend.models.song import Song
from backend.models.playlist import Playlist, PlaylistSong

def scan_library(app):
    """
    Scans the music directory and populates the database with songs and system playlists.
    Optimized for batch operations to prevent N+1 queries and slow startup times.
    """
    DIST_DIR = os.path.abspath(os.path.join(app.root_path, '..', 'rhymic-react', 'dist'))
    if os.path.exists(DIST_DIR):
        ASSETS_DIR = os.path.join(DIST_DIR, 'assets')
    else:
        ASSETS_DIR = os.path.abspath(os.path.join(app.root_path, '..', 'rhymic-react', 'public', 'assets'))

    music_dir = os.path.join(ASSETS_DIR, 'music')
    if not os.path.exists(music_dir):
        print(f"[Scanner] Music directory does not exist: {music_dir}")
        return

    print("[Scanner] Starting library scan...")
    start_time = time.time()

    try:
        # Load existing database records in memory to avoid N+1 queries
        existing_songs = {s.src: s for s in Song.query.all()}
        existing_playlists = {p.name: p for p in Playlist.query.filter_by(is_system=True).all()}
        existing_links = {(link.playlist_id, link.song_id) for link in PlaylistSong.query.all()}
    except Exception as e:
        print(f"[Scanner] Database connection failed during scan startup: {e}. Skipping library scan.")
        return

    songs_to_add = []
    playlists_to_add = []
    links_to_add = []

    # Map to track songs processed in this scan to avoid duplicates in the same run
    scanned_web_srcs = {}

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

                # Get existing song or prepare new
                song = existing_songs.get(web_src)
                if not song:
                    song = scanned_web_srcs.get(web_src)
                    
                if not song:
                    web_cover = folder_cover
                    for ext in ['.jpg', '.jpeg', '.png']:
                        if os.path.exists(os.path.join(root, base_name + ext)):
                            rel_c = os.path.relpath(os.path.join(root, base_name + ext), os.path.join(ASSETS_DIR, '..'))
                            web_cover = f"/{rel_c.replace(os.sep, '/')}"
                            break
                    
                    song = Song(title=clean_title, artist=clean_artist, src=web_src, cover=web_cover)
                    db.session.add(song)
                    songs_to_add.append(song)
                    scanned_web_srcs[web_src] = song

    if songs_to_add:
        try:
            db.session.commit()
            print(f"[Scanner] Scanned and added {len(songs_to_add)} new songs.")
            # Reload existing_songs to get generated IDs for newly added songs
            existing_songs = {s.src: s for s in Song.query.all()}
        except Exception as e:
            db.session.rollback()
            print(f"[Scanner] Failed to commit songs: {e}")
            return

    # Process playlists / categories
    for root, dirs, files in os.walk(music_dir):
        if root == music_dir: continue
        rel_path = os.path.relpath(root, music_dir)
        categories = rel_path.split(os.sep)
        
        for file in files:
            if file.lower().endswith('.mp3'):
                for category in categories:
                    if not category: continue
                    playlist = existing_playlists.get(category)
                    if not playlist:
                        playlist = Playlist(name=category, is_system=True, user_id=None)
                        db.session.add(playlist)
                        playlists_to_add.append(playlist)
                        existing_playlists[category] = playlist

    if playlists_to_add:
        try:
            db.session.commit()
            print(f"[Scanner] Scanned and added {len(playlists_to_add)} new system playlists.")
            # Reload playlists to get generated IDs
            existing_playlists = {p.name: p for p in Playlist.query.filter_by(is_system=True).all()}
        except Exception as e:
            db.session.rollback()
            print(f"[Scanner] Failed to commit playlists: {e}")
            return

    # Process links (PlaylistSong relationships)
    for root, dirs, files in os.walk(music_dir):
        if root == music_dir: continue
        rel_path = os.path.relpath(root, music_dir)
        categories = rel_path.split(os.sep)
        
        for file in files:
            if file.lower().endswith('.mp3'):
                rel_path_file = os.path.relpath(os.path.join(root, file), os.path.join(ASSETS_DIR, '..'))
                web_src = f"/{rel_path_file.replace(os.sep, '/')}"
                song = existing_songs.get(web_src)
                if not song: continue

                for category in categories:
                    if not category: continue
                    playlist = existing_playlists.get(category)
                    if not playlist: continue
                    
                    if (playlist.id, song.id) not in existing_links:
                        link = PlaylistSong(playlist_id=playlist.id, song_id=song.id)
                        db.session.add(link)
                        links_to_add.append(link)
                        existing_links.add((playlist.id, song.id))

    if links_to_add:
        try:
            db.session.commit()
            print(f"[Scanner] Scanned and linked {len(links_to_add)} songs to playlists.")
        except Exception as e:
            db.session.rollback()
            print(f"[Scanner] Failed to commit playlist song links: {e}")
            return

    end_time = time.time()
    print(f"[Scanner] Library scan completed in {end_time - start_time:.3f} seconds.")


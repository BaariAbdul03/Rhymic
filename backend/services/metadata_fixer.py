import os
import time
from backend.extensions import db
from backend.models.song import Song
from backend.services import ai_service


def auto_fix_metadata(app):
    """
    Continuously checks for songs with bad metadata and fixes them in batches.
    Runs in a background thread. Powered by Groq (GPT-OSS).
    """
    if not ai_service.is_configured():
        print("WARNING: GROQ_API_KEY not found. AI metadata fixer will fail.")
        return

    print("Metadata Fixer: Background thread started (Groq).")

    while True:
        with app.app_context():
            # Check for songs with bad metadata
            # Exclude 'Unknown (AI Checked)' to avoid infinite loops on failed files
            messy_songs = Song.query.filter(
                (Song.artist == "Unknown Artist") | (Song.artist == "Unknown")
            ).limit(10).all()

            if not messy_songs:
                print("Metadata Fixer: All songs processed. Sleeping 60s before next check...")
                time.sleep(60)  # Keep thread alive but sleep long
                continue

            print(f"Metadata Fixer: Processing batch of {len(messy_songs)} songs...")

            for song in messy_songs:
                filename = os.path.basename(song.src)

                prompt = (
                    f'Filename: "{filename}"\n'
                    f"Task: Identify 'Artist' and 'Title'.\n"
                    f"Rules: Use your music knowledge. Remove 'official', 'lyrics', 'mp3'.\n"
                    f'Return JSON ONLY: {{"artist": "Name", "title": "Title"}}'
                )

                try:
                    data = ai_service.chat_json(prompt, max_tokens=300, temperature=0.1)
                    if data.get('artist') and data['artist'] != 'Unknown':
                        song.artist = data['artist']
                        song.title = data['title']
                        print(f"   -> Fixed: {song.title} by {song.artist}")
                    else:
                        song.artist = "Unknown (AI Checked)"

                    db.session.commit()
                    time.sleep(2)  # Rate limit

                except Exception as e:
                    print(f"   -> Failed {filename}: {e}")
                    song.artist = "Unknown (AI Checked)"  # Prevent infinite loop
                    db.session.commit()

            time.sleep(5)  # Pause between batches

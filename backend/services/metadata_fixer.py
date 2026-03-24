import os
import time
import json
import re
import google.generativeai as genai
from backend.extensions import db
from backend.models.song import Song

def auto_fix_metadata(app):
    """
    Continuously checks for songs with bad metadata and fixes them in batches.
    Runs in a background thread.
    """
    ai_model_name = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
    api_key = os.environ.get("GOOGLE_API_KEY")
    
    if not api_key:
        print("WARNING: GOOGLE_API_KEY not found. AI metadata fixer will fail.")
        return
        
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(ai_model_name)
    
    print("Metadata Fixer: Background thread started.")
    
    while True:
        with app.app_context():
            # Check for songs with bad metadata
            # Exclude 'Unknown (AI Checked)' to avoid infinite loops on failed files
            messy_songs = Song.query.filter(
                (Song.artist == "Unknown Artist") | (Song.artist == "Unknown")
            ).limit(10).all() 
            
            if not messy_songs:
                print("Metadata Fixer: All songs processed. Sleeping 60s before next check...")
                time.sleep(60) # Keep thread alive but sleep long
                continue

            print(f"Metadata Fixer: Processing batch of {len(messy_songs)} songs...")

            for song in messy_songs:
                filename = os.path.basename(song.src)
                
                ai_prompt = f"""
                Filename: "{filename}"
                Task: Identify 'Artist' and 'Title'.
                Rules: Use your music knowledge. Remove 'official', 'lyrics', 'mp3'.
                Return JSON ONLY: {{"artist": "Name", "title": "Title"}}
                """
                
                try:
                    response = model.generate_content(ai_prompt)
                    clean_text = response.text.replace("```json", "").replace("```", "").strip()
                    match = re.search(r'\{.*\}', clean_text, re.DOTALL)
                    
                    if match:
                        data = json.loads(match.group(0))
                        if data.get('artist') and data['artist'] != 'Unknown':
                            song.artist = data['artist']
                            song.title = data['title']
                            print(f"   -> Fixed: {song.title} by {song.artist}")
                        else:
                             song.artist = "Unknown (AI Checked)"
                    else:
                        song.artist = "Unknown (AI Checked)"
                    
                    db.session.commit()
                    time.sleep(2) # Rate limit
                    
                except Exception as e:
                    print(f"   -> Failed {filename}: {e}")
                    song.artist = "Unknown (AI Checked)" # Prevent infinite loop
                    db.session.commit()
            
            time.sleep(5) # Pause between batches

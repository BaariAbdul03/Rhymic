import requests
from backend.extensions import db
from backend.models.song import ArtistImage

def get_artist_image(artist_name):
    """
    Checks DB for cached image. If missing, fetches from Deezer API and saves it.
    """
    # 1. Check Cache
    cached = ArtistImage.query.filter_by(artist_name=artist_name).first()
    if cached:
        return cached.image_url
    
    # 2. Fetch from Deezer
    try:
        # Search for the artist
        response = requests.get(f'https://api.deezer.com/search/artist?q={artist_name}')
        data = response.json()
        
        if data and 'data' in data and len(data['data']) > 0:
            # Get the first result's XL picture
            image_url = data['data'][0].get('picture_xl') or data['data'][0].get('picture_medium')
            
            if image_url:
                # 3. Save to Cache
                new_entry = ArtistImage(artist_name=artist_name, image_url=image_url)
                db.session.add(new_entry)
                db.session.commit()
                return image_url
                
    except Exception as e:
        print(f"Deezer API Error: {e}")
    
    # 4. Fallback (Use local default if online fetch fails)
    return '/assets/default_cover.jpg'

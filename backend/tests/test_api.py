def test_signup(client):
    response = client.post('/api/signup', json={
        'name': 'NewUser',
        'email': 'new@example.com',
        'password': 'securepassword1'
    })
    assert response.status_code == 201
    assert response.json['message'] == 'User created successfully'

def test_login(client):
    client.post('/api/signup', json={
        'name': 'LoginUser',
        'email': 'login@example.com',
        'password': 'password123'
    })
    
    response = client.post('/api/login', json={
        'email': 'login@example.com',
        'password': 'password123'
    })
    assert response.status_code == 200
    assert 'token' in response.json
    assert response.json['user']['email'] == 'login@example.com'

def test_get_songs_public(client):
    response = client.get('/api/songs/')
    assert response.status_code == 401

def test_get_songs_authorized(client, auth_headers):
    response = client.get('/api/songs/', headers=auth_headers)
    assert response.status_code == 200
    assert isinstance(response.json, list)

def test_create_playlist(client, auth_headers):
    response = client.post('/api/playlists/', headers=auth_headers, json={
        'name': 'My Chill Playlist'
    })
    assert response.status_code == 201
    assert response.json['name'] == 'My Chill Playlist'

def test_stream_status(client, auth_headers):
    response = client.get('/api/stream/status', headers=auth_headers)
    assert response.status_code == 200
    assert 'mode' in response.json


def test_legacy_cover_url_redirects_to_sized_cdn_image(client):
    response = client.get('/api/stream/thumbnail', query_string={
        'url': 'https://yt3.googleusercontent.com/example=s0',
    })
    assert response.status_code == 302
    assert response.location == 'https://yt3.googleusercontent.com/example=s512'
    assert client.get('/api/stream/thumbnail', query_string={
        'url': 'https://example.com/cover.jpg',
    }).status_code == 404


def test_fingerprinted_css_cache_and_missing_asset(app, client, tmp_path):
    (tmp_path / 'index-AbCd1234.css').write_text('main { color: black; }')
    app.config['ASSETS_DIR'] = str(tmp_path)
    css = client.get('/assets/index-AbCd1234.css')
    assert css.status_code == 200
    assert css.mimetype == 'text/css'
    assert css.cache_control.immutable
    missing = client.get('/assets/index-AbCd5678.css')
    assert missing.status_code == 404
    assert missing.mimetype == 'text/plain'


def test_ai_mood_uses_metadata_for_an_online_track(client, auth_headers, monkeypatch):
    from backend.services import ai_service

    monkeypatch.setattr(ai_service, 'is_configured', lambda: True)
    monkeypatch.setattr(ai_service, 'chat', lambda *args, **kwargs: 'Romantic')
    response = client.get('/api/mood/12345678901', query_string={
        'title': 'Rehbara', 'artist': 'Abhijeet Srivastava',
    }, headers=auth_headers)
    assert response.status_code == 200
    assert response.json['mood'] == 'Romantic'


def test_smart_dj_falls_back_to_bundled_songs(client, auth_headers, monkeypatch):
    monkeypatch.delenv('GROQ_API_KEY', raising=False)
    response = client.post('/api/ai/recommend', json={'prompt': 'Alan Walker'}, headers=auth_headers)
    assert response.status_code == 200
    assert response.json['source'] == 'local'
    assert response.json['songs']
    assert all(song['source'] == 'local' for song in response.json['songs'])


def test_bundled_audio_supports_ranges_and_uploaded_audio(app, client, auth_headers):
    from pathlib import Path
    from urllib.parse import quote

    songs = client.get('/api/songs/', headers=auth_headers).json
    tracks = [song for song in songs if song['source'] == 'local']
    assert len(tracks) == len(list(Path(app.config['ASSETS_DIR']).glob('music/**/*.mp3')))
    assert tracks
    for song in tracks:
        response = client.get(quote(song['src']), headers={'Range': 'bytes=0-127'})
        assert response.status_code == 206
        assert response.mimetype == 'audio/mpeg'
        assert len(response.data) == 128
        assert "blob:" in response.headers['Content-Security-Policy']
        assert "frame-src https://www.youtube.com" in response.headers['Content-Security-Policy']


def test_2fa_challenge_cannot_access_library(app, client, auth_headers):
    import pyotp
    from backend.extensions import db
    from backend.models.user import User

    with app.app_context():
        user = User.query.filter_by(email='test@example.com').one()
        secret = pyotp.random_base32()
        user.two_factor_secret = secret
        user.is_two_factor_enabled = True
        db.session.commit()

    challenge = client.post('/api/login', json={'email': 'test@example.com', 'password': 'password123'})
    assert challenge.json['2fa_required']
    pending = {'Authorization': f"Bearer {challenge.json['temp_token']}"}
    assert client.get('/api/songs/', headers=pending).status_code in (401, 422)
    completed = client.post('/api/2fa/verify', headers=pending, json={'code': pyotp.TOTP(secret).now()})
    assert completed.status_code == 200
    access = {'Authorization': f"Bearer {completed.json['token']}"}
    assert client.get('/api/songs/', headers=access).status_code == 200

def test_login_remember_me(client):
    from flask_jwt_extended import decode_token
    from backend import create_app
    
    client.post('/api/signup', json={
        'name': 'RememberUser',
        'email': 'remember@example.com',
        'password': 'password123'
    })
    
    # Login without Remember Me
    response = client.post('/api/login', json={
        'email': 'remember@example.com',
        'password': 'password123'
    })
    assert response.status_code == 200
    token = response.json['token']
    
    # Login with Remember Me
    response_rm = client.post('/api/login', json={
        'email': 'remember@example.com',
        'password': 'password123',
        'rememberMe': True
    })
    assert response_rm.status_code == 200
    token_rm = response_rm.json['token']
    
    app = create_app()
    with app.app_context():
        decoded = decode_token(token)
        decoded_rm = decode_token(token_rm)
        diff = decoded_rm['exp'] - decoded['exp']
        assert diff > 28 * 24 * 3600 # Greater than 28 days difference

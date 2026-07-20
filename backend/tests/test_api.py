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

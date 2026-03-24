import json

def test_signup(client):
    response = client.post('/api/auth/signup', json={
        'name': 'New User',
        'email': 'new@example.com',
        'password': 'securepassword'
    })
    assert response.status_code == 201
    assert 'access_token' in response.json

def test_login(client):
    # Relies on data created in conftest auth_headers if we want, but let's test isolation
    client.post('/api/auth/signup', json={
        'name': 'Login User',
        'email': 'login@example.com',
        'password': 'password123'
    })
    
    response = client.post('/api/auth/login', json={
        'email': 'login@example.com',
        'password': 'password123'
    })
    assert response.status_code == 200
    assert 'access_token' in response.json
    assert response.json['user']['email'] == 'login@example.com'

def test_get_songs_unauthorized(client):
    response = client.get('/api/songs/')
    assert response.status_code == 401

def test_get_songs_authorized(client, auth_headers):
    response = client.get('/api/songs/', headers=auth_headers)
    assert response.status_code == 200
    assert 'songs' in response.json
    assert 'total' in response.json

def test_create_playlist(client, auth_headers):
    response = client.post('/api/playlists/', headers=auth_headers, json={
        'name': 'My Chill Playlist'
    })
    assert response.status_code == 201
    assert response.json['message'] == 'Playlist created successfully'
    assert response.json['playlist']['name'] == 'My Chill Playlist'

def test_ai_recommend_fallback(client, auth_headers):
    # Without valid google api key, it should fallback to random songs
    response = client.get('/api/ai/recommend?mood=happy', headers=auth_headers)
    assert response.status_code == 200
    assert 'recommendations' in response.json

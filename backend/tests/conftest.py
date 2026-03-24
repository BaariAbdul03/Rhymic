import pytest
from backend import create_app
from backend.extensions import db
from backend.models.user import User
from backend.models.song import Song

@pytest.fixture
def app():
    app = create_app('test')
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()

@pytest.fixture
def client(app):
    return app.test_client()

@pytest.fixture
def runner(app):
    return app.test_cli_runner()

@pytest.fixture
def auth_headers(client, app):
    with app.app_context():
        user = User(name='Test User', email='test@example.com')
        user.set_password('password123')
        db.session.add(user)
        db.session.commit()
        
        response = client.post('/api/auth/login', json={
            'email': 'test@example.com',
            'password': 'password123'
        })
        token = response.json['access_token']
        return {'Authorization': f'Bearer {token}'}

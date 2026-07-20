import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '30s', target: 20 },  // Ramp up
    { duration: '1m', target: 20 },   // Stay at load
    { duration: '30s', target: 50 },  // Spike
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% requests under 500ms
    errors: ['rate<0.1'],               // Error rate under 10%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';

export default function () {
  // Health check
  const health = http.get(`${BASE_URL}/api/health`);
  check(health, { 'health status 200': (r) => r.status === 200 });
  errorRate.add(health.status !== 200);

  // Public endpoints
  const songs = http.get(`${BASE_URL}/api/songs/`);
  check(songs, { 'songs list 200': (r) => r.status === 200 });
  errorRate.add(songs.status !== 200);

  const trending = http.get(`${BASE_URL}/api/stream/trending`);
  check(trending, { 'trending 200': (r) => r.status === 200 });
  errorRate.add(trending.status !== 200);

  // Auth flow (register + login)
  const email = `loadtest_${__VU}_${Date.now()}@example.com`;
  
  const register = http.post(`${BASE_URL}/api/signup`, 
    JSON.stringify({ name: `user_${__VU}`, email, password: 'test1234' }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  check(register, { 'register 201 or 400': (r) => r.status === 201 || r.status === 400 });
  
  const login = http.post(`${BASE_URL}/api/login`,
    JSON.stringify({ email, password: 'test1234' }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  
  if (login.status === 200) {
    const token = login.json('token');
    
    // Authenticated requests
    const playlists = http.get(`${BASE_URL}/api/playlists/`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    check(playlists, { 'playlists 200': (r) => r.status === 200 });
    errorRate.add(playlists.status !== 200);
    
    const me = http.get(`${BASE_URL}/api/user/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    check(me, { 'me 200': (r) => r.status === 200 });
    errorRate.add(me.status !== 200);
  }

  sleep(1);
}
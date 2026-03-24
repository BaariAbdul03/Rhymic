import axios from 'axios';

const api = axios.create({
  baseURL: '/api' // Proxy handles routing to :5000 in dev
});

// Request interceptor to add the auth token when available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle global errors (like 401 Unauthorized)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // We don't automatically logout here unless we emit an event or call store method,
    // which can be done from the store itself using this API instance.
    return Promise.reject(error);
  }
);

// --- API Methods ---

export const authApi = {
  login: (email, password) => api.post('/login', { email, password }),
  signup: (name, email, password) => api.post('/signup', { name, email, password }),
  getMe: () => api.get('/user/me'),
  uploadProfilePic: (formData) => api.post('/user/upload_profile_pic', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
};

export const songsApi = {
  getAll: (page = 1, limit = 100) => api.get(`/songs/?page=${page}&limit=${limit}`),
  getOne: (id) => api.get(`/songs/${id}`)
};

export const playlistsApi = {
  getAll: () => api.get('/playlists/'),
  getOne: (id) => api.get(`/playlists/${id}`),
  create: (name) => api.post('/playlists/', { name }),
  addSong: (playlistId, songId) => api.post('/playlists/add_song', { playlist_id: playlistId, song_id: songId })
};

export const likesApi = {
  getAll: () => api.get('/likes/'),
  toggleLike: (songId) => api.post('/likes/', { song_id: songId })
};

export const smartDjApi = {
  recommend: (prompt) => api.post('/ai/recommend', { prompt })
};

export default api;
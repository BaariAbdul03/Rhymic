import axios from 'axios';

const api = axios.create({
  baseURL: '/api' // Proxy handles routing to :5000 in dev
});

// Request interceptor to add the auth token when available
api.interceptors.request.use(
  (config) => {
    try {
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // localStorage not available (e.g., in test environment)
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let logoutCallback = null;
export const setLogoutCallback = (cb) => {
  logoutCallback = cb;
};

// Response interceptor to handle global errors (like 401 Unauthorized)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (logoutCallback) {
        logoutCallback();
      } else {
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
          }
        } catch {
          // localStorage not available
        }
        if (typeof window !== 'undefined') {
          window.location.href = '/landing';
        }
      }
    }
    return Promise.reject(error);
  }
);

// --- API Methods ---

export const authApi = {
  login: (email, password, rememberMe) => api.post('/login', { email, password, rememberMe }),
  signup: (name, email, password) => api.post('/signup', { name, email, password }),
  getMe: () => api.get('/user/me'),
  uploadProfilePic: (formData) => api.post('/user/upload_profile_pic', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  forgotPassword: (email) => api.post('/forgot-password', { email }),
  resetPassword: (email, pin, new_password) => api.post('/reset-password', { email, pin, new_password }),
  verify2FA: (code, tempToken, rememberMe) => api.post('/2fa/verify', { code, rememberMe }, {
    headers: { Authorization: `Bearer ${tempToken}` }
  }),
  setup2FA: () => api.post('/2fa/setup'),
  enable2FA: (code) => api.post('/2fa/enable', { code }),
  updateProfile: (data) => api.patch('/user/update', data),
  changePassword: (old_password, new_password) => api.post('/user/change-password', { old_password, new_password })
};

export const songsApi = {
  getAll: (page = 1, limit = 100) => api.get(`/songs/?page=${page}&limit=${limit}`),
  getOne: (id) => api.get(`/songs/${id}`)
};

export const playlistsApi = {
  getAll: () => api.get('/playlists/'),
  getOne: (id) => api.get(`/playlists/${id}`),
  create: (name) => api.post('/playlists/', { name }),
  addSong: (playlistId, song) => api.post('/playlists/add_song', { playlist_id: playlistId, song }),
  delete: (id) => api.delete(`/playlists/${id}`),
  rename: (id, name) => api.patch(`/playlists/${id}`, { name })
};

export const likesApi = {
  getAll: () => api.get('/likes/'),
  toggleLike: (song) => api.post('/likes/', { song })
};

export const smartDjApi = {
  recommend: (prompt, regenerate = false) => api.post('/ai/recommend', { prompt, regenerate })
};

export const moodApi = {
  getSongMood: (songId, title, artist) => {
    let url = `/mood/${songId}`;
    if (title && artist) {
      url += `?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`;
    }
    return api.get(url);
  }
};

export const streamApi = {
  status: () => api.get('/stream/status'),
  search: (query) => api.get(`/stream/search?q=${encodeURIComponent(query)}`),
  getAudioUrl: (videoId) => api.get(`/stream/audio/${videoId}`),
  getTrending: () => api.get('/stream/trending'),
  getRelated: (videoId) => api.get(`/stream/related/${videoId}`),
  getCategories: (names, limit = 10) => api.get(
    `/stream/categories?names=${encodeURIComponent(names.join(','))}&limit=${limit}`
  ),
};

export default api;

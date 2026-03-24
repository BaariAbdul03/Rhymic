import { create } from 'zustand';
import { authApi } from '../services/api';

export const useAuthStore = create((set, get) => ({
  user: JSON.parse(localStorage.getItem('user')) || null,
  token: localStorage.getItem('token') || null,
  error: null,

  login: async (email, password) => {
    set({ error: null });
    try {
      const response = await authApi.login(email, password);
      const data = response.data;

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      set({ user: data.user, token: data.token });
      return true;
    } catch (err) {
      set({ error: err.response?.data?.message || 'Login failed.' });
      return false;
    }
  },

  signup: async (name, email, password) => {
    set({ error: null });
    try {
      await authApi.signup(name, email, password);
      return true;
    } catch (err) {
      set({ error: err.response?.data?.message || 'Signup failed.' });
      return false;
    }
  },

  fetchUser: async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const response = await authApi.getMe();
      if (response.data) {
        localStorage.setItem('user', JSON.stringify(response.data));
        set({ user: response.data });
      }
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 404) {
        get().logout();
      }
      console.error("Failed to fetch user", error);
    }
  },

  uploadProfilePic: async (file) => {
    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await authApi.uploadProfilePic(formData);
      if (response.data?.profile_pic) {
        set((state) => {
          const newUser = { ...state.user, profile_pic: response.data.profile_pic };
          localStorage.setItem('user', JSON.stringify(newUser));
          return { user: newUser };
        });
        return true;
      }
    } catch (error) {
      console.error("Upload failed", error);
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ user: null, token: null });
  }
}));
// src/store/authStore.js
import { create } from 'zustand';

export const useAuthStore = create((set, get) => ({
  user: JSON.parse(localStorage.getItem('user')) || null,
  token: localStorage.getItem('token') || null,
  error: null,

  login: async (email, password) => {
    set({ error: null });
    try {
      const response = await fetch('/api/login', { // Use relative path
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed due to an unknown error.');
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      set({ user: data.user, token: data.token });
      return true;
    } catch (err) {
      set({ error: err.message });
      return false;
    }
  },

  signup: async (name, email, password) => {
    set({ error: null });
    try {
      const response = await fetch('/api/signup', { // Use relative path
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Signup failed due to an unknown error.');
      }
      return true;
    } catch (err) {
      set({ error: err.message });
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ user: null, token: null });
  },

  updateAvatar: async (file) => {
    const token = get().token;
    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch('http://127.0.0.1:5000/api/upload_avatar', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      
      const data = await response.json();
      if (response.ok) {
        // Update local user state with new image
        const updatedUser = { ...get().user, profile_pic: data.url };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        set({ user: updatedUser });
        return true;
      }
    } catch (error) {
      console.error("Upload failed", error);
    }
    return false;
  }
}));
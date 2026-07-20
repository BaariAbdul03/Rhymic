import { create } from 'zustand';
import { authApi, setLogoutCallback } from '../services/api';

export const useAuthStore = create((set, get) => ({
  user: JSON.parse(localStorage.getItem('user')) || null,
  token: localStorage.getItem('token') || null,
  tempToken: null,
  error: null,

  login: async (email, password, rememberMe = false) => {
    set({ error: null });
    try {
      const response = await authApi.login(email, password, rememberMe);
      const data = response.data;

      if (data['2fa_required']) {
        set({ tempToken: data.temp_token });
        return '2fa_required';
      }

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

  forgotPassword: async (email) => {
    set({ error: null });
    try {
      const response = await authApi.forgotPassword(email);
      return response.data;
    } catch (err) {
      set({ error: err.response?.data?.message || 'Failed to request reset.' });
      return false;
    }
  },

  resetPassword: async (email, pin, newPassword) => {
    set({ error: null });
    try {
      const response = await authApi.resetPassword(email, pin, newPassword);
      return response.data;
    } catch (err) {
      set({ error: err.response?.data?.message || 'Failed to reset password.' });
      return false;
    }
  },

  verify2FA: async (code, rememberMe = false) => {
    set({ error: null });
    try {
      const tempToken = get().tempToken;
      const response = await authApi.verify2FA(code, tempToken, rememberMe);
      const data = response.data;
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      set({ user: data.user, token: data.token, tempToken: null });
      return true;
    } catch (err) {
      set({ error: err.response?.data?.message || 'Invalid 2FA code.' });
      return false;
    }
  },

  setup2FA: async () => {
    set({ error: null });
    try {
      const response = await authApi.setup2FA();
      return response.data; // { secret, qr_code }
    } catch (err) {
      set({ error: err.response?.data?.message || 'Failed to setup 2FA.' });
      return null;
    }
  },

  enable2FA: async (code) => {
    set({ error: null });
    try {
      await authApi.enable2FA(code);
      // Update local user state
      set((state) => {
        if (!state.user) return state;
        const newUser = { ...state.user, is_two_factor_enabled: true };
        localStorage.setItem('user', JSON.stringify(newUser));
        return { user: newUser };
      });
      return true;
    } catch (err) {
      set({ error: err.response?.data?.message || 'Invalid 2FA code.' });
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

  updateProfile: async (data) => {
    set({ error: null });
    try {
      const response = await authApi.updateProfile(data);
      if (response.data?.user) {
        set({ user: response.data.user });
        localStorage.setItem('user', JSON.stringify(response.data.user));
        return true;
      }
    } catch (err) {
      set({ error: err.response?.data?.message || 'Update failed.' });
      return false;
    }
  },

  changePassword: async (oldPassword, newPassword) => {
    set({ error: null });
    try {
      await authApi.changePassword(oldPassword, newPassword);
      return true;
    } catch (err) {
      set({ error: err.response?.data?.message || err.response?.data?.error || 'Password change failed.' });
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ user: null, token: null });
  }
}));

setLogoutCallback(() => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  useAuthStore.setState({ user: null, token: null });
});
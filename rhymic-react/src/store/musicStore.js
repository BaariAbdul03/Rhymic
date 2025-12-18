// src/store/musicStore.js
import { create } from 'zustand';
import { useAuthStore } from './authStore'; // Import auth store

// Helper function to handle API responses
const handleResponse = async (response) => {
  if (response.status === 401) {
    // Token is invalid or expired
    useAuthStore.getState().logout(); // Use logout action
    throw new Error('Unauthorized: Please log in again.');
  }
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'An unknown error occurred.' }));
    throw new Error(errorData.message || `Request failed: ${response.status}`);
  }
  return response;
};

export const useMusicStore = create((set, get) => ({
  // ... (State) ...
  songs: [],
  currentSong: null,
  likedSongs: [],
  playlists: [],
  currentPlaylist: null,
  volume: 1,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  audioElement: null,
  shuffle: false,
  repeat: false,
  error: null,

  // --- ACTIONS ---

  clearError: () => set({ error: null }),

  fetchSongs: async () => {
    set({ error: null });
    try {
      const response = await fetch('/api/songs'); // Use relative path
      if (!response.ok) throw new Error('Failed to fetch songs.');
      const data = await response.json();
      set({ songs: data });
    } catch (error) {
      set({ error: error.message });
    }
  },

  fetchLikedSongs: async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    set({ error: null });
    try {
      const response = await fetch('/api/likes', { // Use relative path
        headers: { 'Authorization': `Bearer ${token}` }
      });
      await handleResponse(response);
      const likedIds = await response.json();
      set({ likedSongs: likedIds });
    } catch (error) {
      set({ error: error.message });
    }
  },

  toggleLike: async (songId) => {
    const token = localStorage.getItem('token');
    if (!token) {
      set({ error: "Please log in to like songs." });
      return;
    }
    
    const { likedSongs } = get();
    const isLiked = likedSongs.includes(songId);
    const newLikes = isLiked ? likedSongs.filter(id => id !== songId) : [...likedSongs, songId];
    set({ likedSongs: newLikes, error: null });

    try {
      const response = await fetch('/api/likes', { // Use relative path
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ song_id: songId })
      });
      await handleResponse(response);
    } catch (error) {
      set({ error: `Like sync error: ${error.message}`, likedSongs }); // Revert on error
    }
  },

  fetchPlaylists: async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    set({ error: null });
    try {
      const response = await fetch('/api/playlists', { // Use relative path
        headers: { 'Authorization': `Bearer ${token}` }
      });
      await handleResponse(response);
      const data = await response.json();
      set({ playlists: data });
    } catch (error) {
      set({ error: error.message });
    }
  },

  createPlaylist: async (name) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    set({ error: null });
    try {
      const response = await fetch('/api/playlists', { // Use relative path
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name })
      });
      await handleResponse(response);
      const newPlaylist = await response.json();
      set((state) => ({ playlists: [...state.playlists, newPlaylist] }));
      return true; // Success
    } catch (error) {
      set({ error: `Create playlist error: ${error.message}` });
      return false; // Fail
    }
  },

  addSongToPlaylist: async (playlistId, songId) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    set({ error: null });
    try {
      const response = await fetch('/api/playlists/add_song', { // Use relative path
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ playlist_id: playlistId, song_id: songId })
      });
      await handleResponse(response);
      return true;
    } catch (error) {
      set({ error: `Failed to add song: ${error.message}` });
      return false;
    }
  },

  fetchPlaylistDetails: async (playlistId) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    
    set({ currentPlaylist: null, error: null });

    try {
      const response = await fetch(`/api/playlists/${playlistId}`, { // Use relative path
        headers: { 'Authorization': `Bearer ${token}` }
      });
      await handleResponse(response);
      const data = await response.json();
      set({ currentPlaylist: data });
    } catch (error) {
      set({ error: `Failed to fetch playlist details: ${error.message}` });
    }
  },

  // ... (Player Controls) ...
  setSongs: (songs) => set({ songs: songs }),
  setAudioElement: (audio) => set({ audioElement: audio }),
  setCurrentSong: (song) => set({ currentSong: song, isPlaying: true, currentTime: 0 }),
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (time) => set({ duration: time }),
  seek: (time) => { const { audioElement } = get(); if (audioElement) audioElement.currentTime = time; set({ currentTime: time }); },
  toggleShuffle: () => set((state) => ({ shuffle: !state.shuffle })),
  toggleRepeat: () => set((state) => { const newRepeat = !state.repeat; if (get().audioElement) get().audioElement.loop = newRepeat; return { repeat: newRepeat }; }),
  nextSong: () => { const { songs, currentSong, shuffle } = get();
    if (!currentSong || songs.length === 0) return;
    let nextIndex;
    if (shuffle) {
      do { nextIndex = Math.floor(Math.random() * songs.length); } while (songs.length > 1 && songs[nextIndex].id === currentSong.id);
    } else {
      const currentIndex = songs.findIndex(s => s.id === currentSong.id);
      nextIndex = (currentIndex + 1) % songs.length;
    }
    set({ currentSong: songs[nextIndex], isPlaying: true, currentTime: 0 });
  },
  prevSong: () => { const { songs, currentSong, shuffle } = get();
    if (!currentSong || songs.length === 0) return;
    let prevIndex;
    if (shuffle) {
      do { prevIndex = Math.floor(Math.random() * songs.length); } while (songs.length > 1 && songs[prevIndex].id === currentSong.id);
    } else {
      const currentIndex = songs.findIndex(s => s.id === currentSong.id);
      prevIndex = (currentIndex - 1 + songs.length) % songs.length;
    }
    set({ currentSong: songs[prevIndex], isPlaying: true, currentTime: 0 });
  },
  setVolume: (volume) => { set({ volume: volume }); const { audioElement } = get(); if (audioElement) audioElement.volume = volume; },
}));
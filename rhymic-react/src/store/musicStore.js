import { create } from 'zustand';
import { useAuthStore } from './authStore';
import { songsApi, playlistsApi, likesApi } from '../services/api';

export const useMusicStore = create((set, get) => ({
  songs: [],
  currentSong: null,
  likedSongs: [],
  playlists: [],
  currentPlaylist: null,
  queue: [], // Explicit queue array
  volume: 1,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  audioElement: null,
  shuffle: false,
  repeat: false,
  error: null,

  clearError: () => set({ error: null }),

  fetchSongs: async () => {
    set({ error: null });
    try {
      const response = await songsApi.getAll();
      set({ songs: response.data });
    } catch (error) {
      set({ error: error.message });
    }
  },

  fetchLikedSongs: async () => {
    const { token } = useAuthStore.getState();
    if (!token) return;
    set({ error: null });
    try {
      const response = await likesApi.getAll();
      set({ likedSongs: response.data });
    } catch (error) {
       if (error.response?.status === 401) useAuthStore.getState().logout();
      set({ error: error.message });
    }
  },

  toggleLike: async (songId) => {
    const { token } = useAuthStore.getState();
    if (!token) {
      set({ error: "Please log in to like songs." });
      return;
    }
    
    const { likedSongs } = get();
    const isLiked = likedSongs.includes(songId);
    let newLikes;
    if (isLiked) {
       newLikes = likedSongs.filter(id => id !== songId);
    } else {
       newLikes = Array.from(new Set([...likedSongs, songId]));
    }
    set({ likedSongs: newLikes, error: null });

    try {
      await likesApi.toggleLike(songId);
    } catch (error) {
      if (error.response?.status === 401) useAuthStore.getState().logout();
      set({ error: `Like sync error: ${error.message}`, likedSongs }); // Revert on error
    }
  },

  fetchPlaylists: async () => {
    const { token } = useAuthStore.getState();
    if (!token) return;
    set({ error: null });
    try {
      const response = await playlistsApi.getAll();
      set({ playlists: response.data });
    } catch (error) {
      set({ error: error.message });
    }
  },

  createPlaylist: async (name) => {
    set({ error: null });
    try {
      const response = await playlistsApi.create(name);
      set((state) => ({ playlists: [...state.playlists, response.data] }));
      return true;
    } catch (error) {
      set({ error: error.response?.data?.message || "Failed to create playlist" });
      return false;
    }
  },

  addSongToPlaylist: async (playlistId, songId) => {
    set({ error: null });
    try {
      await playlistsApi.addSong(playlistId, songId);
      return true;
    } catch (error) {
      set({ error: "Failed to add song to playlist" });
      return false;
    }
  },

  fetchPlaylistDetails: async (playlistId) => {
    set({ currentPlaylist: null, error: null });
    try {
      const response = await playlistsApi.getOne(playlistId);
      set({ currentPlaylist: response.data });
    } catch (error) {
      set({ error: "Failed to load playlist" });
    }
  },

  // --- AI Categories ---
  aiCategories: null,
  fetchAiCategories: async (categoriesList) => {
    const { token } = useAuthStore.getState();
    if (!token) return;
    try {
      const response = await fetch('/api/ai/categorize-genres', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ categories: categoriesList })
      });
      if (!response.ok) throw new Error("Failed to fetch AI categories");
      const data = await response.json();
      set({ aiCategories: data });
    } catch (error) {
      console.error("AI Fetch Error:", error);
      set({ aiCategories: {} });
    }
  },

  // --- Player Controls ---
  setSongs: (songs) => set({ songs: songs, queue: songs }),
  setQueue: (newQueue) => set({ queue: newQueue }),
  setAudioElement: (audio) => set({ audioElement: audio }),
  setCurrentSong: (song) => set({ currentSong: song, isPlaying: true, currentTime: 0 }),
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (time) => set({ duration: time }),
  seek: (time) => { const { audioElement } = get(); if (audioElement) audioElement.currentTime = time; set({ currentTime: time }); },
  toggleShuffle: () => set((state) => ({ shuffle: !state.shuffle })),
  toggleRepeat: () => set((state) => { const newRepeat = !state.repeat; if (get().audioElement) get().audioElement.loop = newRepeat; return { repeat: newRepeat }; }),
  
  // Decoupled queue operations
  nextSong: () => { 
    const { queue, currentSong, shuffle } = get();
    if (!currentSong || queue.length === 0) return;
    let nextIndex;
    if (shuffle) {
      do { nextIndex = Math.floor(Math.random() * queue.length); } while (queue.length > 1 && queue[nextIndex].id === currentSong.id);
    } else {
      const currentIndex = queue.findIndex(s => s.id === currentSong.id);
      nextIndex = (currentIndex + 1) % queue.length;
    }
    set({ currentSong: queue[nextIndex], isPlaying: true, currentTime: 0 });
  },
  
  prevSong: () => { 
    const { queue, currentSong, shuffle } = get();
    if (!currentSong || queue.length === 0) return;
    let prevIndex;
    if (shuffle) {
      do { prevIndex = Math.floor(Math.random() * queue.length); } while (queue.length > 1 && queue[prevIndex].id === currentSong.id);
    } else {
      const currentIndex = queue.findIndex(s => s.id === currentSong.id);
      prevIndex = (currentIndex - 1 + queue.length) % queue.length;
    }
    set({ currentSong: queue[prevIndex], isPlaying: true, currentTime: 0 });
  },
  
  playNext: (song) => set((state) => {
    if (state.queue.find(s => s.id === song.id)) return state;
    const { queue, currentSong } = state;
    if (!currentSong) return { queue: [...queue, song] };
    const currentIndex = queue.findIndex(s => s.id === currentSong.id);
    if (currentIndex === -1) return { queue: [...queue, song] };
    const newQueue = [...queue];
    newQueue.splice(currentIndex + 1, 0, song);
    return { queue: newQueue };
  }),

  addToQueue: (song) => set((state) => {
    if (state.queue.find(s => s.id === song.id)) return state;
    return { queue: [...state.queue, song] };
  }),

  removeFromQueue: (songId) => set((state) => ({
    queue: state.queue.filter(s => s.id !== songId)
  })),

  reorderQueue: (startIndex, endIndex) => set((state) => {
    const newQueue = Array.from(state.queue);
    const [removed] = newQueue.splice(startIndex, 1);
    newQueue.splice(endIndex, 0, removed);
    return { queue: newQueue };
  }),

  setVolume: (volume) => { set({ volume: volume }); const { audioElement } = get(); if (audioElement) audioElement.volume = volume; },
}));
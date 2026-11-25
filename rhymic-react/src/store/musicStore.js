import { create } from 'zustand';
import { useAuthStore } from './authStore';
import { songsApi, playlistsApi, likesApi, moodApi } from '../services/api';
import { preloadImages } from '../utils/preloadImages';

// An online track only flows through the <audio> element (and therefore the
// Web Audio EQ/analyser graph) while engine playback is available for it.
// Otherwise the hidden YouTube iframe plays it.
export const isEmbedPlayback = (state, song = state.currentSong) => {
  if (!song || song.source !== 'online') return false;
  return state.onlinePlayback === 'embed' || state.blockedOnlineIds.includes(song.id);
};

export const playsInElement = (state, song = state.currentSong) => {
  if (!song?.src) return false;
  return !isEmbedPlayback(state, song);
};

export const useMusicStore = create((set, get) => ({
  songs: [],
  currentSong: null,
  likedSongs: [],
  likedSongsLoading: false,
  playlists: [],
  currentPlaylist: null,
  currentMood: "Euphoric", // Starts with RhyMic Gold
  moodIndex: 0,
  queue: [], // Explicit queue array
  originalQueue: [], // For restoring order when shuffle is off
  recentlyPlayed: [],
  volume: 1,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  streamFallbackUrl: null,
  youtubePlayer: null,

  // --- Online playback routing ---
  // 'engine' = same-origin proxy through <audio> (real EQ + visualizer)
  // 'embed'  = hidden YouTube iframe (no Web Audio access)
  onlinePlayback: 'engine',
  engineFailures: 0,
  blockedOnlineIds: [],
  onlineEngineChecked: false,
  embedResumeAt: 0,

  // --- Audio Engine / Lab ---
  audioContext: null,
  analyserNode: null,
  crossfadeNode: null,
  eqBands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // dB values for 10 bands
  bassBoost: 0,
  
  setAudioContextNode: (context, analyser, crossfade) => set({ audioContext: context, analyserNode: analyser, crossfadeNode: crossfade }),

  setOnlineEngineAvailable: (available) => set({
    onlineEngineChecked: true,
    onlinePlayback: available ? get().onlinePlayback : 'embed',
  }),

  // Called when an online track cannot be played through the proxy <audio>
  // element. The current track switches to the hidden iframe immediately;
  // the whole session switches after a second failure.
  registerEngineFailure: (song, atSeconds = 0) => set((state) => {
    if (!song || song.source !== 'online') return {};
    if (state.blockedOnlineIds.includes(song.id)) return {};
    const engineFailures = state.engineFailures + 1;
    const isCurrent = state.currentSong?.id === song.id;
    return {
      blockedOnlineIds: [...state.blockedOnlineIds, song.id],
      engineFailures,
      onlinePlayback: engineFailures >= 2 ? 'embed' : state.onlinePlayback,
      embedResumeAt: isCurrent && Number.isFinite(atSeconds) ? atSeconds : state.embedResumeAt,
      error: null,
      streamFallbackUrl: null,
    };
  }),

  clearEmbedResumeAt: () => set({ embedResumeAt: 0 }),
  setEqBand: (index, value) => set((state) => {
    const newBands = [...state.eqBands];
    newBands[index] = value;
    return { eqBands: newBands };
  }),
  setBassBoost: (val) => set({ bassBoost: val }),

  // List of available moods for rotation
  _moodList: ["Chill", "Energetic", "Melancholy", "Euphoric", "Focus", "Romantic"],

  fetchSongMood: async (song) => {
    const { _moodList, moodIndex } = get();
    const nextIndex = (moodIndex + 1) % _moodList.length;
    
    set({
      moodIndex: nextIndex,
      currentMood: _moodList[nextIndex],
    });

    if (song.src?.startsWith('blob:')) return;
    try {
      const { data } = await moodApi.getSongMood(song.id, song.title, song.artist);
      if (get().currentSong === song && !data.error && _moodList.includes(data.mood)) {
        set({ currentMood: data.mood });
      }
    } catch {
      // The fallback mood already applies while the service is unavailable.
    }
  },
  shuffle: false,
  repeat: false,
  clearError: () => set({ error: null, streamFallbackUrl: null }),

  handlePlaybackError: (message, fallbackUrl) => {
    set({
      error: message,
      isPlaying: false,
      streamFallbackUrl: fallbackUrl ?? null,
    });
  },

  fetchSongs: async () => {
    set({ error: null });
    try {
      const response = await songsApi.getAll();
      preloadImages(response.data, 24);
      set({ songs: response.data });
    } catch (error) {
      set({ error: error.message });
    }
  },

  fetchLikedSongs: async () => {
    const { token } = useAuthStore.getState();
    if (!token) return;
    set({ error: null, likedSongsLoading: true });
    try {
      const response = await likesApi.getAll();
      set({ likedSongs: response.data, likedSongsLoading: false });
    } catch (error) {
       if (error.response?.status === 401) useAuthStore.getState().logout();
      set({ error: error.message, likedSongsLoading: false });
    }
  },

  toggleLike: async (input) => {
    const { token } = useAuthStore.getState();
    if (!token) {
      set({ error: "Please log in to like songs." });
      return;
    }
    
    // Extract ID (could be string youtube_id or int local id)
    const songId = typeof input === 'object' ? input.id : input;
    const { likedSongs } = get();
    const isLiked = likedSongs.includes(songId);
    
    let newLikes;
    let newSongs = [...get().songs];

    if (isLiked) {
       newLikes = likedSongs.filter(id => id !== songId);
    } else {
       newLikes = Array.from(new Set([...likedSongs, songId]));
       // Critical Fix: If it's an online song and not already in our songs list, 
       // inject it so the Favorites page can render it immediately.
       if (typeof input === 'object' && input.source === 'online') {
         if (!newSongs.find(s => s.id === songId)) {
            const normalizedInput = { ...input, cover: input.cover || input.thumbnail || '' };
            newSongs.push(normalizedInput);
         }
       }
    }
    
    set({ likedSongs: newLikes, songs: newSongs, error: null });

    try {
      await likesApi.toggleLike(input);
    } catch (error) {
      if (error.response?.status === 401) useAuthStore.getState().logout();
      set({ error: `Like sync error: ${error.message}`, likedSongs, songs: get().songs }); // Revert on error
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

  deletePlaylist: async (id) => {
    set({ error: null });
    try {
      await playlistsApi.delete(id);
      set((state) => ({ playlists: state.playlists.filter(p => p.id !== id) }));
      return true;
    } catch (error) {
      set({ error: error.response?.data?.message || "Failed to delete playlist" });
      return false;
    }
  },

  renamePlaylist: async (id, newName) => {
    set({ error: null });
    try {
      await playlistsApi.rename(id, newName);
      set((state) => ({
        playlists: state.playlists.map(p => p.id === id ? { ...p, name: newName } : p),
        currentPlaylist: state.currentPlaylist?.id === id ? { ...state.currentPlaylist, name: newName } : state.currentPlaylist
      }));
      return true;
    } catch (error) {
      set({ error: error.response?.data?.message || "Failed to rename playlist" });
      return false;
    }
  },

  addSongToPlaylist: async (playlistId, songId) => {
    set({ error: null });
    try {
      await playlistsApi.addSong(playlistId, songId);
      return true;
    } catch {
      set({ error: "Failed to add song to playlist" });
      return false;
    }
  },

  fetchPlaylistDetails: async (playlistId) => {
    set({ currentPlaylist: null, error: null });
    try {
      const response = await playlistsApi.getOne(playlistId);
      set({ currentPlaylist: response.data });
    } catch {
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
  setSongs: (songs) => {
    const normalizedSongs = songs.map(song => song.source === 'online'
      ? { ...song, cover: song.cover || song.thumbnail || '' }
      : song
    );
    set({ queue: normalizedSongs, originalQueue: normalizedSongs });
  },
  setQueue: (newQueue) => set({ queue: newQueue, originalQueue: newQueue }),
  setAudioElement: (audio) => set({ audioElement: audio }),
  setYouTubePlayer: (player) => set({ youtubePlayer: player }),
  // --- Audio Effects Helper ---
  _triggerCrossfade: async (duration = 0.3, targetGain = 0) => {
    const { crossfadeNode, audioContext } = get();
    if (crossfadeNode && audioContext) {
      const now = audioContext.currentTime;
      crossfadeNode.gain.cancelScheduledValues(now);
      crossfadeNode.gain.setValueAtTime(crossfadeNode.gain.value, now);
      crossfadeNode.gain.linearRampToValueAtTime(targetGain, now + duration);
      if (targetGain === 0) await new Promise(r => setTimeout(r, duration * 1000));
    }
  },

  setCurrentSong: (song) => {
    const { isPlaying, audioContext, audioElement, currentSong } = get();
    if (song && song === currentSong) {
      get().seek(0);
    }
    if (playsInElement(get(), song) && audioContext && audioContext.state !== 'running') {
      audioContext.resume().catch(() => {});
    }
    if (song && !playsInElement(get(), song)) audioElement?.pause();
    // Start fading out old song (non-blocking)
    if (isPlaying) get()._triggerCrossfade(0.15, 0);
    
    // Switch song immediately
    set((state) => ({
      currentSong: song,
      isPlaying: Boolean(song),
      currentTime: 0,
      embedResumeAt: 0,
      duration: song === currentSong ? state.duration : 0,
      error: null,
      streamFallbackUrl: null,
      recentlyPlayed: song
        ? [song, ...state.recentlyPlayed.filter((item) => item.id !== song.id)].slice(0, 20)
        : state.recentlyPlayed
    }));
    if (song) get().fetchSongMood(song);
    
    // Start fading in new song
    get()._triggerCrossfade(0.25, 1);
  },

  togglePlay: () => {
    const { isPlaying, currentSong, audioContext } = get();
    if (!currentSong) return;
    if (!playsInElement(get())) {
      set({ isPlaying: !isPlaying });
      return;
    }
    if (isPlaying) {
      // Snappy fade out then pause
      get()._triggerCrossfade(0.15, 0).then(() => {
        if (get().currentSong === currentSong) set({ isPlaying: false });
      });
    } else {
      if (audioContext && audioContext.state !== 'running') audioContext.resume().catch(() => {});
      set({ isPlaying: true, error: null });
      get()._triggerCrossfade(0.2, 1); // Fast fade in on resume
    }
  },

  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (time) => set({ duration: time }),
  seek: (time) => {
    const { audioElement, currentSong, youtubePlayer } = get();
    if (playsInElement(get())) {
      if (audioElement) audioElement.currentTime = time;
    } else if (currentSong?.source === 'online') {
      youtubePlayer?.seekTo(time, true);
    } else if (audioElement) {
      audioElement.currentTime = time;
    }
    set({ currentTime: time });
  },
  finishTrack: () => {
    const state = get();
    const { repeat, youtubePlayer, queue, nextSong, audioElement } = state;
    if (repeat) {
      if (playsInElement(state) && audioElement) {
        audioElement.currentTime = 0;
        audioElement.play().catch(() => {});
      } else if (youtubePlayer) {
        youtubePlayer.seekTo(0, true);
        youtubePlayer.playVideo();
      }
    } else if (queue.length > 1) {
      nextSong();
    } else {
      set({ isPlaying: false });
    }
  },
  toggleShuffle: () => set((state) => {
    const newShuffle = !state.shuffle;
    if (newShuffle) {
      // Store current order and shuffle
      const original = [...state.queue];
      const shuffled = [...state.queue];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      
      // Ensure currentSong stays at its current index or move it to front?
      // Better: keep currentSong where it is and shuffle the rest? 
      // Actually, simple shuffle is fine.
      return { shuffle: newShuffle, originalQueue: original, queue: shuffled };
    } else {
      // Restore original order
      return { shuffle: newShuffle, queue: state.originalQueue };
    }
  }),
  toggleRepeat: () => set((state) => { const newRepeat = !state.repeat; if (get().audioElement) get().audioElement.loop = newRepeat; return { repeat: newRepeat }; }),
  
  nextSong: async () => { 
    const { queue, currentSong } = get();
    if (!currentSong || queue.length === 0) return;
    
    const currentIndex = queue.findIndex(s => s.id === currentSong.id);
    const nextIndex = (currentIndex + 1) % queue.length;
    get().setCurrentSong(queue[nextIndex]);
  },
  
  prevSong: async () => { 
    const { queue, currentSong } = get();
    if (!currentSong || queue.length === 0) return;
    
    const currentIndex = queue.findIndex(s => s.id === currentSong.id);
    const prevIndex = (currentIndex - 1 + queue.length) % queue.length;
    get().setCurrentSong(queue[prevIndex]);
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

  setVolume: (volume) => {
    const { audioElement, youtubePlayer } = get();
    if (audioElement) audioElement.volume = volume;
    youtubePlayer?.setVolume(volume * 100);
    set({ volume });
  },
  resetPlayback: () => {
    const { audioElement } = get();
    if (audioElement) {
      audioElement.pause();
      audioElement.src = "";
      try {
        audioElement.load();
      } catch (e) {
        console.error("Audio element clean error", e);
      }
    }
    set({
      currentSong: null,
      isPlaying: false,
      queue: [],
      originalQueue: [],
      currentTime: 0,
      duration: 0
    });
  },
}));

// Reset music playback when user logs out
let prevToken = useAuthStore.getState().token;
useAuthStore.subscribe((state) => {
  const currentToken = state.token;
  if (prevToken && !currentToken) {
    useMusicStore.getState().resetPlayback();
  }
  prevToken = currentToken;
});

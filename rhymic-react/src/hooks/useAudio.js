// src/hooks/useAudio.js
import { useEffect, useMemo, useRef } from 'react';
import { useMusicStore } from '../store/musicStore';

export const useAudio = () => {
  const audio = useMemo(() => {
    const a = new Audio();
    a.crossOrigin = "anonymous";
    return a;
  }, []);

  // Get state and actions
  const currentSong = useMusicStore((state) => state.currentSong);
  const isPlaying = useMusicStore((state) => state.isPlaying);
  const volume = useMusicStore((state) => state.volume);
  
  // Get actions
  const setAudioElement = useMusicStore((state) => state.setAudioElement);
  const setIsPlaying = useMusicStore((state) => state.setIsPlaying);
  const setCurrentTime = useMusicStore((state) => state.setCurrentTime);
  const setDuration = useMusicStore((state) => state.setDuration);

  // Effect 1: Register the audio element
  useEffect(() => {
    setAudioElement(audio);
  }, [audio, setAudioElement]);

  // Effect 2: Load a new song
  useEffect(() => {
    if (!currentSong) return;

    const loadSong = async () => {
      let trackSrc;

      if (currentSong.source === 'online') {
        // Server-side resolution (backend uses yt-dlp → Piped → Invidious fallback chain)
        try {
          const token = localStorage.getItem('token');
          const resp = await fetch(`/api/stream/audio/${currentSong.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (resp.ok) {
            const data = await resp.json();
            if (data.url) {
              trackSrc = data.url;
            }
          }
        } catch (e) {
          console.error("[Audio] Server resolution failed:", e);
        }

        if (!trackSrc) {
          useMusicStore.getState().handlePlaybackError(`Could not stream "${currentSong.title}". Try again later.`);
          return;
        }

        // For online CDN URLs: disable crossOrigin so audio plays even if
        // the CDN doesn't send CORS headers. Visualizer gets silence for
        // online songs, but playback works reliably.
        audio.crossOrigin = null;
      } else {
        trackSrc = currentSong.src;
        // Local songs can use crossOrigin for visualizer support
        audio.crossOrigin = "anonymous";
      }

      audio.src = trackSrc;
      audio.volume = useMusicStore.getState().volume;
      audio.load();
      
      if (isPlaying) {
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch(e => {
            if (e.name !== 'AbortError') {
              console.error("Audio Play Error:", e);
            }
          });
        }
      }
    };

    loadSong();
  }, [currentSong, audio]); // eslint-disable-line react-hooks/exhaustive-deps

  // Effect 3: Handle Play/Pause
  useEffect(() => {
    if (currentSong) {
      if (isPlaying) {
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch(e => {
            if (e.name !== 'AbortError') {
              console.error("Audio Play Error:", e);
            }
          });
        }
      } else {
        audio.pause();
      }
    }
  }, [isPlaying, audio]); // eslint-disable-line react-hooks/exhaustive-deps

  // Effect 4: Sync Volume
  useEffect(() => {
    audio.volume = volume;
  }, [volume, audio]);

  // Ref to prevent double-firing the smart fade
  const hasTriggeredEndRef = useRef(false);

  // Reset trigger on new song
  useEffect(() => {
    hasTriggeredEndRef.current = false;
  }, [currentSong]);

  // Effect 5: Attach audio event listeners
  useEffect(() => {
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);

      // Smart Pre-fade: Trigger nextSong 400ms before track ends
      if (audio.duration && audio.currentTime > 0) {
        if (audio.duration - audio.currentTime <= 0.4 && !hasTriggeredEndRef.current) {
          const { nextSong, repeat } = useMusicStore.getState();
          if (!repeat) {
            hasTriggeredEndRef.current = true;
            nextSong();
          }
        }
      }
    };
    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };
    const handleEnded = () => {
      if (!hasTriggeredEndRef.current) {
        const { nextSong, repeat } = useMusicStore.getState();
        if (!repeat) {
          hasTriggeredEndRef.current = true;
          nextSong();
        }
      }
    };
    const handlePlaybackError = () => {
      const { handlePlaybackError: storeErrorHandler, currentSong } = useMusicStore.getState();
      if (currentSong) {
        storeErrorHandler(`Failed to stream "${currentSong.title}". Skipping...`);
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handlePlaybackError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handlePlaybackError);
    };
  }, [audio, setCurrentTime, setDuration]);

  return {};
};
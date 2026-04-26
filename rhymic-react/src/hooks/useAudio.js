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
  const volume = useMusicStore((state) => state.volume); // <-- ADD THIS
  
  // Get actions
  const setAudioElement = useMusicStore((state) => state.setAudioElement);
  const setIsPlaying = useMusicStore((state) => state.setIsPlaying);
  const setCurrentTime = useMusicStore((state) => state.setCurrentTime);
  const setDuration = useMusicStore((state) => state.setDuration);

  // Effect 1: Register the audio element
  // REMOVED 'volume' from this effect
  useEffect(() => {
    setAudioElement(audio);
  }, [audio, setAudioElement]);

  // Effect 2: Load a new song
  useEffect(() => {
    if (!currentSong) return;

    const loadSong = async () => {
      let trackSrc;

      if (currentSong.source === 'online') {
        // TWO-STEP STRATEGY:
        // 1. Ask backend to resolve the direct CDN stream URL (lightweight)
        // 2. Play directly from that CDN URL (user's residential IP, never blocked)
        // This bypasses YouTube blocking Render's server IP.
        try {
          const token = localStorage.getItem('token');
          const resp = await fetch(`/api/stream/audio/${currentSong.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await resp.json();
          if (data.url) {
            trackSrc = data.url;
          } else {
            console.error("[Audio] No stream URL returned for:", currentSong.id);
            useMusicStore.getState().handlePlaybackError(`Could not resolve stream for "${currentSong.title}"`);
            return;
          }
        } catch (e) {
          console.error("[Audio] Stream resolution failed:", e);
          useMusicStore.getState().handlePlaybackError(`Stream error: "${currentSong.title}"`);
          return;
        }
      } else {
        trackSrc = currentSong.src;
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

  // *** NEW Effect 4: Sync Volume ***
  // This effect ONLY runs when volume changes and updates the audio element.
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

      // Smart Pre-fade (Phase 5): Trigger the nextSong fade sequence 400ms before
      // the actual track officially ends on the DOM element.
      // This allows the mathematical hardware fade to execute seamlessly instead
      // of crashing abruptly at EOF.
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
    // The native ended event is now a fallback in case timeupdate misses the 400ms window
    const handleEnded = () => {
      if (!hasTriggeredEndRef.current) {
        const { nextSong, repeat } = useMusicStore.getState();
        if (!repeat) {
          hasTriggeredEndRef.current = true;
          nextSong();
        }
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
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
  }, [audio, setCurrentTime, setDuration]); // setIsPlaying removed — not called in this effect

  return {}; // No return needed
};
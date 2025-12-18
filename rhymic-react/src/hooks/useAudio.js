// src/hooks/useAudio.js
import { useEffect, useMemo } from 'react';
import { useMusicStore } from '../store/musicStore';

export const useAudio = () => {
  const audio = useMemo(() => new Audio(), []);

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
    if (currentSong) {
      audio.src = currentSong.src;
      // Set volume one time on load from the store's state
      audio.volume = useMusicStore.getState().volume;
      audio.load();
      if (isPlaying) {
        audio.play().catch(e => console.error("Audio Play Error:", e));
      }
    }
  }, [currentSong, audio]); // <-- REMOVED 'volume' from this dependency array

  // Effect 3: Handle Play/Pause
  useEffect(() => {
    if (currentSong) {
      if (isPlaying) {
        audio.play().catch(e => console.error("Audio Play Error:", e));
      } else {
        audio.pause();
      }
    }
  }, [isPlaying, currentSong, audio]);

  // *** NEW Effect 4: Sync Volume ***
  // This effect ONLY runs when volume changes and updates the audio element.
  useEffect(() => {
    audio.volume = volume;
  }, [volume, audio]);

  // Effect 4: Attach audio event listeners
  useEffect(() => {
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };
    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };
    const handleEnded = () => {
      const { nextSong, repeat } = useMusicStore.getState();
      if (!repeat) { // Only go to next song if repeat is off
        nextSong();
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audio, setCurrentTime, setDuration, setIsPlaying]);

  return {}; // No return needed
};
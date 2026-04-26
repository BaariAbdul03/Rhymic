// src/hooks/useAudio.js
import { useEffect, useMemo, useRef } from 'react';
import { useMusicStore } from '../store/musicStore';

// Public Piped API instances that support CORS for client-side resolution
const PIPED_INSTANCES = [
  "https://pipedapi.kavin.rocks",
  "https://api-piped.mha.fi",
  "https://piped-api.hostux.net",
  "https://pipedapi.adminforge.de",
  "https://pipedapi.tokhmi.xyz"
];

/**
 * Resolve audio stream URL directly from the client's browser.
 * This bypasses Render's blocked server IP entirely —
 * the user's residential IP is never flagged by YouTube.
 */
async function resolveAudioClientSide(videoId) {
  for (const instance of PIPED_INSTANCES) {
    try {
      const resp = await fetch(`${instance}/streams/${videoId}`, { 
        signal: AbortSignal.timeout(5000) 
      });
      if (!resp.ok) continue;
      
      const data = await resp.json();
      const audioStreams = data.audioStreams || [];
      
      if (audioStreams.length > 0) {
        // Pick the highest bitrate audio stream
        const best = audioStreams.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
        console.log(`[Audio] Resolved via Piped (${instance}):`, best.quality || best.mimeType);
        return best.url;
      }
    } catch (e) {
      // Timeout or network error — try next instance
      continue;
    }
  }
  return null;
}

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
        // STRATEGY: Try server-side first (fast if not blocked), 
        // then fall back to client-side Piped resolution.
        
        // Attempt 1: Server-side resolution
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
          console.warn("[Audio] Server-side resolution failed, trying client-side...");
        }

        // Attempt 2: Client-side Piped resolution (user's residential IP)
        if (!trackSrc) {
          console.log("[Audio] Resolving via client-side Piped for:", currentSong.id);
          trackSrc = await resolveAudioClientSide(currentSong.id);
        }

        if (!trackSrc) {
          console.error("[Audio] All resolution methods failed for:", currentSong.id);
          useMusicStore.getState().handlePlaybackError(`Could not stream "${currentSong.title}". Try again later.`);
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
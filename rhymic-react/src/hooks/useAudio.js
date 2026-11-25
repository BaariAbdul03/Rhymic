import { useEffect, useState } from 'react';
import { useMusicStore, playsInElement } from '../store/musicStore';
import { streamApi } from '../services/api';

export const useAudio = () => {
  const [audio] = useState(() => {
    const element = new Audio();
    element.preload = 'metadata';
    return element;
  });
  const song = useMusicStore(state => state.currentSong);
  const isPlaying = useMusicStore(state => state.isPlaying);
  // Online tracks play through this element while the server can resolve a
  // stream; otherwise the hidden YouTube iframe owns playback.
  const useElement = useMusicStore(state => playsInElement(state, state.currentSong));
  const localSong = useElement ? song : null;

  // Ask the server once whether it can resolve audio streams. In `embed` mode
  // there is no point in 503-ing the proxy for every online track.
  useEffect(() => {
    let cancelled = false;
    streamApi.status()
      .then(({ data }) => {
        if (cancelled) return;
        const mode = String(data?.mode || 'embed').toLowerCase();
        const available = data?.enabled !== false && mode !== 'embed' && mode !== 'disabled';
        useMusicStore.getState().setOnlineEngineAvailable(available);
      })
      .catch(() => {
        // Status unknown — keep the optimistic engine path and let the
        // per-track fallback handle real failures.
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const store = useMusicStore.getState;
    store().setAudioElement(audio);
    const updateTime = () => store().setCurrentTime(audio.currentTime);
    const updateDuration = () => store().setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onEnded = () => store().finishTrack();
    const onError = () => {
      const current = store().currentSong;
      if (!current || audio.getAttribute('src') !== current.src) return;
      if (current.source === 'online') {
        // Proxy failed (503, expired URL, unsupported codec) — hand the track
        // to the iframe, keeping the same position when possible.
        store().registerEngineFailure(current, audio.currentTime);
        return;
      }
      store().handlePlaybackError(`Could not play "${current.title}".`);
    };
    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audio.pause();
      store().setAudioElement(null);
    };
  }, [audio]);

  useEffect(() => {
    audio.pause();
    if (localSong?.src) {
      audio.src = localSong.src;
      audio.volume = useMusicStore.getState().volume;
      audio.loop = useMusicStore.getState().repeat;
    } else {
      audio.removeAttribute('src');
      audio.load();
    }
  }, [audio, localSong]);

  // A proxy that never produces metadata would otherwise hang silently.
  useEffect(() => {
    if (!localSong?.src || localSong.source !== 'online') return undefined;
    const timer = window.setTimeout(() => {
      const store = useMusicStore.getState();
      if (store.currentSong?.id === localSong.id && audio.readyState < 1) {
        store.registerEngineFailure(localSong, audio.currentTime);
      }
    }, 20000);
    return () => window.clearTimeout(timer);
  }, [audio, localSong]);

  useEffect(() => {
    if (!localSong?.src) return;
    if (!isPlaying) {
      audio.pause();
      return undefined;
    }

    let active = true;
    audio.play().catch(error => {
      const store = useMusicStore.getState();
      if (!active || store.currentSong !== localSong || !store.isPlaying || error.name === 'AbortError') return;
      if (error.name === 'NotAllowedError') {
        store.handlePlaybackError('Press play again to start audio.');
        return;
      }
      if (localSong.source === 'online') {
        // Codec/network/proxy failure — the iframe takes over automatically.
        store.registerEngineFailure(localSong, audio.currentTime);
        return;
      }
      store.handlePlaybackError(`Could not play "${localSong.title}".`);
    });
    return () => { active = false; };
  }, [audio, localSong, isPlaying]);
};

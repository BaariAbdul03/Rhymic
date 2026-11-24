import { useEffect, useState } from 'react';
import { useMusicStore } from '../store/musicStore';

export const useAudio = () => {
  const [audio] = useState(() => {
    const element = new Audio();
    element.preload = 'metadata';
    return element;
  });
  const song = useMusicStore(state => state.currentSong);
  const isPlaying = useMusicStore(state => state.isPlaying);
  const localSong = song?.source === 'online' ? null : song;

  useEffect(() => {
    const store = useMusicStore.getState;
    store().setAudioElement(audio);
    const updateTime = () => store().setCurrentTime(audio.currentTime);
    const updateDuration = () => store().setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onEnded = () => store().finishTrack();
    const onError = () => {
      const current = store().currentSong;
      if (current && current.source !== 'online' && audio.getAttribute('src') === current.src) {
        store().handlePlaybackError(`Could not play "${current.title}".`);
      }
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

  useEffect(() => {
    if (!localSong?.src) return;
    if (!isPlaying) {
      audio.pause();
      return;
    }

    let active = true;
    audio.play().catch(error => {
      const store = useMusicStore.getState();
      if (active && store.currentSong === localSong && store.isPlaying && error.name !== 'AbortError') {
        const message = error.name === 'NotAllowedError'
          ? 'Press play again to start audio.'
          : `Could not play "${localSong.title}".`;
        store.handlePlaybackError(message);
      }
    });
    return () => { active = false; };
  }, [audio, localSong, isPlaying]);
};

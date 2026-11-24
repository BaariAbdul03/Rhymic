import { useEffect, useRef } from 'react';
import { useMusicStore } from '../store/musicStore';
import styles from './YouTubePlayer.module.css';

let playerApi;
const bundledVersions = {
  '8MUgi5liyMU': '/assets/music/Hindi/Muskurane Ki Wajah Tum Ho.mp3',
};

function loadPlayerApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!playerApi) {
    playerApi = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const timeout = window.setTimeout(onFailure, 10000);
      function onFailure() {
        window.clearTimeout(timeout);
        delete window.onYouTubeIframeAPIReady;
        script.remove();
        reject(new Error('YouTube player could not load'));
      }
      window.onYouTubeIframeAPIReady = () => {
        window.clearTimeout(timeout);
        delete window.onYouTubeIframeAPIReady;
        resolve(window.YT);
      };
      script.src = 'https://www.youtube.com/iframe_api';
      script.onerror = onFailure;
      document.head.appendChild(script);
    }).catch(error => {
      playerApi = null;
      throw error;
    });
  }
  return playerApi;
}

function EmbeddedPlayer({ song }) {
  const mount = useRef(null);
  const playerRef = useRef(null);
  const isPlaying = useMusicStore(state => state.isPlaying);
  const videoId = String(song.id);
  const bundledSong = useMusicStore(state =>
    state.songs.find(track => track.src === bundledVersions[videoId])
  );
  const watchUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
  const playerError = useMusicStore(state => state.streamFallbackUrl === watchUrl ? state.error : null);

  const playBundledVersion = () => {
    const { queue, setQueue, setCurrentSong } = useMusicStore.getState();
    setQueue(queue.map(track => track.id === song.id ? bundledSong : track));
    setCurrentSong(bundledSong);
  };

  useEffect(() => {
    const store = useMusicStore.getState;
    if (!/^[\w-]{11}$/.test(videoId)) {
      store().handlePlaybackError('This track has no valid YouTube video.');
      return;
    }

    let active = true;
    let player;
    let readyTimer;
    const host = mount.current;
    const onFailure = () => {
      if (active) {
        window.clearTimeout(readyTimer);
        store().handlePlaybackError('YouTube could not play this track here.', watchUrl);
      }
    };

    loadPlayerApi().then(YT => {
      if (!active) return;

      const iframe = document.createElement('iframe');
      iframe.title = 'YouTube music player';
      iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      iframe.referrerPolicy = 'strict-origin-when-cross-origin';
      const params = new URLSearchParams({
        enablejsapi: '1',
        origin: window.location.origin,
        playsinline: '1',
      });
      const events = {
        events: {
          onReady: ({ target }) => {
            if (!active) return;
            window.clearTimeout(readyTimer);
            playerRef.current = target;
            store().setYouTubePlayer(target);
            target.setVolume(store().volume * 100);
            if (store().isPlaying) target.playVideo();
          },
          onStateChange: ({ data }) => {
            if (!active) return;
            if (data === YT.PlayerState.PLAYING) {
              if (store().streamFallbackUrl) store().clearError();
              store().setIsPlaying(true);
            }
            if (data === YT.PlayerState.PAUSED) store().setIsPlaying(false);
            if (data === YT.PlayerState.ENDED) store().finishTrack();
          },
          onAutoplayBlocked: () => {
            if (active) store().setIsPlaying(false);
          },
          onError: onFailure,
        },
      };

      // Wait for the embed document before the widget API starts messaging it.
      iframe.addEventListener('load', () => {
        if (!active) return;
        try {
          player = new YT.Player(iframe, events);
        } catch {
          onFailure();
        }
      }, { once: true });
      iframe.src = `https://www.youtube.com/embed/${videoId}?${params}`;
      host.appendChild(iframe);
      readyTimer = window.setTimeout(onFailure, 12000);
    }).catch(onFailure);

    const progressTimer = window.setInterval(() => {
      const current = playerRef.current;
      if (!current) return;
      store().setCurrentTime(current.getCurrentTime() || 0);
      store().setDuration(current.getDuration() || 0);
    }, 500);
    return () => {
      active = false;
      window.clearInterval(progressTimer);
      window.clearTimeout(readyTimer);
      playerRef.current = null;
      store().setYouTubePlayer(null);
      player?.destroy();
      host.replaceChildren();
    };
  }, [videoId, watchUrl]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    if (isPlaying) player.playVideo();
    else player.pauseVideo();
  }, [isPlaying]);

  return (
    // `inert` keeps the off-screen player out of the tab order and accessibility
    // tree; the iframe still renders and plays audio while parked off-screen.
    <aside className={styles.player} aria-label={`YouTube player for ${song.title}`} inert>
      <div ref={mount} />
      <p role="status">{playerError}</p>
      <a href={watchUrl} target="_blank" rel="noopener noreferrer">Open on YouTube</a>
      {playerError && bundledSong && (
        <button type="button" onClick={playBundledVersion}>Play bundled version</button>
      )}
    </aside>
  );
}

export default function YouTubePlayer() {
  const song = useMusicStore(state => state.currentSong);
  return song?.source === 'online' ? <EmbeddedPlayer key={song.id} song={song} /> : null;
}

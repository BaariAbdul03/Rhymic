import { useCallback, useEffect, useRef, useState } from 'react';
import { useMusicStore } from '../store/musicStore';
import { useUIStore } from '../store/uiStore';
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
  const playerVisible = useRef(false);
  const [collapsed, setCollapsed] = useState(false);
  const isPlaying = useMusicStore(state => state.isPlaying);
  const obscured = useUIStore(state =>
    state.isPlayerOpen || state.isAudioLabOpen || state.isVisualizerOpen || state.isSidebarOpen
  );
  const videoId = String(song.id);
  const bundledSong = useMusicStore(state =>
    state.songs.find(track => track.src === bundledVersions[videoId])
  );
  const watchUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
  const playerError = useMusicStore(state => state.streamFallbackUrl === watchUrl ? state.error : null);
  const showVideo = !collapsed || isPlaying;

  const canPlay = useCallback(() => {
    const ui = useUIStore.getState();
    return playerVisible.current && !document.hidden &&
      !ui.isPlayerOpen && !ui.isAudioLabOpen && !ui.isVisualizerOpen && !ui.isSidebarOpen;
  }, []);

  const syncPlayer = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;

    if (useMusicStore.getState().isPlaying && canPlay()) {
      if (player.getPlayerState() !== 1) player.playVideo();
    } else {
      player.pauseVideo();
    }
  }, [canPlay]);

  const toggleVideo = () => {
    if (showVideo) {
      playerRef.current?.pauseVideo();
      useMusicStore.getState().setIsPlaying(false);
    }
    setCollapsed(showVideo);
  };

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
    let observer;
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
            syncPlayer();
          },
          onStateChange: ({ data, target }) => {
            if (!active) return;
            if (data === YT.PlayerState.PLAYING) {
              if (!canPlay()) {
                target.pauseVideo();
                store().setIsPlaying(false);
                return;
              }
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
      observer = new IntersectionObserver(([entry]) => {
        if (!active) return;
        playerVisible.current = entry.intersectionRatio >= 0.51;
        if (!playerVisible.current && playerRef.current?.getPlayerState() === YT.PlayerState.PLAYING) {
          store().setIsPlaying(false);
        }
        syncPlayer();
      }, { threshold: 0.51 });
      observer.observe(iframe);
      readyTimer = window.setTimeout(onFailure, 12000);
    }).catch(onFailure);

    const onDocumentVisibility = () => {
      if (document.hidden) store().setIsPlaying(false);
    };
    document.addEventListener('visibilitychange', onDocumentVisibility);

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
      document.removeEventListener('visibilitychange', onDocumentVisibility);
      observer?.disconnect();
      playerVisible.current = false;
      playerRef.current = null;
      store().setYouTubePlayer(null);
      player?.destroy();
      host.replaceChildren();
    };
  }, [videoId, watchUrl, canPlay, syncPlayer]);

  useEffect(() => {
    if (obscured && isPlaying) useMusicStore.getState().setIsPlaying(false);
    syncPlayer();
  }, [isPlaying, obscured, syncPlayer]);

  return (
    <aside className={styles.player} aria-label={`YouTube player for ${song.title}`}>
      <div className={styles.content}>
        <div ref={mount} className={styles.video} hidden={!showVideo} />
        <div>
          <button type="button" onClick={toggleVideo} aria-expanded={showVideo}>
            {showVideo ? (isPlaying ? 'Pause and hide video' : 'Hide video') : 'Show video'}
          </button>
          <a href={watchUrl} target="_blank" rel="noopener noreferrer">Open on YouTube</a>
          <p role="status">{playerError}</p>
          {playerError && bundledSong && (
            <button type="button" onClick={playBundledVersion}>Play bundled version</button>
          )}
        </div>
      </div>
    </aside>
  );
}

export default function YouTubePlayer() {
  const song = useMusicStore(state => state.currentSong);
  return song?.source === 'online' ? <EmbeddedPlayer key={song.id} song={song} /> : null;
}

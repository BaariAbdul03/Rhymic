import React from 'react';
import { Play, Pause } from 'lucide-react';
import { useMusicStore } from '../store/musicStore';
import { useUIStore } from '../store/uiStore';
import SongCover from './SongCover';
import styles from './MobileMiniPlayer.module.css';

const MobileMiniPlayer = () => {
  const currentSong = useMusicStore((state) => state.currentSong);
  const isPlaying = useMusicStore((state) => state.isPlaying);
  const togglePlay = useMusicStore((state) => state.togglePlay);
  const currentTime = useMusicStore((state) => state.currentTime);
  const duration = useMusicStore((state) => state.duration);
  const openPlayer = useUIStore((state) => state.openPlayer);

  // No song selected means no player chrome at all on phones.
  if (!currentSong) return null;

  const progressPercent = duration > 0
    ? Math.min(100, Math.max(0, (currentTime / duration) * 100))
    : 0;

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={styles.bar}
        onClick={openPlayer}
        aria-label={`Open player: ${currentSong.title} by ${currentSong.artist}`}
      >
        <SongCover
          src={currentSong.cover}
          alt={currentSong.title}
          size="small"
          className={styles.cover}
        />
        <span className={styles.text}>
          <span className={styles.title}>{currentSong.title}</span>
          <span className={styles.artist}>{currentSong.artist}</span>
        </span>
      </button>
      <button
        type="button"
        className={styles.playBtn}
        onClick={togglePlay}
        aria-label={isPlaying ? 'Pause playback' : 'Resume playback'}
      >
        {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
      </button>
      <span className={styles.progress} aria-hidden="true">
        <span className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
      </span>
    </div>
  );
};

export default MobileMiniPlayer;

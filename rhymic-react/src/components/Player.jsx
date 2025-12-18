// Player.jsx
import React from 'react';
import styles from './Player.module.css';
import { useMusicStore } from '../store/musicStore';

const Player = () => {
  const currentSong = useMusicStore((state) => state.currentSong);

  // Safeguard: App.jsx should prevent this, but good to have
  if (!currentSong) {
    return null; 
  }

  return (
    <div className={styles.playerCard}>
      <img 
        src={currentSong.cover} 
        alt={currentSong.title} 
        className={styles.albumArt} 
      />
      <div className={styles.songInfo}>
        <h3 className={styles.title}>{currentSong.title}</h3>
        <p className={styles.artist}>{currentSong.artist}</p>
      </div>
    </div>
  );
};

export default Player;
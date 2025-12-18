import React, { useRef, useState } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat,
  Heart, Volume2, ListMusic, VolumeX, Volume1
} from 'lucide-react';
import styles from './ProgressBar.module.css';
import { useMusicStore } from '../store/musicStore';
import QueuePopup from './QueuePopup';

const formatTime = (time) => {
  if (isNaN(time)) return '0:00';
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

const ProgressBar = () => {
  const [showVolume, setShowVolume] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  
  const currentSong = useMusicStore((state) => state.currentSong);
  const isPlaying = useMusicStore((state) => state.isPlaying);
  const currentTime = useMusicStore((state) => state.currentTime);
  const duration = useMusicStore((state) => state.duration);
  const shuffle = useMusicStore((state) => state.shuffle);
  const repeat = useMusicStore((state) => state.repeat);
  const volume = useMusicStore((state) => state.volume);
  const likedSongs = useMusicStore((state) => state.likedSongs);

  const togglePlay = useMusicStore((state) => state.togglePlay);
  const seek = useMusicStore((state) => state.seek);
  const nextSong = useMusicStore((state) => state.nextSong);
  const prevSong = useMusicStore((state) => state.prevSong);
  const toggleShuffle = useMusicStore((state) => state.toggleShuffle);
  const toggleRepeat = useMusicStore((state) => state.toggleRepeat);
  const setVolume = useMusicStore((state) => state.setVolume);
  const toggleLike = useMusicStore((state) => state.toggleLike);
  
  const progressBarRef = useRef(null);
  
  const handleProgressClick = (e) => {
    if (duration && progressBarRef.current) {
      const rect = progressBarRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const barWidth = rect.width;
      const percentage = Math.max(0, Math.min(1, clickX / barWidth));
      const newTime = percentage * duration;
      seek(newTime);
    }
  };

  const progressPercentage = duration ? (currentTime / duration) * 100 : 0;
  
  const handleVolumeChange = (e) => {
    setVolume(Number(e.target.value));
  };
  
  const VolumeIcon = () => {
    if (volume === 0) return <VolumeX size={18} />;
    if (volume < 0.5) return <Volume1 size={18} />;
    return <Volume2 size={18} />;
  };

  const isCurrentSongLiked = currentSong ? likedSongs.includes(currentSong.id) : false;

  return (
    <footer className={styles.progressBar}>
      
      <div className={styles.nowPlaying}>
        {currentSong ? (
          <>
            <img src={currentSong.cover} alt={currentSong.title} className={styles.songCover} />
            <div className={styles.songInfo}>
              <h4 className={styles.songTitle}>{currentSong.title}</h4>
              <p className={styles.songArtist}>{currentSong.artist}</p>
            </div>
          </>
        ) : (
          <div className={styles.noSong}>Select a song to play</div>
        )}
      </div>

      <div className={styles.playerControls}>
        <div className={styles.controlButtons}>
          <Shuffle 
            size={18} 
            className={`${styles.controlIcon} ${shuffle ? styles.activeIcon : ''}`} 
            onClick={toggleShuffle} 
          />
          <SkipBack 
            size={20} 
            className={styles.controlIcon} 
            onClick={prevSong} 
          />
          <button className={styles.playButton} onClick={togglePlay}>
            {isPlaying ? <Pause size={22} /> : <Play size={22} />}
          </button>
          <SkipForward 
            size={20} 
            className={styles.controlIcon} 
            onClick={nextSong} 
          />
          <Repeat 
            size={18} 
            className={`${styles.controlIcon} ${repeat ? styles.activeIcon : ''}`} 
            onClick={toggleRepeat} 
          />
        </div>
        
        <div className={styles.timeControls}>
          <span>{formatTime(currentTime)}</span>
          <div
            className={styles.progressBarTrack}
            ref={progressBarRef}
            onClick={handleProgressClick}
          >
            <div
              className={styles.progressBarFill}
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className={styles.extraControls}>
        <button
          className={`${styles.controlIcon} ${isCurrentSongLiked ? styles.activeIcon : ''}`}
          onClick={() => currentSong && toggleLike(currentSong.id)}
          disabled={!currentSong}
        >
          <Heart 
            size={18} 
            fill={isCurrentSongLiked ? 'currentColor' : 'none'} 
          />
        </button>
        
        <div className={styles.volumeContainer}>
          <div 
            className={styles.volumeSliderWrapper}
            style={{ display: showVolume ? 'flex' : 'none' }}
          >
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={handleVolumeChange}
              className={styles.volumeSlider}
            />
          </div>
          <button 
            className={styles.controlIcon}
            onClick={() => setShowVolume(!showVolume)}
          >
            <VolumeIcon />
          </button>
        </div>
        
        {showQueue && <QueuePopup onClose={() => setShowQueue(false)} />}
        
        <button 
            className={`${styles.controlIcon} ${showQueue ? styles.activeIcon : ''}`}
            onClick={() => setShowQueue(!showQueue)}
        >
            <ListMusic size={18} />
        </button>
      </div>

    </footer>
  );
};

export default ProgressBar;
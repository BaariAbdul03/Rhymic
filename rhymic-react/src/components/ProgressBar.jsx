import React from 'react';
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Volume2, VolumeX, Heart, ListMusic } from 'lucide-react';
import { useMusicStore } from '../store/musicStore';
import { useUIStore } from '../store/uiStore';
import { useAudio } from '../hooks/useAudio';
import styles from './ProgressBar.module.css';

const ProgressBar = () => {
  const { 
    currentSong, 
    isPlaying, 
    togglePlay, 
    nextSong, 
    prevSong,
    currentTime,
    duration,
    seek,
    volume,
    setVolume,
    shuffle,
    toggleShuffle,
    repeat,
    toggleRepeat,
    toggleLike,
    likedSongs
  } = useMusicStore();

  const { togglePlayer, toggleRightPanel, isRightPanelOpen } = useUIStore();
  
  // Custom hook to manage the actual HTML5 Audio element
  useAudio();

  const formatTime = (time) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Fallback default just to satisfy type errors safely
  const displaySong = currentSong || {
    id: 'empty',
    title: '',
    artist: '',
    cover: ''
  };

  const isLiked = currentSong ? likedSongs.includes(currentSong.id) : false;

  const handleSeek = (e) => {
    if (!currentSong) return;
    const time = (e.target.value / 100) * duration;
    seek(time);
  };

  const handleVolumeChange = (e) => {
    setVolume(e.target.value / 100);
  };

  const progressPercent = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div className={styles.playerContainer}>
      {/* Left: Song Info */}
      <div className={styles.songInfo} onClick={togglePlayer} style={{ cursor: 'pointer' }}>
        {currentSong && (
          <>
            <img 
              src={displaySong.cover} 
              alt={displaySong.title} 
              className={styles.coverImage} 
            />
            <div className={styles.songDetails}>
              <h4>{displaySong.title}</h4>
              <p>{displaySong.artist}</p>
            </div>
          </>
        )}
      </div>

      {/* Center: Controls & Scrubber */}
      <div className={styles.playerCentro}>
        <div className={styles.controls}>
          <button 
            className={`${styles.controlBtn} ${shuffle ? styles.active : ''}`} 
            onClick={toggleShuffle}
            disabled={!currentSong}
          >
            <Shuffle size={18} />
          </button>
          <button className={styles.controlBtn} onClick={prevSong} disabled={!currentSong}>
            <SkipBack size={20} />
          </button>
          
          <button className={styles.playPauseBtn} onClick={togglePlay} disabled={!currentSong}>
            {isPlaying ? (
              <Pause size={24} fill="currentColor" />
            ) : (
              <Play size={24} fill="currentColor" className={styles.playIconFix} />
            )}
          </button>
          
          <button className={styles.controlBtn} onClick={nextSong} disabled={!currentSong}>
            <SkipForward size={20} />
          </button>
          <button 
             className={styles.likeBtn} 
             onClick={() => currentSong && toggleLike(currentSong.id)}
             disabled={!currentSong}
          >
             <Heart size={18} fill={isLiked ? "var(--accent-primary)" : "none"} color={isLiked ? "var(--accent-primary)" : "var(--text-secondary)"} />
          </button>
          <button 
            className={`${styles.controlBtn} ${repeat ? styles.active : ''}`} 
            onClick={toggleRepeat}
            disabled={!currentSong}
          >
            <Repeat size={18} />
          </button>
        </div>

        <div className={styles.scrubberContainer}>
          <span className={styles.timeText}>{formatTime(currentTime)}</span>
          <div className={styles.sliderWrapper}>
            <input
              type="range"
              min="0"
              max="100"
              value={progressPercent}
              onChange={handleSeek}
              className={styles.slider}
              disabled={!currentSong}
              style={{
                '--progress-width': `${progressPercent}%`
              }}
            />
          </div>
          <span className={styles.timeText}>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Right: Actions & Volume */}
      <div className={styles.rightControls}>
        <button 
          className={styles.controlBtn} 
          onClick={toggleRightPanel}
          title="Toggle Queue"
          style={{ opacity: isRightPanelOpen ? 1 : 0.5, marginRight: '16px' }}
        >
          <ListMusic size={18} />
        </button>
        <div className={styles.volumeContainer}>
          <button 
            className={styles.controlBtn} 
            onClick={() => setVolume(volume === 0 ? 1 : 0)}
          >
            {volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <div className={styles.sliderWrapper} style={{ width: '80px' }}>
             <input
                type="range"
                min="0"
                max="100"
                value={volume * 100}
                onChange={handleVolumeChange}
                className={styles.slider}
                style={{
                  '--progress-width': `${volume * 100}%`
                }}
              />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProgressBar;
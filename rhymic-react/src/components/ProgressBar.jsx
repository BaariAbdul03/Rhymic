import React from 'react';
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Volume2, VolumeX, Heart, ListMusic, Activity, Sliders } from 'lucide-react';
/* eslint-disable-next-line no-unused-vars */
import { motion, AnimatePresence } from 'framer-motion';
import { useMusicStore } from '../store/musicStore';
import { useUIStore } from '../store/uiStore';
import { useAudio } from '../hooks/useAudio';
import { useAudioEngine } from '../hooks/useAudioEngine';
import SongCover from './SongCover';
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

  const { togglePlayer, toggleRightPanel, isRightPanelOpen, toggleVisualizer, isVisualizerOpen, toggleAudioLab, isAudioLabOpen } = useUIStore();
  
  // Custom hook to manage the actual HTML5 Audio element
  useAudio();
  
  // Custom hook to manage the Web Audio API Graph (EQ, Bass, etc)
  useAudioEngine();

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
      <div className={styles.glassBackground}></div>
      {/* Left: Song Info */}
      <div className={styles.songInfo} onClick={togglePlayer} style={{ cursor: 'pointer' }}>
        {currentSong && (
          <>
            <div className={styles.coverWrapper}>
              <AnimatePresence mode="wait">
                <SongCover 
                  key={displaySong.id}
                  src={displaySong.cover} 
                  alt={displaySong.title} 
                  size="small"
                  className={styles.coverImage}
                  initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.8, rotate: 10 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                />
              </AnimatePresence>
            </div>
            <div className={styles.songDetails}>
              <AnimatePresence mode="wait">
                <motion.h4 
                  key={`title-${displaySong.id}`}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                >
                  {displaySong.title}
                </motion.h4>
              </AnimatePresence>
              <AnimatePresence mode="wait">
                <motion.p
                  key={`artist-${displaySong.id}`}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                >
                  {displaySong.artist}
                </motion.p>
              </AnimatePresence>
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
            <AnimatePresence mode="wait">
              {isPlaying ? (
                <motion.div
                  key="pause"
                  initial={{ scale: 0.5, opacity: 0, rotate: -90 }}
                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                  exit={{ scale: 0.5, opacity: 0, rotate: 90 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  style={{ display: 'flex' }}
                >
                  <Pause size={24} fill="currentColor" />
                </motion.div>
              ) : (
                <motion.div
                  key="play"
                  initial={{ scale: 0.5, opacity: 0, rotate: -90 }}
                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                  exit={{ scale: 0.5, opacity: 0, rotate: 90 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  style={{ display: 'flex' }}
                  className={styles.playIconFix}
                >
                  <Play size={24} fill="currentColor" />
                </motion.div>
              )}
            </AnimatePresence>
          </button>
          
          <button className={styles.controlBtn} onClick={nextSong} disabled={!currentSong}>
            <SkipForward size={20} />
          </button>
          <button 
            className={`${styles.iconBtn} ${styles.likeBtn}`} 
            onClick={() => currentSong && toggleLike(currentSong)}
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
          onClick={toggleAudioLab}
          title="Audio Lab (EQ)"
          style={{ color: isAudioLabOpen ? 'var(--accent-primary)' : 'var(--text-secondary)', marginRight: '8px' }}
        >
          <Sliders size={18} />
        </button>
        <button 
          className={styles.controlBtn} 
          onClick={toggleVisualizer}
          title="Toggle Visualizer"
          style={{ color: isVisualizerOpen ? 'var(--accent-primary)' : 'var(--text-secondary)', marginRight: '8px' }}
        >
          <Activity size={18} />
        </button>
        <button 
          className={styles.controlBtn} 
          onClick={toggleRightPanel}
          title="Toggle Queue"
          style={{ color: isRightPanelOpen ? 'var(--accent-primary)' : 'var(--text-secondary)', marginRight: '16px' }}
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
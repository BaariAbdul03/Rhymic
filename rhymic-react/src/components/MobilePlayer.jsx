import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, SkipBack, SkipForward, Play, Pause, Shuffle, Repeat, ListMusic, Volume2, VolumeX } from 'lucide-react';
import { useMusicStore } from '../store/musicStore';
import { useUIStore } from '../store/uiStore';
import styles from './MobilePlayer.module.css';

const MobilePlayer = () => {
  const [showVolume, setShowVolume] = useState(false);
  const isPlayerOpen = useUIStore(state => state.isPlayerOpen);
  const closePlayer = useUIStore(state => state.closePlayer);
  const toggleRightPanel = useUIStore(state => state.toggleRightPanel);

  const { 
    currentSong, isPlaying, togglePlay, nextSong, prevSong,
    currentTime, duration, seek, shuffle, toggleShuffle, repeat, toggleRepeat,
    volume, setVolume
  } = useMusicStore();

  if (!isPlayerOpen) return null;

  const displaySong = currentSong || {
    title: 'No Song Playing',
    artist: '--',
    cover: 'https://images.unsplash.com/photo-1614680376593-902f74cf0d41?q=80&w=1000&auto=format&fit=crop'
  };

  const formatTime = (time) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration ? (currentTime / duration) * 100 : 0;

  const handleSeek = (e) => {
    if (!currentSong) return;
    seek((e.target.value / 100) * duration);
  };

  const handleVolumeChange = (e) => {
    setVolume(e.target.value / 100);
  };

  return (
    <AnimatePresence>
      <motion.div 
        className={styles.mobileOverlay}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      >
        <div 
          className={styles.overlayBackground} 
          style={{ backgroundImage: `url("${displaySong.cover}")` }}
        />
        
        <div className={styles.contentWrapper}>
          {/* Header */}
          <div className={styles.header}>
            <button className={styles.iconBtn} onClick={closePlayer} title="Close Player">
              <ChevronDown size={24} />
            </button>
            <span className={styles.brand}>Rhymic</span>
            <button className={styles.iconBtn} onClick={toggleRightPanel} title="Queue">
               <ListMusic size={20} />
            </button>
          </div>

          {/* Cover Art */}
          <div className={styles.coverContainer}>
            <img src={displaySong.cover} alt="Cover" className={styles.coverImage} />
          </div>

          {/* Info */}
          <div className={styles.infoSection}>
            <h2 className={styles.title}>{displaySong.title}</h2>
            <p className={styles.artist}>{displaySong.artist}</p>
          </div>

          {/* Scrubber */}
          <div className={styles.scrubberSection}>
            <div className={styles.sliderContainer}>
              <input
                type="range"
                min="0"
                max="100"
                value={progressPercent}
                onChange={handleSeek}
                className={styles.slider}
                style={{ '--progress-width': `${progressPercent}%` }}
              />
            </div>
            <div className={styles.timeContainer}>
              <span>{formatTime(currentTime)}</span>
              <span>-{formatTime(duration - currentTime)}</span>
            </div>
          </div>

          {/* Controls */}
          <div className={styles.controlsWrapper}>
            <div className={styles.controlsSection}>
              <button 
                className={`${styles.transportBtn} ${shuffle ? styles.active : ''}`} 
                onClick={toggleShuffle}
              >
                <Shuffle size={24} />
              </button>
              <button className={styles.transportBtn} onClick={prevSong}>
                <SkipBack size={32} fill="currentColor" />
              </button>
              <button className={styles.playBtn} onClick={togglePlay}>
                {isPlaying ? (
                  <Pause size={32} fill="currentColor" />
                ) : (
                  <Play size={32} fill="currentColor" className={styles.playIconFix} />
                )}
              </button>
              <button className={styles.transportBtn} onClick={nextSong}>
                <SkipForward size={32} fill="currentColor" />
              </button>
              <button 
                className={`${styles.transportBtn} ${repeat ? styles.active : ''}`} 
                onClick={toggleRepeat}
              >
                <Repeat size={24} />
              </button>
            </div>

            {/* Desktop Volume Slider */}
            <div className={styles.desktopVolume}>
              <button 
                className={styles.transportBtn} 
                onClick={() => setShowVolume(!showVolume)}
              >
                {volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
              <div className={`${styles.volumeSliderContainer} ${showVolume ? styles.expanded : ''}`}>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume * 100}
                  onChange={handleVolumeChange}
                  className={styles.volumeSlider}
                  style={{ '--volume-width': `${volume * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default MobilePlayer;

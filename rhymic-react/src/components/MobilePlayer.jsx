import React, { useState, useRef } from 'react';
/* eslint-disable-next-line no-unused-vars */
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, SkipBack, SkipForward, Play, Pause, Shuffle, Repeat, ListMusic, Volume2, VolumeX, Activity, Sliders } from 'lucide-react';
import { useMusicStore } from '../store/musicStore';
import { useUIStore } from '../store/uiStore';
import SongCover from './SongCover';
import styles from './MobilePlayer.module.css';

const MobilePlayer = () => {
  const [showVolume, setShowVolume] = useState(false);
  const isPlayerOpen = useUIStore(state => state.isPlayerOpen);
  const closePlayer = useUIStore(state => state.closePlayer);
  const toggleRightPanel = useUIStore(state => state.toggleRightPanel);
  const isVisualizerOpen = useUIStore(state => state.isVisualizerOpen);
  const toggleVisualizer = useUIStore(state => state.toggleVisualizer);
  const isAudioLabOpen = useUIStore(state => state.isAudioLabOpen);
  const toggleAudioLab = useUIStore(state => state.toggleAudioLab);

  const { 
    currentSong, isPlaying, togglePlay, nextSong, prevSong,
    currentTime, duration, seek, shuffle, toggleShuffle, repeat, toggleRepeat,
    volume, setVolume
  } = useMusicStore();

  // 3D Tilt Effect State
  const coverRef = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  // FIX C-3: Do NOT return null before the AnimatePresence wrapper.
  // Doing so means the motion.div is never in the React tree when isPlayerOpen
  // becomes false, so AnimatePresence can never animate it out (exit prop
  // requires the element to be present and then removed from the tree by
  // AnimatePresence's own conditional rendering).
  // Solution: move the conditional inside AnimatePresence as a child guard.

  const displaySong = currentSong || {
    title: 'No Song Playing',
    artist: '--',
    cover: 'https://images.unsplash.com/photo-1614680376593-902f74cf0d41?q=80&w=1000'
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

  // Handle 3D Tilt
  const handleMouseMove = (e) => {
    if (!coverRef.current) return;
    const rect = coverRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Calculate rotation (-15 to +15 degrees)
    const rotateY = ((x / rect.width) - 0.5) * 30;
    const rotateX = ((y / rect.height) - 0.5) * -30;
    
    setTilt({ x: rotateX, y: rotateY });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  return (
    <AnimatePresence>
      {isPlayerOpen && (
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
        >
           <div className={styles.animatedGradientOverlay}></div>
        </div>
        
        <div className={styles.contentWrapper}>
          {/* Header */}
          <div className={styles.header}>
            <motion.button 
              whileTap={{ scale: 0.9 }}
              className={styles.iconBtn} 
              onClick={closePlayer} 
              title="Close Player"
            >
              <ChevronDown size={24} />
            </motion.button>
            <span className={styles.brand}>Rhymic</span>
            <div style={{ display: 'flex', gap: '12px' }}>
              <motion.button 
                whileTap={{ scale: 0.9 }}
                className={styles.iconBtn} 
                onClick={(e) => {
                  e.stopPropagation();
                  toggleAudioLab();
                }} 
                title="Audio Lab"
              >
                 <Sliders size={20} style={{ color: isAudioLabOpen ? 'var(--accent-primary)' : 'inherit' }} />
              </motion.button>
              <motion.button 
                whileTap={{ scale: 0.9 }}
                className={styles.iconBtn} 
                onClick={(e) => {
                  e.stopPropagation();
                  toggleVisualizer();
                }} 
                title="Visualizer"
              >
                 <Activity size={20} style={{ color: isVisualizerOpen ? 'var(--accent-primary)' : 'inherit' }} />
              </motion.button>
              <motion.button 
                whileTap={{ scale: 0.9 }}
                className={styles.iconBtn} 
                onClick={toggleRightPanel} 
                title="Queue"
              >
                 <ListMusic size={20} />
              </motion.button>
            </div>
          </div>

          {/* Cover Art */}
          <div className={styles.coverContainer}>
            <motion.div 
              ref={coverRef}
              className={styles.perspectiveWrapper}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              onTouchMove={(e) => {
                 const touch = e.touches[0];
                 handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
              }}
              onTouchEnd={handleMouseLeave}
              animate={{ rotateX: tilt.x, rotateY: tilt.y }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <AnimatePresence mode="wait">
                <SongCover 
                  key={displaySong.id}
                  src={displaySong.cover} 
                  alt="Cover" 
                  className={styles.coverImage} 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.1 }}
                  transition={{ duration: 0.4 }}
                />
              </AnimatePresence>
            </motion.div>
          </div>

          {/* Info */}
          <div className={styles.infoSection}>
            <AnimatePresence mode="wait">
              <motion.h2 
                key={`title-${displaySong.id}`}
                className={styles.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                {displaySong.title}
              </motion.h2>
            </AnimatePresence>
             <AnimatePresence mode="wait">
              <motion.p 
                key={`artist-${displaySong.id}`}
                className={styles.artist}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: 0.1 }}
              >
                {displaySong.artist}
              </motion.p>
            </AnimatePresence>
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
              <span className={styles.timeText}>{formatTime(currentTime)}</span>
              <span className={styles.timeText}>-{formatTime(duration - currentTime)}</span>
            </div>
          </div>

          {/* Controls */}
          <div className={styles.controlsWrapper}>
            <div className={styles.controlsSection}>
              <motion.button 
                whileTap={{ scale: 0.8 }}
                className={`${styles.transportBtn} ${shuffle ? styles.active : ''}`} 
                onClick={toggleShuffle}
              >
                <Shuffle size={24} />
              </motion.button>
              <motion.button whileTap={{ scale: 0.8 }} className={styles.transportBtn} onClick={prevSong}>
                <SkipBack size={32} fill="currentColor" />
              </motion.button>

              <motion.button 
                whileTap={{ scale: 0.9 }} 
                className={styles.playBtn} 
                onClick={togglePlay}
              >
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
                        <Pause size={32} fill="currentColor" />
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
                        <Play size={32} fill="currentColor" />
                      </motion.div>
                    )}
                  </AnimatePresence>
              </motion.button>

              <motion.button whileTap={{ scale: 0.8 }} className={styles.transportBtn} onClick={nextSong}>
                <SkipForward size={32} fill="currentColor" />
              </motion.button>
              <motion.button 
                whileTap={{ scale: 0.8 }}
                className={`${styles.transportBtn} ${repeat ? styles.active : ''}`} 
                onClick={toggleRepeat}
              >
                <Repeat size={24} />
              </motion.button>
            </div>

            {/* Desktop Volume Slider */}
            <div className={styles.desktopVolume}>
              <motion.button 
                whileTap={{ scale: 0.9 }}
                className={styles.transportBtn} 
                onClick={() => setShowVolume(!showVolume)}
              >
                {volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </motion.button>
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
      )}
    </AnimatePresence>
  );
};

export default MobilePlayer;

import React, { useRef, useEffect } from 'react';
/* eslint-disable-next-line no-unused-vars */
import { motion, AnimatePresence } from 'framer-motion';
import { X, Activity, BarChart2, CircleDashed, Sparkles, Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { useUIStore } from '../store/uiStore';
import { useMusicStore } from '../store/musicStore';
import { useVisualizer } from '../hooks/useVisualizer';
import SongCover from './SongCover';
import styles from './Visualizer.module.css';

const Visualizer = () => {
  const canvasRef = useRef(null);
  const isVisualizerOpen = useUIStore((state) => state.isVisualizerOpen);
  const visualizerMode = useUIStore((state) => state.visualizerMode);
  const toggleVisualizer = useUIStore((state) => state.toggleVisualizer);
  const setVisualizerMode = useUIStore((state) => state.setVisualizerMode);

  // Music Player Hooks
  const currentSong = useMusicStore((state) => state.currentSong);
  const isPlaying = useMusicStore((state) => state.isPlaying);
  const togglePlay = useMusicStore((state) => state.togglePlay);
  const nextSong = useMusicStore((state) => state.nextSong);
  const prevSong = useMusicStore((state) => state.prevSong);
  const currentTime = useMusicStore((state) => state.currentTime);
  const duration = useMusicStore((state) => state.duration);
  const seek = useMusicStore((state) => state.seek);

  useVisualizer(canvasRef, visualizerMode, isVisualizerOpen);

  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        // scale canvas internal buffer
        const dpr = window.devicePixelRatio || 1;
        const canvas = canvasRef.current;
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        canvas.style.width = `${window.innerWidth}px`;
        canvas.style.height = `${window.innerHeight}px`;
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
      }
    };

    if (isVisualizerOpen) {
      handleResize();
      window.addEventListener('resize', handleResize);
    }

    return () => window.removeEventListener('resize', handleResize);
  }, [isVisualizerOpen]);

  const formatTime = (time) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e) => {
    if (!currentSong) return;
    const time = (e.target.value / 100) * duration;
    seek(time);
  };

  const progressPercent = duration ? (currentTime / duration) * 100 : 0;

  return (
    <AnimatePresence>
      {isVisualizerOpen && (
        <motion.div 
          className={styles.visualizerOverlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          <canvas ref={canvasRef} className={styles.canvas} />
          
          <div className={styles.controls}>
            <button className={styles.closeBtn} onClick={toggleVisualizer} title="Close Visualizer">
              <X size={32} />
            </button>

            <div className={styles.modeSelector}>
              <button 
                className={`${styles.modeBtn} ${visualizerMode === 'waveform' ? styles.active : ''}`}
                onClick={() => setVisualizerMode('waveform')}
                title="Waveform"
              >
                <Activity size={24} />
              </button>
              <button 
                className={`${styles.modeBtn} ${visualizerMode === 'bars' ? styles.active : ''}`}
                onClick={() => setVisualizerMode('bars')}
                title="Frequency Bars"
              >
                <BarChart2 size={24} />
              </button>
              <button 
                className={`${styles.modeBtn} ${visualizerMode === 'circle' ? styles.active : ''}`}
                onClick={() => setVisualizerMode('circle')}
                title="Circular Spectrum"
              >
                <CircleDashed size={24} />
              </button>
              <button 
                className={`${styles.modeBtn} ${visualizerMode === 'particles' ? styles.active : ''}`}
                onClick={() => setVisualizerMode('particles')}
                title="Particle Field"
              >
                <Sparkles size={24} />
              </button>
            </div>
          </div>

          {/* Minimal Bottom Player matching Visualizer design */}
          <div className={styles.bottomPlayer}>
            <div className={styles.songInfo}>
              {currentSong ? (
                <>
                  <SongCover 
                    src={currentSong.cover} 
                    alt={currentSong.title} 
                    size="small"
                    className={styles.coverImage} 
                  />
                  <div className={styles.songDetails}>
                    <h4>{currentSong.title}</h4>
                    <p>{currentSong.artist}</p>
                  </div>
                </>
              ) : (
                <div className={styles.songDetails}>
                  <h4>No song playing</h4>
                </div>
              )}
            </div>

            <div className={styles.playbackControls}>
              <button onClick={prevSong} className={styles.controlBtn} disabled={!currentSong}>
                <SkipBack size={20} />
              </button>
              <button onClick={togglePlay} className={styles.playPauseBtn} disabled={!currentSong}>
                {isPlaying ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
              </button>
              <button onClick={nextSong} className={styles.controlBtn} disabled={!currentSong}>
                <SkipForward size={20} />
              </button>
            </div>

            <div className={styles.scrubber}>
              <span>{formatTime(currentTime)}</span>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={progressPercent} 
                onChange={handleSeek} 
                className={styles.slider}
                disabled={!currentSong}
                style={{ '--progress-width': `${progressPercent}%` }}
              />
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Visualizer;

import React, { useRef, useEffect } from 'react';
/* eslint-disable-next-line no-unused-vars */
import { motion, AnimatePresence } from 'motion/react';
import { X, Activity, BarChart2, CircleDashed, Sparkles } from 'lucide-react';
import { useUIStore } from '../store/uiStore';
import { useVisualizer } from '../hooks/useVisualizer';
import styles from './Visualizer.module.css';

const Visualizer = () => {
  const canvasRef = useRef(null);
  const isVisualizerOpen = useUIStore((state) => state.isVisualizerOpen);
  const visualizerMode = useUIStore((state) => state.visualizerMode);
  const toggleVisualizer = useUIStore((state) => state.toggleVisualizer);
  const setVisualizerMode = useUIStore((state) => state.setVisualizerMode);

  useVisualizer(canvasRef, visualizerMode, isVisualizerOpen);

  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        // FIX C-2: Scale canvas internal buffer by devicePixelRatio so the
        // visualizer renders sharply on retina/high-DPI screens. Without this,
        // the canvas buffer is 1:1 with CSS pixels and appears blurry at 2x DPR.
        const dpr = window.devicePixelRatio || 1;
        const canvas = canvasRef.current;
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        // CSS size stays at logical pixels; only the drawing buffer is scaled.
        canvas.style.width = `${window.innerWidth}px`;
        canvas.style.height = `${window.innerHeight}px`;
        // Scale all canvas draw calls to match DPR
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
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Visualizer;

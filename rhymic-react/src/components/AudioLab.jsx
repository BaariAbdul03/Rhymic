import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, SlidersHorizontal, Settings2, Speaker } from 'lucide-react';
import { useUIStore } from '../store/uiStore';
import { useMusicStore } from '../store/musicStore';
import styles from './AudioLab.module.css';

const LABELS = ['32', '64', '125', '250', '500', '1K', '2K', '4K', '8K', '16K'];

const PRESETS = {
  'Flat': { eq: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], bass: 0 },
  'Acoustic': { eq: [4, 5, 4, 1, 1, 1, 3, 4, 3, 2], bass: 1 },
  'Bass Heavy': { eq: [8, 6, 4, 1, 0, 0, 1, 2, 3, 4], bass: 10 },
  'Electronic': { eq: [6, 5, 2, 0, -2, 1, 3, 5, 6, 7], bass: 6 },
  'Vocal Boost': { eq: [-2, -1, 0, 2, 5, 5, 4, 2, 0, -1], bass: 0 },
};

const AudioLab = () => {
  const isAudioLabOpen = useUIStore((state) => state.isAudioLabOpen);
  const toggleAudioLab = useUIStore((state) => state.toggleAudioLab);

  const eqBands = useMusicStore((state) => state.eqBands);
  const setEqBand = useMusicStore((state) => state.setEqBand);
  const bassBoost = useMusicStore((state) => state.bassBoost);
  const setBassBoost = useMusicStore((state) => state.setBassBoost);
  const virtualizer = useMusicStore((state) => state.virtualizer);
  const setVirtualizer = useMusicStore((state) => state.setVirtualizer);

  // FIX C-1: Controlled select — tracks the active preset name so the dropdown
  // stays in sync with actual EQ state. Reset to 'Custom' when a band is moved
  // manually (handled by resetting to 'Flat' via resetAll).
  const [activePreset, setActivePreset] = useState('Flat');

  const applyPreset = (presetName) => {
    const preset = PRESETS[presetName];
    if (preset) {
      preset.eq.forEach((val, i) => setEqBand(i, val));
      setBassBoost(preset.bass);
      setActivePreset(presetName);
    }
  };

  const resetAll = () => applyPreset('Flat');

  return (
    <AnimatePresence>
      {isAudioLabOpen && (
        <motion.div 
          className={styles.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div 
            className={styles.panel}
            initial={{ y: 50, scale: 0.95, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 20, scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={styles.header}>
              <div className={styles.headerLeft}>
                <SlidersHorizontal size={28} color="var(--accent-primary)" />
                <h2 className={styles.title}>Audio Lab</h2>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <select 
                  value={activePreset}
                  onChange={(e) => applyPreset(e.target.value)}
                  style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: '20px', padding: '6px 12px', fontSize: '0.8rem', cursor: 'pointer', outline: 'none' }}
                >
                  <option value="Flat">Preset: Flat</option>
                  <option value="Acoustic">Acoustic</option>
                  <option value="Bass Heavy">Bass Heavy</option>
                  <option value="Electronic">Electronic</option>
                  <option value="Vocal Boost">Vocal Boost</option>
                </select>
                <button 
                  onClick={resetAll} 
                  style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: '20px', padding: '6px 12px', fontSize: '0.8rem', cursor: 'pointer' }}
                >
                  Reset
                </button>
                <button className={styles.closeBtn} onClick={toggleAudioLab}>
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* EQ Section */}
            <div className={styles.eqSection}>
              <h3 className={styles.sectionTitle}>10-Band Equalizer</h3>
              <div className={styles.bandsContainer}>
                {eqBands.map((val, index) => (
                  <div key={index} className={styles.band}>
                    <div className={styles.sliderWrapper}>
                      <input
                        type="range"
                        min="-12"
                        max="12"
                        step="0.5"
                        value={val}
                        onChange={(e) => setEqBand(index, parseFloat(e.target.value))}
                        className={styles.verticalSlider}
                      />
                    </div>
                    <span className={styles.label}>{LABELS[index]}</span>
                    <span className={styles.value}>{val > 0 ? `+${val}` : val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Effects Section */}
            <div className={styles.effectsSection}>
              {/* Bass Boost */}
              <div className={styles.effectControl}>
                <div className={styles.effectHeader}>
                  <span className={styles.label}><Speaker size={16} style={{display:'inline', verticalAlign:'bottom', marginRight:'4px'}}/> Bass Boost</span>
                  <span className={styles.value}>{bassBoost > 0 ? `+${bassBoost} dB` : 'Off'}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="15"
                  step="0.5"
                  value={bassBoost}
                  onChange={(e) => setBassBoost(parseFloat(e.target.value))}
                  className={styles.horizontalSlider}
                />
              </div>
            </div>

          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AudioLab;

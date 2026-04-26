import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMusicStore } from '../store/musicStore';
import styles from './MoodOrb.module.css';

const moodThemes = {
  "Energetic": {
    primary: "#e63946",
    secondary: "#ff4d6d",
    glow: "rgba(230, 57, 70, 0.4)"
  },
  "Chill": {
    primary: "#4cc9f0",
    secondary: "#48cae4",
    glow: "rgba(76, 201, 240, 0.4)"
  },
  "Melancholy": {
    primary: "#7209b7",
    secondary: "#560bad",
    glow: "rgba(114, 9, 183, 0.4)"
  },
  "Euphoric": {
    primary: "#c8a44e", // Rhymic Gold
    secondary: "#e8c65a",
    glow: "rgba(200, 164, 78, 0.4)"
  },
  "Focus": {
    primary: "#2a9d8f",
    secondary: "#264653",
    glow: "rgba(42, 157, 143, 0.4)"
  },
  "Romantic": {
    primary: "#f72585",
    secondary: "#b5179e",
    glow: "rgba(247, 37, 133, 0.4)"
  },
  "Loading...": {
    primary: "#c8a44e",
    secondary: "#e8c65a",
    glow: "rgba(200, 164, 78, 0.2)"
  }
};

const MoodOrb = () => {
  const currentMood = useMusicStore(state => state.currentMood);

  useEffect(() => {
    if (!currentMood) return;

    const theme = moodThemes[currentMood] || moodThemes["Chill"];

    // Dynamic theming via CSS Variables
    const root = document.documentElement;
    root.style.setProperty('--accent-primary', theme.primary);
    root.style.setProperty('--accent-secondary', theme.secondary);
    root.style.setProperty('--accent-glow', theme.glow);
    root.style.setProperty('--glass-border-glow', theme.glow);

  }, [currentMood]);

  if (!currentMood) return null;

  return (
    <div className={styles.orbContainer}>
      <AnimatePresence mode="wait">
        <motion.div
           key={currentMood}
           className={styles.moodLabel}
           initial={{ opacity: 0, x: -20 }}
           animate={{ opacity: 1, x: 0 }}
           exit={{ opacity: 0, x: 10 }}
           transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
           <div className={styles.orbIndicator} style={{ backgroundColor: moodThemes[currentMood]?.primary || '#4cc9f0'}}>
             {currentMood === "Loading..." && <div className={styles.spinner} />}
           </div>
           <span>{currentMood}</span>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default MoodOrb;

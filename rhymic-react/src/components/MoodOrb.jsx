import React, { useEffect } from 'react';
/* eslint-disable-next-line no-unused-vars */
import { motion, AnimatePresence } from 'framer-motion';
import { useMusicStore } from '../store/musicStore';
import styles from './MoodOrb.module.css';

const moodThemes = {
  "Energetic": {
    primary: "#ff3b30", // Sleeker red
    secondary: "#ff4d6d",
    glow: "rgba(255, 59, 48, 0.3)",
    text: "#ffffff"
  },
  "Chill": {
    primary: "#4cc9f0",
    secondary: "#48cae4",
    glow: "rgba(76, 201, 240, 0.3)",
    text: "#000000"
  },
  "Melancholy": {
    primary: "#9b51e0", // Softer purple
    secondary: "#a29bfe",
    glow: "rgba(155, 81, 224, 0.3)",
    text: "#ffffff"
  },
  "Euphoric": {
    primary: "#c8a44e", // RhyMic Gold
    secondary: "#e8c65a",
    glow: "rgba(200, 164, 78, 0.3)",
    text: "#000000"
  },
  "Focus": {
    primary: "#2a9d8f",
    secondary: "#264653",
    glow: "rgba(42, 157, 143, 0.3)",
    text: "#ffffff"
  },
  "Romantic": {
    primary: "#f72585",
    secondary: "#b5179e",
    glow: "rgba(247, 37, 133, 0.3)",
    text: "#ffffff"
  },
  "Loading...": {
    primary: "#c8a44e",
    secondary: "#e8c65a",
    glow: "rgba(200, 164, 78, 0.2)",
    text: "#000000"
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
    root.style.setProperty('--accent-text', theme.text || '#000000');

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

import React, { useState } from 'react';
/* eslint-disable-next-line no-unused-vars */
import { motion, AnimatePresence } from 'framer-motion';
import styles from './SmartDJ.module.css';
import { useMusicStore } from '../store/musicStore';

import { smartDjApi, playlistsApi } from '../services/api';
import { Sparkles, Play, Save, RefreshCw } from 'lucide-react';
import SongCover from './SongCover';

const MOOD_CHIPS = ["Chill vibes", "Late night drive", "Workout heavy", "Focus mode", "Rainy day", "Party time"];

const cardFlipVariants = {
  hidden: { opacity: 0, rotateX: -90, y: 20 },
  visible: (i) => ({
    opacity: 1, 
    rotateX: 0, 
    y: 0,
    transition: { 
      delay: i * 0.1, 
      type: "spring", 
      stiffness: 260, 
      damping: 20 
    }
  })
};

const SmartDJ = () => {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedSongs, setGeneratedSongs] = useState([]);
  const [statusLabel, setStatusLabel] = useState('Generated Playlist'); 
  const [isSaving, setIsSaving] = useState(false);
  const [source, setSource] = useState('');

  const setSongs = useMusicStore((state) => state.setSongs);
  const setCurrentSong = useMusicStore((state) => state.setCurrentSong);
  
  // Access local library for offline fallback
  const allLocalSongs = useMusicStore((state) => state.songs);

  const handleGenerate = async (e, isRegenerate = false) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!prompt.trim()) return;

    setIsLoading(true);
    setGeneratedSongs([]); 
    setStatusLabel('Generating...');
    setSource('');

    // 1. Setup Timeout (45 Seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    try {
      const response = await smartDjApi.recommend(prompt, isRegenerate);

      clearTimeout(timeoutId); // Clear timeout if successful

      const data = response.data; // Now returns { title: "...", songs: [...] }
      
      const processed = data.songs.map(s => ({
         ...s,
         cover: s.cover,
         src: s.src
      }));
      
      setStatusLabel(data.title || prompt.charAt(0).toUpperCase() + prompt.slice(1));
      setSource(data.source || '');
      setGeneratedSongs(processed);
      if (processed.length > 0) setSongs(processed);

    } catch (error) {
      console.error("SmartDJ Error:", error);
      
      // Check if it's a quota error (429) from our backend
      const isQuotaError = error.response?.data?.error?.includes('quota') || error.response?.status === 429;
      const errorMsg = isQuotaError ? 'AI Limit Reached' : 'Offline Mix';

      if (allLocalSongs.length > 0) {
        // IMPROVED FALLBACK: Keyword search in local library
        const keywords = prompt.toLowerCase().split(' ');
        const matches = allLocalSongs.filter(s => 
          keywords.some(k => s.title.toLowerCase().includes(k) || s.artist.toLowerCase().includes(k))
        );
        
        const fallback = matches.length > 0 ? matches.slice(0, 10) : [...allLocalSongs].sort(() => 0.5 - Math.random()).slice(0, 10);
        
        setGeneratedSongs(fallback);
        setSongs(fallback);
        setStatusLabel(matches.length > 0 ? `Local Matches: ${prompt}` : errorMsg);
        setSource('local');
      } else {
        alert(isQuotaError ? "Gemini Daily Limit Reached. Please try again tomorrow!" : "Could not generate playlist.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleChipClick = (chipText) => {
    setPrompt(chipText);
    // Auto submit behavior can be triggered here if desired, 
    // but typically users might want to append to it. Let's just set it for now.
  };

  const handleSavePlaylist = async () => {
    if (!generatedSongs.length) return;
    setIsSaving(true);
    try {
      const pRes = await playlistsApi.create(statusLabel);
      const pid = pRes.data.id;
      for (const s of generatedSongs) {
        await playlistsApi.addSong(pid, s);
      }
      // Force global store to refetch playlists so Sidebar updates immediately
      useMusicStore.getState().fetchPlaylists();
      alert(`Playlist "${statusLabel}" created!`);
    } catch (e) {
      console.error(e);
      alert("Failed to save playlist");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.auroraBackground}></div>
      <div className={styles.content}>
        <motion.div 
          className={styles.iconWrapper}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
        >
          <Sparkles size={40} color="#ffffff" />
        </motion.div>
        
        <motion.h1 
          className={styles.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          AI Smart DJ
        </motion.h1>
        
        <motion.p 
          className={styles.subtitle}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          Tell me how you're feeling, and I'll build the perfect playlist.
        </motion.p>

        {/* Phase 7: Mood Chips */}
        <motion.div 
          className={styles.chipsContainer}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          {MOOD_CHIPS.map(chip => (
            <div 
              key={chip} 
              className={styles.chip}
              onClick={() => handleChipClick(chip)}
            >
              {chip}
            </div>
          ))}
        </motion.div>

        <motion.form 
          onSubmit={handleGenerate} 
          className={styles.form}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <input
            type="text"
            className={styles.input}
            placeholder="e.g. 'Gym motivation' or 'Sad songs'"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isLoading}
          />
          <button type="submit" className={styles.button} disabled={isLoading}>
            {isLoading ? 'Thinking...' : 'Generate Vibe'}
          </button>
        </motion.form>

        {/* Results */}
        <AnimatePresence>
          {generatedSongs.length > 0 && (
            <motion.div 
              className={styles.results}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <h3 className={styles.resultsTitle}>{statusLabel}</h3>
              <div className={styles.songGrid}>
                {generatedSongs.map((song, i) => (
                  <motion.div 
                    key={song.id} 
                    custom={i}
                    variants={cardFlipVariants}
                    initial="hidden"
                    animate="visible"
                    className={styles.miniCard} 
                    onClick={() => setCurrentSong(song)}
                    whileHover={{ scale: 1.02, y: -2 }}
                  >
                    <SongCover 
                      src={song.cover} 
                      alt={song.title} 
                      size="small" 
                      className={styles.songImage} 
                    />
                    <div className={styles.miniInfo}>
                      <h4>{song.title}</h4>
                      <p>{song.artist}</p>
                    </div>
                    <div className={styles.playingIcon}><Play size={16} fill="white"/></div>
                  </motion.div>
                ))}
              </div>
              
              {source === "local" && (
                <p className={styles.djFallbackNote}>
                  Showing local results — AI DJ is resting 💤
                </p>
              )}

              {/* Phase 7: Action Buttons */}
              <div className={styles.actionButtons}>
                <button 
                  className={styles.secondaryBtn}
                  onClick={handleSavePlaylist}
                  disabled={isSaving}
                >
                  <Save size={18} />
                  {isSaving ? "Saving..." : "Save to Playlist"}
                </button>
                <button 
                  className={styles.secondaryBtn}
                  onClick={() => handleGenerate(null, true)}
                  disabled={isLoading}
                >
                  <RefreshCw size={18} className={isLoading ? styles.spin : ""} />
                  Regenerate
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default SmartDJ;

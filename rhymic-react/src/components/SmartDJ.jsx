import React, { useState } from 'react';
import styles from './SmartDJ.module.css';
import { useMusicStore } from '../store/musicStore';
import { useAuthStore } from '../store/authStore';
import { Sparkles, Play } from 'lucide-react';

const SmartDJ = () => {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedSongs, setGeneratedSongs] = useState([]);
  const [statusLabel, setStatusLabel] = useState('Generated Playlist'); // UI Feedback
  
  const token = useAuthStore((state) => state.token);
  const setSongs = useMusicStore((state) => state.setSongs);
  const setCurrentSong = useMusicStore((state) => state.setCurrentSong);
  
  // Access local library for offline fallback
  const allLocalSongs = useMusicStore((state) => state.songs);

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsLoading(true);
    setGeneratedSongs([]); 
    setStatusLabel('Generated Playlist');

    // 1. Setup Timeout (10 Seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch('http://127.0.0.1:5000/api/ai/recommend', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ prompt: prompt }),
        signal: controller.signal // Attach signal
      });

      clearTimeout(timeoutId); // Clear timeout if successful

      if (response.ok) {
        const data = await response.json();
        const BASE_URL = 'http://127.0.0.1:5000';
        const processed = data.map(s => ({
           ...s,
           cover: s.cover.startsWith('http') ? s.cover : `${BASE_URL}${s.cover}`,
           src: s.src.startsWith('http') ? s.src : `${BASE_URL}${s.src}`
        }));
        
        setGeneratedSongs(processed);
        if (processed.length > 0) setSongs(processed);
      } else {
        throw new Error("Server error");
      }

    } catch (error) {
      // 2. Handle Timeout / Error -> Use Local Fallback
      
      if (allLocalSongs.length > 0) {
        // Shuffle local songs
        const shuffled = [...allLocalSongs].sort(() => 0.5 - Math.random());
        const fallback = shuffled.slice(0, 10); // Pick 10 random
        
        setGeneratedSongs(fallback);
        setSongs(fallback);
        setStatusLabel('Offline Mix (AI Unavailable)'); // Tell user
      } else {
        alert("Could not generate playlist (Library empty).");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.iconWrapper}>
          <Sparkles size={40} color="#ffffff" />
        </div>
        <h1 className={styles.title}>AI Smart DJ</h1>
        <p className={styles.subtitle}>
          Tell me how you're feeling, and I'll build the perfect playlist.
        </p>

        <form onSubmit={handleGenerate} className={styles.form}>
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
        </form>

        {/* Results */}
        {generatedSongs.length > 0 && (
          <div className={styles.results}>
            <h3 className={styles.resultsTitle}>{statusLabel}</h3>
            <div className={styles.songGrid}>
              {generatedSongs.map(song => (
                <div key={song.id} className={styles.miniCard} onClick={() => setCurrentSong(song)}>
                  <img src={song.cover} alt="" />
                  <div className={styles.miniInfo}>
                    <h4>{song.title}</h4>
                    <p>{song.artist}</p>
                  </div>
                  <div className={styles.playingIcon}><Play size={16} fill="white"/></div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SmartDJ;

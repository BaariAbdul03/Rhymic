import React, { useEffect, useState } from 'react';
import styles from './Hero.module.css';
import { useMusicStore } from '../store/musicStore';
import { useAuthStore } from '../store/authStore'; // Import Auth
import { Play, Heart, Check } from 'lucide-react'; // Import Check/Heart

const Hero = () => {
  const allSongs = useMusicStore((state) => state.songs);
  const setCurrentSong = useMusicStore((state) => state.setCurrentSong);
  
  // --- NEW: Get Like Actions ---
  const likedSongs = useMusicStore((state) => state.likedSongs);
  const toggleLike = useMusicStore((state) => state.toggleLike);
  const token = useAuthStore((state) => state.token);

  const [featuredSong, setFeaturedSong] = useState(null);

  useEffect(() => {
    // Only set a random song once on mount to prevent flickering
    if (allSongs.length > 0 && !featuredSong) {
      const randomIndex = Math.floor(Math.random() * allSongs.length);
      setFeaturedSong(allSongs[randomIndex]);
    }
  }, [allSongs, featuredSong]);

  if (!featuredSong) return null;

  const isLiked = likedSongs.includes(featuredSong.id);

  const handleLike = () => {
    if (!token) {
      alert("Please login to save favorites!");
      return;
    }
    toggleLike(featuredSong.id);
  };

  return (
    <div className={styles.heroContainer}>
      <div className={styles.content}>
        <span className={styles.tag}>Featured Track</span>
        <h1 className={styles.title}>{featuredSong.title}</h1>
        <h2 className={styles.artist}>{featuredSong.artist}</h2>
        
        <div className={styles.controls}>
          <button 
            className={styles.playButton}
            onClick={() => setCurrentSong(featuredSong)}
          >
            <Play size={20} fill="currentColor" />
            Listen Now
          </button>
          
          <button 
            className={`${styles.addButton} ${isLiked ? styles.added : ''}`}
            onClick={handleLike}
          >
            {isLiked ? <Check size={18} /> : <Heart size={18} />}
            {isLiked ? 'Added to Favorites' : 'Add to Favorites'}
          </button>
        </div>
      </div>

      <div className={styles.imageWrapper}>
        <img 
          src={featuredSong.cover} 
          alt={featuredSong.title} 
          className={styles.heroImage} 
        />
        <div 
          className={styles.blurBackdrop}
          style={{ backgroundImage: `url(${featuredSong.cover})` }}
        ></div>
      </div>
    </div>
  );
};

export default Hero;

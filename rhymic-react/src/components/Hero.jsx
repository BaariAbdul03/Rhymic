import React from 'react';
import { Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMusicStore } from '../store/musicStore';
import styles from './Hero.module.css';

const Hero = () => {
  const navigate = useNavigate();
  const songs = useMusicStore((state) => state.songs);
  const playNext = useMusicStore((state) => state.playNext);
  const setCurrentSong = useMusicStore((state) => state.setCurrentSong);

  // Pick a random song for the Hero Banner feature
  const [featuredSong, setFeaturedSong] = React.useState(null);

  React.useEffect(() => {
    if (songs && songs.length > 0 && !featuredSong) {
      const randomIndex = Math.floor(Math.random() * songs.length);
      setFeaturedSong(songs[randomIndex]);
    }
  }, [songs, featuredSong]);

  // Fallback if no songs loaded yet
  if (!songs || songs.length === 0 || !featuredSong) return null;

  const handlePlay = () => {
    useMusicStore.getState().setQueue(songs);
    setCurrentSong(featuredSong);
  };

  const handleAdd = () => {
    playNext(featuredSong);
    // Could also show a toast here
  };

  return (
    <div className={styles.heroContainer}>
      <div 
        className={styles.heroBackground}
        style={{ backgroundImage: `url(${featuredSong?.cover || 'https://images.unsplash.com/photo-1540039155733-d7696d4eb98b?q=80'})` }}
      >
        <div className={styles.gradientOverlay}></div>
      </div>
      
      <div className={styles.heroContent}>
        <div className={styles.contentLeft}>
          <span className={styles.featuredLabel}>• FEATURED ARTIST</span>
          <h1 
            className={styles.heroTitle}
            onClick={() => navigate(`/artist/${encodeURIComponent(featuredSong?.artist)}`)}
            style={{cursor: 'pointer'}}
          >
            {featuredSong?.artist || 'Unknown Artist'}
          </h1>
          <h2 className={styles.heroSubtitle}>{featuredSong?.title || 'Unknown Title'}</h2>
          
          <div className={styles.actionButtons}>
            <button className={styles.playButton} onClick={handlePlay}>
              <Play size={20} fill="currentColor" />
              Play
            </button>
            <button className={styles.addButton} onClick={handleAdd}>
              Add to Queue
            </button>
          </div>
        </div>
        
        {/* Adds a sharp crisp version of the cover floating slightly alongside the blurred bg for top-tier SaaS aesthetic */}
        <div className={styles.contentRight}>
          <img src={featuredSong?.cover} alt={featuredSong?.title} className={styles.featuredCoverImg} />
        </div>
      </div>
    </div>
  );
};

export default Hero;

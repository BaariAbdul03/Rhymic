import React, { useEffect, useState } from 'react';
import { Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
/* eslint-disable-next-line no-unused-vars */
import { motion } from 'framer-motion';
import { useMusicStore } from '../store/musicStore';
import SongCover from './SongCover';
import styles from './Hero.module.css';

const Hero = () => {
  const navigate = useNavigate();
  const songs = useMusicStore((state) => state.songs);
  const playNext = useMusicStore((state) => state.playNext);
  const setCurrentSong = useMusicStore((state) => state.setCurrentSong);
  
  const [featuredSong, setFeaturedSong] = useState(null);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    if (songs && songs.length > 0 && !featuredSong) {
      const randomIndex = Math.floor(Math.random() * songs.length);
      setFeaturedSong(songs[randomIndex]);
    }
  }, [songs, featuredSong]);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (!songs || songs.length === 0 || !featuredSong) return null;

  const handlePlay = () => {
    useMusicStore.getState().setQueue(songs);
    setCurrentSong(featuredSong);
  };

  const handleAdd = () => {
    playNext(featuredSong);
  };

  const labelVariants = {
    hidden: { opacity: 0, width: 0 },
    visible: { 
      opacity: 1, 
      width: 'auto',
      transition: { duration: 1, ease: 'easeOut' }
    }
  };

  return (
    <div className={styles.heroContainer}>
      <div 
        className={styles.heroBackground}
        style={{ 
          backgroundImage: `url("${featuredSong?.cover || 'https://images.unsplash.com/photo-1540039155733-d7696d4eb98b?q=80'}")`,
          transform: `scale(1.2) translateY(${scrollY * 0.3}px)`
        }}
      >
        <div className={styles.gradientOverlay}></div>
      </div>
      
      <div className={styles.heroContent}>
        <div className={styles.contentLeft}>
           <motion.div 
             className={styles.featuredLabelWrapper}
             initial="hidden"
             animate="visible"
             variants={labelVariants}
             style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}
           >
             <span className={styles.featuredLabel}>• FEATURED ARTIST</span>
           </motion.div>
          <motion.h1 
            className={styles.heroTitle}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            onClick={() => navigate(`/artist/${encodeURIComponent(featuredSong?.artist)}`)}
            style={{cursor: 'pointer'}}
          >
            {featuredSong?.artist || 'Unknown Artist'}
          </motion.h1>
          <motion.h2 
            className={styles.heroSubtitle}
             initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            {featuredSong?.title || 'Unknown Title'}
          </motion.h2>
          
          <motion.div 
            className={styles.actionButtons}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            <button className={styles.playButton} onClick={handlePlay}>
              <Play size={20} fill="currentColor" />
              Play
            </button>
            <button className={styles.addButton} onClick={handleAdd}>
              Add to Queue
            </button>
          </motion.div>
        </div>
        
        <motion.div 
          className={styles.contentRight}
          initial={{ opacity: 0, scale: 0.8, rotate: -5 }}
          animate={{ opacity: 1, scale: 1, rotate: 2 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.3 }}
        >
          <SongCover src={featuredSong?.cover} alt={featuredSong?.title} className={styles.featuredCoverImg} />
        </motion.div>
      </div>
    </div>
  );
};

export default Hero;

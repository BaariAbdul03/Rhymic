import React, { useEffect, useMemo, useState } from 'react';
import { Play, Radio } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
/* eslint-disable-next-line no-unused-vars */
import { motion } from 'motion/react';
import { useMusicStore } from '../store/musicStore';
import { streamApi } from '../services/api';
import SongCover from './SongCover';
import styles from './Hero.module.css';

const HERO_CHIPS = ['Hindi', 'English', 'Rap', 'Romantic', 'Retro'];

const Hero = ({ onlineSongs = [], onlineStatus = 'checking' }) => {
  const navigate = useNavigate();
  const songs = useMusicStore((state) => state.songs);
  const playNext = useMusicStore((state) => state.playNext);
  const setCurrentSong = useMusicStore((state) => state.setCurrentSong);
  const setQueue = useMusicStore((state) => state.setQueue);

  const [featuredSong, setFeaturedSong] = useState(null);
  const [heroSongs, setHeroSongs] = useState([]);
  const [heroIndex, setHeroIndex] = useState(0);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    if (onlineSongs.length > 0) {
      setHeroSongs(onlineSongs.slice(0, 8));
      setHeroIndex(0);
      return;
    }

    if (songs?.length > 0) {
      setHeroSongs(songs.slice(0, 8));
      setHeroIndex(0);
    }
  }, [onlineSongs, songs]);

  useEffect(() => {
    if (heroSongs.length > 0) {
      setFeaturedSong(heroSongs[heroIndex % heroSongs.length]);
    }
  }, [heroIndex, heroSongs]);

  useEffect(() => {
    if (heroSongs.length <= 1) return undefined;
    const timer = setInterval(() => {
      setHeroIndex((index) => (index + 1) % heroSongs.length);
    }, 9000);
    return () => clearInterval(timer);
  }, [heroSongs.length]);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const similarSongs = useMemo(() => {
    if (!featuredSong) return [];
    const genre = featuredSong.genre?.toLowerCase();
    return songs
      .filter((song) => song.id !== featuredSong.id)
      .filter((song) => (
        song.artist === featuredSong.artist ||
        (genre && song.genre?.toLowerCase().includes(genre))
      ))
      .slice(0, 10);
  }, [featuredSong, songs]);

  if (!featuredSong) return null;

  const sourceLabel = onlineSongs.length > 0
    ? 'Curated online pick'
    : onlineStatus === 'checking'
      ? 'Loading online catalog'
      : 'Local fallback';

  const handlePlay = () => {
    setQueue(heroSongs.length ? heroSongs : songs);
    setCurrentSong(featuredSong);
  };

  const handleAdd = () => {
    playNext(featuredSong);
  };

  const handlePlaySimilar = async () => {
    if (featuredSong.source === 'online') {
      try {
        const res = await streamApi.getRelated(featuredSong.id);
        const related = Array.isArray(res.data) && res.data.length > 0 ? res.data : heroSongs;
        setQueue(related);
        setCurrentSong(related[0] || featuredSong);
        return;
      } catch {
        // Local similarity below is the fallback.
      }
    }

    const queue = similarSongs.length ? [featuredSong, ...similarSongs] : (heroSongs.length ? heroSongs : songs);
    setQueue(queue);
    setCurrentSong(featuredSong);
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
            <span className={styles.featuredLabel}>{sourceLabel}</span>
          </motion.div>
          <motion.h1
            className={styles.heroTitle}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            onClick={() => navigate(`/artist/${encodeURIComponent(featuredSong?.artist)}`)}
            style={{ cursor: 'pointer' }}
          >
            {featuredSong?.title || 'Unknown Title'}
          </motion.h1>
          <motion.h2
            className={styles.heroSubtitle}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            {featuredSong?.artist || 'Unknown Artist'}
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
            <button className={styles.addButton} onClick={handlePlaySimilar}>
              <Radio size={18} />
              Play Similar
            </button>
            <button className={styles.addButton} onClick={handleAdd}>
              Add to Queue
            </button>
          </motion.div>

          <div className={styles.genreChips}>
            {HERO_CHIPS.map((chip) => (
              <button key={chip} className={styles.genreChip} onClick={() => navigate(`/discover?category=${encodeURIComponent(chip)}`)}>
                {chip}
              </button>
            ))}
          </div>
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

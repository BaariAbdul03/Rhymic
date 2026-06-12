import React, { useRef, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { motion } from 'motion/react';
import { useMusicStore } from '../store/musicStore';
import toast from 'react-hot-toast';
import SongCover from './SongCover';
import styles from './CategoryRow.module.css';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08
    }
  }
};

const cardVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 10 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 20 } }
};

const CategoryRow = ({ playlist, songs: rowOverride }) => {
  const scrollRef = useRef(null);
  
  const songs = useMusicStore((state) => state.songs);
  const setCurrentSong = useMusicStore((state) => state.setCurrentSong);
  const aiCategories = useMusicStore(state => state.aiCategories);

  // Memoize the filtering logic to prevent expensive re-calculations on every render
  const rowSongs = useMemo(() => {
    if (rowOverride && rowOverride.length > 0) {
      return rowOverride.slice(0, 10);
    }

    if (!songs || songs.length === 0) return [];

    let filtered = [];
    
    // 1. Try AI Categorization (Gold Standard)
    if (aiCategories && aiCategories[playlist.name]) {
      const aiMappedIds = aiCategories[playlist.name];
      filtered = aiMappedIds.map(id => songs.find(s => s.id === id)).filter(Boolean);
    } 
    // 2. Try strict metadata matching fallback
    else if (playlist.songs && playlist.songs.length > 0) {
      filtered = playlist.songs;
    } else {
      filtered = songs.filter(s => {
        const cat = playlist.name.toLowerCase();
        const isInPath = s.src?.toLowerCase().includes(cat);
        const isInTitle = s.title?.toLowerCase().includes(cat);
        const isInArtist = s.artist?.toLowerCase().includes(cat);
        const isInGenre = s.genre?.toLowerCase().includes(cat);
        
        // Match if category is in path (local) OR if it matches metadata keywords (online/local)
        return isInPath || isInTitle || isInArtist || isInGenre;
      });
    }

    // If still empty, return empty array to avoid showing unrelated songs
    if (!filtered || filtered.length === 0) {
       filtered = [];
    } else {
       filtered = filtered.slice(0, 10);
    }
    
    return filtered;
  }, [songs, rowOverride, aiCategories, playlist.id, playlist.name, playlist.songs]);

  if (rowSongs.length === 0) return null;

  const scrollLeft = () => {
    if (scrollRef.current) scrollRef.current.scrollBy({ left: -300, behavior: 'smooth' });
  };

  const scrollRight = () => {
    if (scrollRef.current) scrollRef.current.scrollBy({ left: 300, behavior: 'smooth' });
  };

  const handlePlayClick = (e, song) => {
    e.stopPropagation();
    setCurrentSong(song);
  };

  return (
    <div className={styles.categoryContainer}>
      <div className={styles.header}>
        <h2 className={styles.title}>{playlist.name}</h2>
        <div className={styles.controls}>
          <button className={styles.navBtn} onClick={scrollLeft}>
            <ChevronLeft size={20} />
          </button>
          <button className={styles.navBtn} onClick={scrollRight}>
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className={styles.scrollWrapper}>
        <motion.div 
          className={styles.scrollContainer} 
          ref={scrollRef}
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          viewport={{ once: true, amount: 0.1 }}
        >
          {rowSongs.map((song) => (
            <motion.div 
              variants={cardVariants}
              key={song.id} 
              className={styles.card} 
              onClick={() => setCurrentSong(song)}
              whileHover={{ y: -8, scale: 1.02 }}
            >
              <div className={styles.coverContainer}>
                <SongCover src={song.cover} alt={song.title} />
                <div className={styles.playOverlay}>
                  <button 
                    className={styles.playBtn}
                    onClick={(e) => handlePlayClick(e, song)}
                  >
                    <Play size={20} fill="currentColor" />
                  </button>
                </div>
              </div>
              <h3 className={styles.songTitle}>{song.title}</h3>
              <div className={styles.songMeta}>
                <p className={styles.songArtist}>{song.artist}</p>
                {song.source === 'online' && <span className={styles.sourceBadge}>Online</span>}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
};

export default CategoryRow;

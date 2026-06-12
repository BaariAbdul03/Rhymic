import React, { useState, useEffect } from 'react';
/* eslint-disable-next-line no-unused-vars */
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Flame, Globe, Play, SignalHigh, Clock } from 'lucide-react';
import { streamApi } from '../services/api';
import { useMusicStore } from '../store/musicStore';
import SongCover from './SongCover';
import { preloadImages } from '../utils/preloadImages';
import HostedDemoNotice from './HostedDemoNotice';
import styles from './OnlineSearch.module.css';

const OnlineSearch = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [trending, setTrending] = useState([]);
  const [streamStatus, setStreamStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  
  const setCurrentSong = useMusicStore((state) => state.setCurrentSong);
  const setQueue = useMusicStore((state) => state.setQueue);
  const isPlaying = useMusicStore((state) => state.isPlaying);
  const currentSong = useMusicStore((state) => state.currentSong);

  useEffect(() => {
    // Fetch trending on mount
    const fetchTrending = async () => {
      try {
        const statusRes = await streamApi.status();
        setStreamStatus(statusRes.data);
        if (statusRes.data?.enabled === false) return;

        const res = await streamApi.getTrending();
        preloadImages(res.data, 18);
        setTrending(res.data);
      } catch (error) {
        console.error("Failed to load trending:", error);
      }
    };
    fetchTrending();
  }, []);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim() || streamStatus?.enabled === false) return;
    
    setIsLoading(true);
    setHasSearched(true);
    try {
      const res = await streamApi.search(query);
      preloadImages(res.data, 18);
      setResults(res.data);
    } catch (error) {
      console.error("Search failed:", error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlay = async (song, pool) => {
    // Immediately start playing the selected song with the current pool as a temp queue
    setQueue([song]);
    setCurrentSong(song);
    
    // In the background, fetch a radio mix of related songs for the queue
    try {
      const res = await streamApi.getRelated(song.id);
      if (res.data && res.data.length > 0) {
        setQueue(res.data);
      }
    } catch {
      console.error("Failed to fetch related songs, keeping search results as queue");
      // Fallback: use the original pool (search results or trending)
      setQueue(pool);
    }
  };

  const renderSongList = (songs) => (
    <div className={styles.songGrid}>
      {songs.map((song, i) => {
        const active = currentSong?.id === song.id;
        return (
          <motion.div 
            key={song.id} 
            className={`${styles.songCard} ${active ? styles.activeCard : ''}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => handlePlay(song, songs)}
          >
            <div className={styles.imageContainer}>
              <SongCover 
                src={song.cover} 
                alt={song.title} 
                className={styles.resultImage} 
              />
              <div className={styles.playOverlay}>
                {active && isPlaying ? <SignalHigh size={24} className={styles.playingIcon}/> : <Play size={24} fill="currentColor" />}
              </div>
            </div>
            <div className={styles.songInfo}>
              <h4 className={styles.truncate}>{song.title}</h4>
              <p className={styles.truncate}>{song.artist}</p>
              <div className={styles.songBadges}>
                <span className={styles.duration}><Clock size={14} /> {song.duration || '--:--'}</span>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className={styles.titleSection}
        >
          <div className={styles.iconBox}><Globe size={32}/></div>
          <div>
            <h1>Global Database</h1>
            <p>
              {streamStatus?.enabled === false
                ? 'Catalog browsing is paused in this hosted portfolio deployment.'
                : 'Stream directly from the unified public music index.'}
            </p>
          </div>
          <span className={`${styles.statusPill} ${streamStatus?.enabled === false || !streamStatus ? '' : styles.online}`}>
            {!streamStatus ? 'Checking online catalog' : streamStatus.enabled === false ? 'Hosted demo mode' : 'Online catalog active'}
          </span>
        </motion.div>

        <motion.form 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          onSubmit={handleSearch} 
          className={styles.searchForm}
        >
          <Search size={20} className={styles.searchIcon} />
          <input 
            type="text" 
            placeholder={streamStatus?.enabled === false ? 'Online search disabled in hosted demo' : 'Search millions of songs...'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={styles.searchInput}
            disabled={streamStatus?.enabled === false}
          />
          <button type="submit" disabled={isLoading || streamStatus?.enabled === false} className={styles.searchBtn}>
            {isLoading ? 'Searching...' : 'Search'}
          </button>
        </motion.form>
      </div>

      <div className={styles.content}>
        {streamStatus?.enabled === false && (
          <HostedDemoNotice compact />
        )}
        <AnimatePresence mode="wait">
          {streamStatus?.enabled === false ? null : !hasSearched ? (
            <motion.div 
              key="trending"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <h2 className={styles.sectionTitle}><Flame size={20} color="var(--accent-primary)"/> Today's Top Streams</h2>
              {trending.length > 0 ? renderSongList(trending) : <div className={styles.loading}>Loading trends...</div>}
            </motion.div>
          ) : (
            <motion.div 
               key="results"
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
            >
              <h2 className={styles.sectionTitle}>
                {results.length > 0 ? 'Search Results' : (isLoading ? 'Searching...' : 'No results found')}
              </h2>
              {renderSongList(results)}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default OnlineSearch;

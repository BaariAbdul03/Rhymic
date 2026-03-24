import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { useMusicStore } from '../store/musicStore';
import styles from './CategoryRow.module.css';

const CategoryRow = ({ playlist }) => {
  const scrollRef = useRef(null);
  
  // Need to fetch songs for this playlist if not already loaded in a real app.
  // We'll mimic this behavior using all songs for now, to keep the UI populated.
  const songs = useMusicStore((state) => state.songs);
  const setCurrentSong = useMusicStore((state) => state.setCurrentSong);
  const playNext = useMusicStore((state) => state.playNext);

  if (!songs || songs.length === 0) return null;

  const aiCategories = useMusicStore(state => state.aiCategories);

  let rowSongs = [];

  // 1. Try AI Categorization (Gold Standard)
  if (aiCategories && aiCategories[playlist.name]) {
    const aiMappedIds = aiCategories[playlist.name];
    rowSongs = aiMappedIds.map(id => songs.find(s => s.id === id)).filter(Boolean);
  } 
  // 2. Try strict metadata matching fallback
  else if (playlist.songs && playlist.songs.length > 0) {
    rowSongs = playlist.songs;
  } else {
    rowSongs = songs.filter(s => 
      s.src?.toLowerCase().includes(playlist.name.toLowerCase()) || 
      s.genre?.toLowerCase().includes(playlist.name.toLowerCase()) || 
      s.artist?.toLowerCase().includes(playlist.name.toLowerCase())
    );
  }

  // Fallback to a deterministic random mix if the explicit filter returns empty,
  // preventing the UI from looking broken while keeping rows uniquely distributed.
  if (!rowSongs || rowSongs.length === 0) {
     const startIndex = (playlist.id * 3) % songs.length;
     rowSongs = [...songs.slice(startIndex), ...songs.slice(0, startIndex)].slice(0, 10);
  } else {
     rowSongs = rowSongs.slice(0, 10);
  }

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
        <div className={styles.scrollContainer} ref={scrollRef}>
          {rowSongs.map((song) => (
            <div key={song.id} className={styles.card} onClick={() => playNext(song)}>
              <div className={styles.coverContainer}>
                <img src={song.cover} alt={song.title} className={styles.cover} />
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
              <p className={styles.songArtist}>{song.artist}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CategoryRow;
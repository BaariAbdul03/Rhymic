import { useEffect, useState } from 'react';
import { Play, Heart, ListPlus, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
/* eslint-disable-next-line no-unused-vars */
import { motion } from 'framer-motion';
import { useMusicStore } from '../store/musicStore';
import toast from 'react-hot-toast';
import SongCover from './SongCover';
import styles from './TopSongs.module.css';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
};

const rowVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

const formatDuration = (seconds) => {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value <= 0) return '';
  const mins = Math.floor(value / 60);
  const secs = Math.floor(value % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const getKnownDuration = (song) => {
  const raw = song.duration || song.duration_text || song.length || song.length_text;
  if (typeof raw === 'string' && raw.includes(':')) return raw;
  if (typeof raw === 'number') return formatDuration(raw);
  if (typeof raw === 'string' && raw.trim() && !Number.isNaN(Number(raw))) {
    return formatDuration(Number(raw));
  }

  const seconds = song.duration_seconds || song.durationSeconds || song.length_seconds || song.lengthSeconds;
  return formatDuration(seconds);
};

const TopSongs = ({ limit, hideHeader, songs: songsOverride }) => {
  const navigate = useNavigate();
  const librarySongs = useMusicStore((state) => state.songs);
  const currentSong = useMusicStore((state) => state.currentSong);
  const isPlaying = useMusicStore((state) => state.isPlaying);
  const setCurrentSong = useMusicStore((state) => state.setCurrentSong);
  const togglePlay = useMusicStore((state) => state.togglePlay);
  const toggleLike = useMusicStore((state) => state.toggleLike);
  const likedSongs = useMusicStore((state) => state.likedSongs);
  const [metadataDurations, setMetadataDurations] = useState({});

  const songs = songsOverride || librarySongs || [];
  const displaySongs = limit ? songs.slice(0, limit) : songs;

  useEffect(() => {
    const pendingSongs = displaySongs.filter((song) => {
      if (getKnownDuration(song) || metadataDurations[song.id]) return false;
      return Boolean(song.src || song.url || song.audio_url || song.file_url);
    });

    if (pendingSongs.length === 0) return undefined;

    const audioElements = pendingSongs.map((song) => {
      const audio = new Audio();
      audio.preload = 'metadata';
      audio.src = song.src || song.url || song.audio_url || song.file_url;
      audio.onloadedmetadata = () => {
        const formatted = formatDuration(audio.duration);
        if (formatted) {
          setMetadataDurations((current) => ({ ...current, [song.id]: formatted }));
        }
      };
      audio.load();
      return audio;
    });

    return () => {
      audioElements.forEach((audio) => {
        audio.onloadedmetadata = null;
        audio.src = '';
      });
    };
  }, [displaySongs, metadataDurations]);

  if (!songs || songs.length === 0) return null;

  const getDuration = (song) => {
    const known = getKnownDuration(song);
    if (known) return known;
    if (metadataDurations[song.id]) return metadataDurations[song.id];
    return '--:--';
  };

  const handlePlayClick = (song) => {
    if (currentSong?.id === song.id) {
      togglePlay();
    } else {
      useMusicStore.setState({ queue: displaySongs });
      setCurrentSong(song);
    }
  };

  return (
    <div className={styles.tableContainer}>
      {!hideHeader && (
        <div className={styles.tableHeader}>
          <div className={styles.colIndex}>#</div>
          <div className={styles.colTitle}>TITLE</div>
          <div className={styles.colTime}><Clock size={16}/></div>
          <div className={styles.colAction}></div>
        </div>
      )}
      
      <motion.div 
        className={styles.tableBody}
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {displaySongs.map((song, index) => {
          const isActive = currentSong?.id === song.id;
          const isLiked = likedSongs.includes(song.id);

          return (
            <motion.div 
              key={song.id} 
              variants={rowVariants}
              className={`${styles.tableRow} ${isActive ? styles.activeRow : ''}`}
            >
              <div className={styles.colIndex}>
                 {isActive && isPlaying ? (
                    <div className={styles.equalizer}>
                      <span className={styles.bar}></span>
                      <span className={styles.bar}></span>
                      <span className={styles.bar}></span>
                    </div>
                 ) : (
                    <span className={styles.indexNumber}>{index + 1}</span>
                 )}
                 <button className={styles.playOverlay} onClick={() => handlePlayClick(song)}>
                   <Play size={16} fill="currentColor" />
                 </button>
              </div>
              
              <div className={styles.colTitle}>
                <SongCover 
                  src={song.cover} 
                  alt={song.title} 
                  size="small" 
                  className={styles.songCover} 
                />
                <div className={styles.songInfo}>
                  <p className={`${styles.songName} ${isActive ? styles.activeText : ''}`}>
                    {song.title}
                  </p>
                  <p 
                    className={styles.artistName} 
                    onClick={(e) => {
                      e.stopPropagation();
                       navigate(`/artist/${encodeURIComponent(song.artist)}`);
                    }}
                    style={{cursor: 'pointer'}}
                  >
                    {song.artist}
                  </p>
                </div>
              </div>
              
              <div className={styles.colTime}>
                {getDuration(song)}
              </div>
              
              <div className={styles.colAction}>
                <button className={styles.actionBtn} onClick={() => toggleLike(song)}>
                  <Heart size={18} fill={isLiked ? "var(--accent-primary)" : "none"} color={isLiked ? "var(--accent-primary)" : "var(--text-secondary)"}/>
                </button>
                <button 
                  className={styles.actionBtn} 
                  onClick={(e) => {
                    e.stopPropagation();
                    useMusicStore.getState().addToQueue(song);
                    toast.success('Added to Queue');
                  }}
                  title="Add to Queue"
                >
                  <ListPlus size={20} />
                </button>
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
};

export default TopSongs;

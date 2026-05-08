import React, { useRef, useState, useEffect } from 'react';
/* eslint-disable-next-line no-unused-vars */
import { motion, AnimatePresence } from 'framer-motion';
import { useMusicStore } from '../store/musicStore';
import toast from 'react-hot-toast';
import { Play, Upload, Trash2, Music, ListPlus, Shuffle } from 'lucide-react';
import styles from './UploadMetadata.module.css';
import SongCover from './SongCover';

const UploadMetadata = () => {
  const fileInputRef = useRef(null);
  const addToQueue = useMusicStore(state => state.addToQueue);
  const setCurrentSong = useMusicStore(state => state.setCurrentSong);
  const setQueue = useMusicStore(state => state.setQueue);
  
  const [localSongs, setLocalSongs] = useState([]);

  // Load from session storage if available (urls will be broken on refresh anyway, but labels might persist)
  useEffect(() => {
    const saved = localStorage.getItem('rhymic_local_session');
    if (saved) {
      // Note: blob URLs won't work across refreshes, so we actually should clear this on mount 
      // or just accept they are session-only.
      localStorage.removeItem('rhymic_local_session');
    }
  }, []);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const newSongs = [];
    files.forEach((file) => {
      // Check if it's an audio file
      if (!file.type.startsWith('audio/')) {
        toast.error(`${file.name} is not a valid audio file.`);
        return;
      }

      const localUrl = URL.createObjectURL(file);
      const newSong = {
        id: `local-${Math.random().toString(36).substr(2, 9)}`,
        title: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
        artist: 'Local File',
        src: localUrl,
        cover: '', // SongCover will handle fallback
        source: 'local',
        duration: 0 // Will be loaded by audio element
      };
      
      newSongs.push(newSong);
    });

    if (newSongs.length > 0) {
      setLocalSongs(prev => [...prev, ...newSongs]);
      toast.success(`Loaded ${newSongs.length} local track${newSongs.length > 1 ? 's' : ''}!`);
    }
  };

  const handlePlayAll = () => {
    if (localSongs.length === 0) return;
    setQueue(localSongs);
    setCurrentSong(localSongs[0]);
    toast.success("Playing all local files");
  };

  const handleShuffleAll = () => {
    if (localSongs.length === 0) return;
    const shuffled = [...localSongs].sort(() => Math.random() - 0.5);
    setQueue(shuffled);
    setCurrentSong(shuffled[0]);
    toast.success("Shuffling local files");
  };

  const handleRemoveSong = (id) => {
    setLocalSongs(prev => prev.filter(s => s.id !== id));
  };

  const handleClearAll = () => {
    localSongs.forEach(s => URL.revokeObjectURL(s.src));
    setLocalSongs([]);
    toast.success("Library cleared");
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <motion.h1 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          Local Files
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          Stream your personal collection directly in RhyMic.
        </motion.p>
      </header>

      <motion.div 
        className={styles.dropzone}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        onClick={() => fileInputRef.current.click()}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
      >
        <div className={styles.dropzoneIcon}>
          <Upload size={32} />
        </div>
        <div className={styles.dropzoneText}>
          <h3>Add Audio Files</h3>
          <p>Drag and drop or click to select multiple songs</p>
        </div>
        <input 
          type="file" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          accept="audio/*" 
          multiple 
          onChange={handleFileChange}
        />
        <button className={styles.uploadBtn}>Select Files</button>
      </motion.div>

      <AnimatePresence>
        {localSongs.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <div className={styles.actions}>
              <div className={styles.actionsLeft}>
                <button className={styles.playAllBtn} onClick={handlePlayAll}>
                  <Play size={18} fill="currentColor" />
                  Play All
                </button>
                <button className={styles.clearBtn} onClick={handleShuffleAll} title="Shuffle and Play">
                  <Shuffle size={18} />
                </button>
              </div>
              <button className={styles.clearBtn} onClick={handleClearAll}>
                Clear Session
              </button>
            </div>

            <div className={styles.songList}>
              {localSongs.map((song, i) => (
                <motion.div 
                  key={song.id}
                  className={styles.songCard}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  layout
                >
                  <SongCover 
                    src={song.cover} 
                    size={48} 
                    className={styles.songImg} 
                  />
                  <div className={styles.songInfo}>
                    <h4>{song.title}</h4>
                    <p>{song.artist}</p>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button 
                      className={styles.removeBtn} 
                      onClick={() => { addToQueue(song); toast.success("Added to queue"); }}
                      title="Add to Queue"
                    >
                      <ListPlus size={20} />
                    </button>
                    <button 
                      className={styles.removeBtn} 
                      onClick={() => handleRemoveSong(song.id)}
                      title="Remove"
                    >
                      <Trash2 size={18} />
                    </button>
                    <button 
                      className={styles.cardPlayBtn}
                      onClick={() => setCurrentSong(song)}
                    >
                      <Play size={20} fill="currentColor" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {localSongs.length === 0 && (
        <div style={{ textAlign: 'center', marginTop: '60px', opacity: 0.5 }}>
          <Music size={48} style={{ marginBottom: '16px' }} />
          <p>No local files loaded yet.</p>
        </div>
      )}
    </div>
  );
};

export default UploadMetadata;

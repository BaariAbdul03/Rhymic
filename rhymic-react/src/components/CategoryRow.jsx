import React, { useEffect, useState, useRef } from 'react';
import styles from './CategoryRow.module.css';
import { useMusicStore } from '../store/musicStore';
import { useAuthStore } from '../store/authStore';
import { ChevronLeft, ChevronRight, PlusCircle } from 'lucide-react';

const CategoryRow = ({ title, playlistId }) => {
  const [songs, setSongs] = useState([]);
  const [showControls, setShowControls] = useState(false);
  const token = useAuthStore((state) => state.token);
  const setCurrentSong = useMusicStore((state) => state.setCurrentSong);
  const playlists = useMusicStore((state) => state.playlists);
  const addSongToPlaylist = useMusicStore((state) => state.addSongToPlaylist);
  const rowRef = useRef(null);

  useEffect(() => {
    const fetchPlaylistSongs = async () => {
      if (!token || !playlistId) return;
      try {
        const response = await fetch(`/api/playlists/${playlistId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setSongs(data.songs);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchPlaylistSongs();
  }, [playlistId, token]);

  useEffect(() => {
    const checkScroll = () => {
      if (rowRef.current) {
        const isOverflowing = rowRef.current.scrollWidth > rowRef.current.clientWidth;
        setShowControls(isOverflowing);
      }
    };
    
    checkScroll();
    
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [songs]);

  const scroll = (scrollOffset) => {
    if (rowRef.current) {
      rowRef.current.scrollLeft += scrollOffset;
    }
  };

  const handleAddToPlaylist = (e, songId) => {
    e.stopPropagation();
    if (playlists.length === 0) { alert("Create a playlist first!"); return; }
    const name = prompt(`Add to playlist:\n${playlists.map(p => p.name).join(', ')}`);
    if (name) {
      const target = playlists.find(p => p.name.toLowerCase() === name.toLowerCase());
      if (target) addSongToPlaylist(target.id, songId);
    }
  };

  if (songs.length === 0) return null;

  return (
    <div className={styles.rowContainer}>
      <div className={styles.header}>
        <h3 className={styles.title}>{title}</h3>
        
        {showControls && (
          <div className={styles.controls}>
            <button onClick={() => scroll(-300)} className={styles.scrollBtn}><ChevronLeft size={20}/></button>
            <button onClick={() => scroll(300)} className={styles.scrollBtn}><ChevronRight size={20}/></button>
          </div>
        )}
      </div>
      
      <div className={styles.scrollArea} ref={rowRef}>
        {songs.map(song => (
          <div 
            key={song.id} 
            className={styles.songCard}
            onClick={() => setCurrentSong(song)}
          >
            <div className={styles.overlayBtn}>
               <button onClick={(e) => handleAddToPlaylist(e, song.id)}>
                  <PlusCircle size={18} color="white" />
               </button>
            </div>
            <img src={song.cover} alt={song.title} className={styles.songCover} />
            <h4 className={styles.songTitle}>{song.title}</h4>
            <p className={styles.songArtist}>{song.artist}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CategoryRow;
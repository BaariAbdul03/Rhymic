import React, { useEffect, useState } from 'react';
import styles from './ForYou.module.css';
import { useMusicStore } from '../store/musicStore';
import { PlusCircle } from 'lucide-react'; // Import

const ForYou = () => {
  const allSongs = useMusicStore((state) => state.songs);
  const setCurrentSong = useMusicStore((state) => state.setCurrentSong);
  const fetchSongs = useMusicStore((state) => state.fetchSongs);
  const playlists = useMusicStore((state) => state.playlists);
  const addSongToPlaylist = useMusicStore((state) => state.addSongToPlaylist);

  const [forYouSongs, setForYouSongs] = useState([]);

  useEffect(() => {
    if (allSongs.length === 0) {
      fetchSongs();
    }
  }, [allSongs.length, fetchSongs]);

  useEffect(() => {
    if (allSongs.length > 0) {
      const shuffled = [...allSongs].sort(() => 0.5 - Math.random());
      setForYouSongs(shuffled.slice(0, 6));
    }
  }, [allSongs]);

  const handleAddToPlaylist = (e, songId) => {
    e.stopPropagation();
    if (playlists.length === 0) { alert("Create a playlist first!"); return; }
    const name = prompt(`Add to playlist:\n${playlists.map(p => p.name).join(', ')}`);
    if (name) {
      const target = playlists.find(p => p.name.toLowerCase() === name.toLowerCase());
      if (target) addSongToPlaylist(target.id, songId);
    }
  };

  return (
    <div className={styles.forYouContainer}>
      <h2 className={styles.title}>For You</h2>
      <div className={styles.scrollContainer}>
        {allSongs.length === 0 ? (
           <p style={{ color: '#718096', fontStyle: 'italic' }}>Loading library...</p>
        ) : (
          forYouSongs.map(song => (
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
          ))
        )}
      </div>
    </div>
  );
};

export default ForYou;
// src/components/TopSongs.jsx
import React, { useEffect } from 'react';
import styles from './TopSongs.module.css';
import { useMusicStore } from '../store/musicStore';
import { Play, Heart, PlusCircle } from 'lucide-react'; // <-- Import PlusCircle

const TopSongs = () => {
  const songs = useMusicStore((state) => state.songs);
  const currentSong = useMusicStore((state) => state.currentSong);
  const setCurrentSong = useMusicStore((state) => state.setCurrentSong);
  const likedSongs = useMusicStore((state) => state.likedSongs);
  const toggleLike = useMusicStore((state) => state.toggleLike);
  const fetchSongs = useMusicStore((state) => state.fetchSongs);
  
  // New: Get playlists and add action
  const playlists = useMusicStore((state) => state.playlists);
  const addSongToPlaylist = useMusicStore((state) => state.addSongToPlaylist);

  useEffect(() => {
    if (songs.length === 0) fetchSongs();
  }, [fetchSongs, songs.length]);

  const handleLikeClick = (e, songId) => {
    e.stopPropagation();
    toggleLike(songId);
  };

  // Simple handler for adding to playlist
  const handleAddToPlaylist = (e, songId) => {
    e.stopPropagation();
    if (playlists.length === 0) {
      alert("Create a playlist first!");
      return;
    }
    
    // Simple prompt for now (we can improve this UI later)
    const playlistName = prompt(
      `Type the name of the playlist to add to:\nAvailable: ${playlists.map(p => p.name).join(', ')}`
    );
    
    if (playlistName) {
      const targetPlaylist = playlists.find(p => p.name.toLowerCase() === playlistName.toLowerCase());
      if (targetPlaylist) {
        addSongToPlaylist(targetPlaylist.id, songId);
      } else {
        alert("Playlist not found.");
      }
    }
  };

  return (
    <aside className={styles.topSongs}> 
      <h3 className={styles.title}>All Songs</h3> 
      
      <div className={styles.songList}>
        {songs.length === 0 ? (
          <p className={styles.loading}>Loading songs from Server...</p>
        ) : (
          songs.map((song) => {
            const isActive = currentSong?.id === song.id;
            const isLiked = likedSongs.includes(song.id);
            
            return (
              <div
                key={song.id}
                onClick={() => setCurrentSong(song)}
                className={`${styles.songItem} ${isActive ? styles.active : ''}`}
              >
                <div className={styles.songLeft}>
                  <img src={song.cover} alt={song.title} className={styles.songCover} />
                  <div className={styles.songInfo}>
                    <h4>{song.title}</h4>
                    <p>{song.artist}</p>
                  </div>
                </div>

                <div className={styles.songRight}>
                  {/* Add to Playlist Button */}
                  <button 
                    className={styles.likeButton} /* Reuse style for hover effect */
                    onClick={(e) => handleAddToPlaylist(e, song.id)}
                    title="Add to Playlist"
                  >
                    <PlusCircle size={16} />
                  </button>

                  <button
                    className={`${styles.likeButton} ${isLiked ? styles.likeActive : ''}`}
                    onClick={(e) => handleLikeClick(e, song.id)}
                  >
                    <Heart size={16} fill={isLiked ? 'currentColor' : 'none'} />
                  </button>
                  {isActive && <Play size={20} className={styles.playIcon} />}
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};

export default TopSongs;

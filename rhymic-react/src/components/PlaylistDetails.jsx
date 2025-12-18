import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import styles from './PlaylistPage.module.css';
import { useMusicStore } from '../store/musicStore';
import { Play, Heart, Music2 } from 'lucide-react';

const PlaylistDetails = () => {
  const { id } = useParams();
  
  const fetchPlaylistDetails = useMusicStore((state) => state.fetchPlaylistDetails);
  const currentPlaylist = useMusicStore((state) => state.currentPlaylist);
  const currentSong = useMusicStore((state) => state.currentSong);
  const setCurrentSong = useMusicStore((state) => state.setCurrentSong);
  const likedSongs = useMusicStore((state) => state.likedSongs);
  const toggleLike = useMusicStore((state) => state.toggleLike);
  
  // --- NEW: Get setSongs to update the queue ---
  const setSongs = useMusicStore((state) => state.setSongs);

  useEffect(() => {
    if (id) fetchPlaylistDetails(id);
  }, [id, fetchPlaylistDetails]);

  const handleLikeClick = (e, songId) => {
    e.stopPropagation();
    toggleLike(songId);
  };

  // --- UPDATED: Play Playlist (Big Button) ---
  const handlePlayPlaylist = () => {
    if (currentPlaylist && currentPlaylist.songs.length > 0) {
      // 1. Update the Global Queue to THIS playlist
      setSongs(currentPlaylist.songs);
      // 2. Play the first song
      setCurrentSong(currentPlaylist.songs[0]);
    }
  };

  // --- UPDATED: Play Specific Song ---
  const handlePlaySong = (song) => {
    // 1. Update the Global Queue to THIS playlist so next/shuffle works within context
    setSongs(currentPlaylist.songs);
    // 2. Play the clicked song
    setCurrentSong(song);
  };

  if (!currentPlaylist) return <div className={styles.loading}>Loading...</div>;

  const songCount = currentPlaylist.songs.length;
  
  // --- UPDATED IMAGE LOGIC ---
  // Image: Abstract Vinyl/Music vibe
  const defaultCover = 'https://images.unsplash.com/photo-1614680376593-902f74cf0d41?q=80&w=1000&auto=format&fit=crop';
  const coverImage = currentPlaylist.songs[0]?.cover || defaultCover;

  return (
    <div className={styles.pageContainer}>
      <div className={styles.header}>
        <div 
            className={styles.headerGradient} 
            style={{ backgroundImage: `url(${coverImage})` }}
        ></div>
        
        <img src={coverImage} alt={currentPlaylist.name} className={styles.headerImage} />
        
        <div className={styles.headerContent}>
          <span className={styles.type}>Public Playlist</span>
          <h1 className={styles.title}>{currentPlaylist.name}</h1>
          <div className={styles.meta}>
            <span className={styles.metaItem}>
              <Music2 size={16} /> {songCount} Songs
            </span>
          </div>
        </div>
      </div>

      <div className={styles.listContainer}>
        <div className={styles.actionBar}>
          <button className={styles.bigPlayBtn} onClick={handlePlayPlaylist}>
            <Play size={28} fill="currentColor" />
          </button>
        </div>

        {currentPlaylist.songs.map((song, index) => {
          const isActive = currentSong?.id === song.id;
          const isLiked = likedSongs.includes(song.id);

          return (
            <div
              key={song.id}
              onClick={() => handlePlaySong(song)} // <-- Use new handler
              className={`${styles.songItem} ${isActive ? styles.active : ''}`}
            >
              <span className={styles.index}>{index + 1}</span>
              <div className={styles.songLeft}>
                <img src={song.cover} alt={song.title} className={styles.songCover} />
                <div className={styles.songInfo}>
                  <h4>{song.title}</h4>
                  <p>{song.artist}</p>
                  </div>
                </div>
              <div className={styles.songRight}>
                <button
                  className={`${styles.likeButton} ${isLiked ? styles.likeActive : ''}`}
                  onClick={(e) => handleLikeClick(e, song.id)}
                >
                  <Heart size={16} fill={isLiked ? 'currentColor' : 'none'} />
                </button>
                {isActive && <div className={styles.playingIndicator}>Now Playing</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
export default PlaylistDetails;
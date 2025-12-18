import React from 'react'; // Removed useEffect
import { Link } from 'react-router-dom';
import styles from './PlaylistPage.module.css';
import { useMusicStore } from '../store/musicStore';
import { Play, Heart, Music2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

const LikedSongsPage = () => {
  const allSongs = useMusicStore((state) => state.songs);
  const likedSongIds = useMusicStore((state) => state.likedSongs);
  const currentSong = useMusicStore((state) => state.currentSong);
  const setCurrentSong = useMusicStore((state) => state.setCurrentSong);
  const setSongs = useMusicStore((state) => state.setSongs);
  const toggleLike = useMusicStore((state) => state.toggleLike);
  // REMOVED: fetchLikedSongs import
  const token = useAuthStore((state) => state.token);

  // REMOVED: useEffect(() => { fetchLikedSongs() ... }) 
  // We rely on the global store state now.

  const likedSongs = allSongs.filter(song => likedSongIds.includes(song.id));

  const handlePlaySong = (song) => {
    setSongs(likedSongs);
    setCurrentSong(song);
  };

  const handlePlayPlaylist = () => {
    if (likedSongs.length > 0) {
      handlePlaySong(likedSongs[0]);
    }
  };

  const handleLikeClick = (e, songId) => {
    e.stopPropagation();
    toggleLike(songId);
  };

  const coverImage = likedSongs.length > 0 
    ? likedSongs[0].cover 
    : 'https://images.unsplash.com/photo-1494232410401-ad00d5433cfa?q=80&w=1000&auto=format&fit=crop';
  
  const songCount = likedSongs.length;

  if (!token) {
    return (
      <div className={styles.pageContainer}>
         <p className={styles.emptyMessage}>Please <Link to="/login">Login</Link> to see your liked songs.</p>
      </div>
    );
  }

  return (
    <div className={styles.pageContainer}>
      <div className={styles.header}>
        <div 
            className={styles.headerGradient} 
            style={{ backgroundImage: `url(${coverImage})` }}
        ></div>
        
        <img 
          src={coverImage} 
          alt="Liked Songs" 
          className={styles.headerImage} 
        />
        
        <div className={styles.headerContent}>
          <span className={styles.type}>Playlist</span>
          <h1 className={styles.title}>Liked Songs</h1>
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

        {likedSongs.length > 0 ? (
          likedSongs.map((song, index) => {
            const isActive = currentSong?.id === song.id;
            return (
              <div
                key={song.id}
                onClick={() => handlePlaySong(song)}
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
                    className={`${styles.likeButton} ${likedSongIds.includes(song.id) ? styles.likeActive : ''}`}
                    onClick={(e) => handleLikeClick(e, song.id)}
                  >
                    <Heart size={16} fill={likedSongIds.includes(song.id) ? 'currentColor' : 'none'} />
                  </button>
                  {isActive && <div className={styles.playingIndicator}>Now Playing</div>}
                </div>
              </div>
            );
          })
        ) : (
          <p className={styles.emptyMessage}>
            No liked songs yet. Go explore and heart some tracks!
          </p>
        )}
      </div>
    </div>
  );
};

export default LikedSongsPage;
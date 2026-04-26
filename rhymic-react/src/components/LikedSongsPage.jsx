import React from 'react'; // Removed useEffect
import { Link } from 'react-router-dom';
import styles from './PlaylistPage.module.css';
import { useMusicStore } from '../store/musicStore';
import { Play, Heart, Music2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

const LikedSongsPage = () => {
  const songs = useMusicStore((state) => state.songs);
  const likedSongIds = useMusicStore((state) => state.likedSongs);
  const currentSong = useMusicStore((state) => state.currentSong);
  const setCurrentSong = useMusicStore((state) => state.setCurrentSong);
  const setSongs = useMusicStore((state) => state.setSongs);
  const toggleLike = useMusicStore((state) => state.toggleLike);
  const fetchSongs = useMusicStore((state) => state.fetchSongs);
  const fetchLikedSongs = useMusicStore((state) => state.fetchLikedSongs);
  const token = useAuthStore((state) => state.token);
  const likedSongsLoading = useMusicStore((state) => state.likedSongsLoading);

  React.useEffect(() => {
    if (token) {
      if (songs.length === 0) fetchSongs();
      fetchLikedSongs();
    }
  }, [token, fetchSongs, fetchLikedSongs, songs.length]);

  const likedSongs = songs.filter(song => likedSongIds.includes(song.id));

  const handlePlaySong = (song) => {
    setSongs(likedSongs);
    setCurrentSong(song);
  };

  const handlePlayPlaylist = () => {
    if (likedSongs.length > 0) {
      handlePlaySong(likedSongs[0]);
    }
  };

  const handleLikeClick = (e, song) => {
    e.stopPropagation();
    toggleLike(song);
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

        {likedSongsLoading ? (
          <div>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={`skel-${i}`} className={`${styles.songItem} ${styles.skeleton}`}>
                <span className={styles.index}></span>
                <div className={styles.songLeft}>
                  <div className={styles.skeletonCover} />
                  <div className={styles.songInfo}>
                    <div className={styles.skeletonTitle} />
                    <div className={styles.skeletonArtist} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : likedSongs.length > 0 ? (
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
                  <img loading="lazy" width="48" height="48" src={song.cover} alt={song.title} className={styles.songCover} onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = "/placeholder-cover.png"; }} />
                  <div className={styles.songInfo}>
                    <h4>{song.title}</h4>
                    <p>{song.artist}</p>
                  </div>
                </div>
                <div className={styles.songRight}>
                  <button
                    className={`${styles.likeButton} ${likedSongIds.includes(song.id) ? styles.likeActive : ''}`}
                    onClick={(e) => handleLikeClick(e, song)}
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
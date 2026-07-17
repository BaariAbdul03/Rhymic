import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styles from './PlaylistPage.module.css';
import { useMusicStore } from '../store/musicStore';
import { Play, Heart, Music2, Trash2, Edit3, Check, X, Loader2 } from 'lucide-react';
import ContextMenu from './ContextMenu';
import SongCover from './SongCover';

const PlaylistLoading = () => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 99) {
          clearInterval(timer);
          return 99;
        }
        const diff = Math.floor(Math.random() * 15) + 5;
        return Math.min(prev + diff, 99);
      });
    }, 120);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className={styles.loadingContainer}>
      <div className={styles.spinnerWrapper}>
        <Loader2 className={styles.loopIcon} size={48} />
        <span className={styles.percentageText}>{progress}%</span>
      </div>
      <p className={styles.loadingText}>Syncing playlist catalog...</p>
    </div>
  );
};

const PlaylistDetails = () => {
  const { id } = useParams();
  
  const [contextMenu, setContextMenu] = useState(null);

  const fetchPlaylistDetails = useMusicStore((state) => state.fetchPlaylistDetails);
  const currentPlaylist = useMusicStore((state) => state.currentPlaylist);
  const currentSong = useMusicStore((state) => state.currentSong);
  const setCurrentSong = useMusicStore((state) => state.setCurrentSong);
  const likedSongs = useMusicStore((state) => state.likedSongs);
  const toggleLike = useMusicStore((state) => state.toggleLike);
  
  // --- NEW: Get setQueue to update the queue ---
  const setQueue = useMusicStore((state) => state.setQueue);
  const deletePlaylist = useMusicStore((state) => state.deletePlaylist);
  const renamePlaylist = useMusicStore((state) => state.renamePlaylist);
  
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    if (id) fetchPlaylistDetails(id);
  }, [id, fetchPlaylistDetails]);

  const handleLikeClick = (e, song) => {
    e.stopPropagation();
    toggleLike(song);
  };

  const handleContextMenu = (e, song) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, song });
  };

  // --- UPDATED: Play Playlist (Big Button) ---
  const handlePlayPlaylist = () => {
    if (currentPlaylist && currentPlaylist.songs.length > 0) {
      // 1. Update the Global Queue to THIS playlist
      setQueue(currentPlaylist.songs);
      // 2. Play the first song
      setCurrentSong(currentPlaylist.songs[0]);
    }
  };

  // --- UPDATED: Play Specific Song ---
  const handlePlaySong = (song) => {
    // 1. Update the Global Queue to THIS playlist so next/shuffle works within context
    setQueue(currentPlaylist.songs);
    // 2. Play the clicked song
    setCurrentSong(song);
  };

  const handleDelete = async () => {
    if (window.confirm("Are you sure you want to delete this playlist?")) {
      await deletePlaylist(currentPlaylist.id);
      navigate('/');
    }
  };

  const handleRenameSubmit = async (e) => {
    e.preventDefault();
    if (editName.trim() && editName.trim() !== currentPlaylist.name) {
      await renamePlaylist(currentPlaylist.id, editName.trim());
    }
    setIsEditing(false);
  };

  if (!currentPlaylist) return <PlaylistLoading />;

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
        
        <SongCover src={coverImage} alt={currentPlaylist.name} size="large" className={styles.headerImage} />
        
        <div className={styles.headerContent}>
          <span className={styles.type}>
            {currentPlaylist.is_system ? "System Playlist" : "Public Playlist"}
          </span>
          
          <div className={styles.titleRow}>
            {isEditing ? (
              <form onSubmit={handleRenameSubmit} className={styles.renameForm}>
                <input 
                  type="text" 
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className={styles.renameInput}
                  autoFocus
                />
                <button type="submit" className={styles.renameBtn}><Check size={20}/></button>
                <button type="button" onClick={() => setIsEditing(false)} className={styles.renameBtn}><X size={20}/></button>
              </form>
            ) : (
              <h1 className={styles.title}>{currentPlaylist.name}</h1>
            )}
            
            {!currentPlaylist.is_system && !isEditing && (
              <div className={styles.playlistActions}>
                <button onClick={() => { setIsEditing(true); setEditName(currentPlaylist.name); }} className={styles.actionBtn}>
                  <Edit3 size={20} />
                </button>
                <button onClick={handleDelete} className={`${styles.actionBtn} ${styles.dangerBtn}`}>
                  <Trash2 size={20} />
                </button>
              </div>
            )}
          </div>
          
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
              onClick={() => handlePlaySong(song)} 
              onContextMenu={(e) => handleContextMenu(e, song)}
              className={`${styles.songItem} ${isActive ? styles.active : ''}`}
            >
              <span className={styles.index}>{index + 1}</span>
              <div className={styles.songLeft}>
                <SongCover src={song.cover} alt={song.title} size="small" className={styles.songCover} />
                <div className={styles.songInfo}>
                  <h4>{song.title}</h4>
                  <p>{song.artist}</p>
                  </div>
                </div>
              <div className={styles.songRight}>
                <button
                  className={`${styles.likeButton} ${isLiked ? styles.likeActive : ''}`}
                  onClick={(e) => handleLikeClick(e, song)}
                >
                  <Heart size={16} fill={isLiked ? 'currentColor' : 'none'} />
                </button>
                {isActive && <div className={styles.playingIndicator}>Now Playing</div>}
              </div>
            </div>
          );
        })}
      </div>
      {contextMenu && (
        <ContextMenu 
          x={contextMenu.x} 
          y={contextMenu.y} 
          song={contextMenu.song} 
          onClose={() => setContextMenu(null)} 
        />
      )}
    </div>
  );
};
export default PlaylistDetails;
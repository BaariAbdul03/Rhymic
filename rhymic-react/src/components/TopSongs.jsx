import { Play, Heart, ListPlus, Clock, AudioLines } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMusicStore } from '../store/musicStore';
import toast from 'react-hot-toast';
import styles from './TopSongs.module.css';

const TopSongs = ({ limit, hideHeader }) => {
  const navigate = useNavigate();
  const songs = useMusicStore((state) => state.songs);
  const currentSong = useMusicStore((state) => state.currentSong);
  const isPlaying = useMusicStore((state) => state.isPlaying);
  const setCurrentSong = useMusicStore((state) => state.setCurrentSong);
  const togglePlay = useMusicStore((state) => state.togglePlay);
  const toggleLike = useMusicStore((state) => state.toggleLike);
  const likedSongs = useMusicStore((state) => state.likedSongs);

  if (!songs || songs.length === 0) return null;

  const displaySongs = limit ? songs.slice(0, limit) : songs;

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
      
      <div className={styles.tableBody}>
        {displaySongs.map((song, index) => {
          const isActive = currentSong?.id === song.id;
          const isLiked = likedSongs.includes(song.id);

          return (
            <div 
              key={song.id} 
              className={`${styles.tableRow} ${isActive ? styles.activeRow : ''}`}
            >
              <div className={styles.colIndex}>
                 {isActive && isPlaying ? (
                    <AudioLines size={20} color="var(--accent-primary)" className={styles.playingGif} />
                 ) : (
                    <span className={styles.indexNumber}>{index + 1}</span>
                 )}
                 <button className={styles.playOverlay} onClick={() => handlePlayClick(song)}>
                   <Play size={16} fill="currentColor" />
                 </button>
              </div>
              
              <div className={styles.colTitle}>
                <img src={song.cover} alt={song.title} className={styles.songCover} />
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
                3:14
              </div>
              
              <div className={styles.colAction}>
                <button className={styles.actionBtn} onClick={() => toggleLike(song.id)}>
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
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TopSongs;

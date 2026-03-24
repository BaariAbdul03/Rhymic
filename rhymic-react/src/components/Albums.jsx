import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Disc, Play } from 'lucide-react';
import { useMusicStore } from '../store/musicStore';
import styles from './Albums.module.css';

const Albums = () => {
  const songs = useMusicStore((state) => state.songs);
  const setCurrentSong = useMusicStore((state) => state.setCurrentSong);
  const navigate = useNavigate();
  const [albums, setAlbums] = useState([]);

  useEffect(() => {
    // Group songs by album
    const albumMap = new Map();
    songs.forEach(song => {
      const albumName = song.album || 'Single';
      if (!albumMap.has(albumName)) {
        albumMap.set(albumName, {
          title: albumName,
          artist: song.artist,
          cover: song.cover,
          songs: []
        });
      }
      albumMap.get(albumName).songs.push(song);
    });
    
    setAlbums(Array.from(albumMap.values()));
    window.scrollTo(0, 0);
  }, [songs]);

  const handlePlayAlbum = (e, album) => {
    e.stopPropagation();
    if (album.songs.length > 0) {
      setCurrentSong(album.songs[0]);
    }
  };

  return (
    <div className={styles.albumsContainer}>
      <div className={styles.header}>
        <h1><Disc size={32} style={{marginRight: '12px'}}/> Albums</h1>
        <p>Explore your library by albums and releases.</p>
      </div>

      <div className={styles.albumsGrid}>
        {albums.map((album, index) => (
          <div key={index} className={styles.albumCard} onClick={() => navigate(`/artist/${encodeURIComponent(album.artist)}`)}>
            <div className={styles.coverContainer}>
              <img src={album.cover || '/assets/default_cover.jpg'} alt={album.title} className={styles.cover} />
              <div className={styles.playOverlay}>
                <button 
                  className={styles.playBtn}
                  onClick={(e) => handlePlayAlbum(e, album)}
                >
                  <Play size={24} fill="currentColor" />
                </button>
              </div>
            </div>
            <h3 className={styles.albumTitle}>{album.title}</h3>
            <p className={styles.albumArtist}>{album.artist}</p>
          </div>
        ))}
      </div>
      {albums.length === 0 && (
         <p className={styles.emptyState}>No albums found in your library.</p>
      )}
    </div>
  );
};

export default Albums;

import React, { useEffect } from 'react';
import styles from './Discover.module.css';
import { useMusicStore } from '../store/musicStore';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';

// Map genre names to images (You can replace these with local assets later)
const genreImages = {
  'Hindi': 'https://images.unsplash.com/photo-1566933293069-b55c7f326dd4?w=400&q=80',
  'English': 'https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=400&q=80',
  'Rap': 'https://images.unsplash.com/photo-1493225255756-d9584f8606e9?w=400&q=80',
  'Modern': 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&q=80',
  'Retro Classics': 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&q=80',
  'Romantic': 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=400&q=80',
};

const Discover = () => {
  const playlists = useMusicStore((state) => state.playlists);
  const fetchPlaylists = useMusicStore((state) => state.fetchPlaylists);
  const token = useAuthStore((state) => state.token);
  const navigate = useNavigate();

  useEffect(() => {
    if (token) fetchPlaylists();
  }, [token, fetchPlaylists]);

  const genres = playlists.filter(p => p.is_system);

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Discover</h1>
      <p className={styles.subtitle}>Browse by Genre</p>
      
      <div className={styles.grid}>
        {genres.map((genre) => {
          const bgImage = genreImages[genre.name] || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&q=80'; // Fallback
          
          return (
            <div 
              key={genre.id} 
              className={styles.card}
              onClick={() => navigate(`/playlist/${genre.id}`)}
            >
              {/* Background Image with Overlay */}
              <div 
                className={styles.cardBg} 
                style={{ backgroundImage: `url(${bgImage})` }}
              />
              <div className={styles.cardOverlay} />
              
              <span className={styles.cardTitle}>{genre.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Discover;

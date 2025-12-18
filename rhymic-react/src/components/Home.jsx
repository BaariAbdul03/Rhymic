import React, { useEffect } from 'react';
import styles from './Home.module.css';
import ForYou from './ForYou';
import CategoryRow from './CategoryRow';
import Hero from './Hero'; 
import { useMusicStore } from '../store/musicStore';
import { useAuthStore } from '../store/authStore';

const Home = () => {
  const playlists = useMusicStore((state) => state.playlists);
  const fetchPlaylists = useMusicStore((state) => state.fetchPlaylists);
  const token = useAuthStore((state) => state.token);

  useEffect(() => {
    if (token) fetchPlaylists();
  }, [token, fetchPlaylists]);

  const systemPlaylists = playlists.filter(p => p.is_system);

  return (
    <div className={styles.homeContainer}>
      <Hero />
      
      <ForYou />
      
      <div className={styles.categoryStack}>
        {systemPlaylists.map(playlist => (
          <CategoryRow 
            key={playlist.id} 
            title={playlist.name} 
            playlistId={playlist.id} 
          />
        ))}
      </div>
    </div>
  );
};

export default Home;
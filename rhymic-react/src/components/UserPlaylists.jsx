// src/components/Genres.jsx
import React, { useEffect } from 'react';
import styles from './Genres.module.css';
import { useMusicStore } from '../store/musicStore';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import { PlusCircle } from 'lucide-react';

const Genres = () => {
  const playlists = useMusicStore((state) => state.playlists);
  const fetchPlaylists = useMusicStore((state) => state.fetchPlaylists);
  const createPlaylist = useMusicStore((state) => state.createPlaylist);
  const token = useAuthStore((state) => state.token);
  const navigate = useNavigate();

  useEffect(() => {
    if (token) {
      fetchPlaylists();
    }
  }, [token, fetchPlaylists]);

  const handleCreate = () => {
    const name = prompt("Enter playlist name:");
    if (name) createPlaylist(name);
  };

  // Function to generate a consistent gradient based on ID
  const getGradient = (id) => {
    const gradients = [
      'linear-gradient(135deg, #4a90e2 0%, #004d99 100%)', // Blue
      'linear-gradient(135deg, #50e3c2 0%, #006b54 100%)', // Teal
      'linear-gradient(135deg, #bd10e0 0%, #5f0770 100%)', // Purple
      'linear-gradient(135deg, #f5a623 0%, #895d12 100%)', // Orange
      'linear-gradient(135deg, #ff5858 0%, #a30000 100%)', // Red
    ];
    return gradients[id % gradients.length];
  };

  return (
    <div className={styles.genresContainer}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
        <h2 className={styles.title} style={{marginBottom: 0}}>Your Playlists</h2>
        <button 
            onClick={handleCreate}
            style={{background: 'none', border: 'none', cursor: 'pointer', color: '#4a90e2', fontWeight: 'bold'}}
        >
            + New
        </button>
      </div>

      <div className={styles.grid}>
        {/* Display Actual Playlists */}
        {playlists.map((playlist) => (
          <div 
            key={playlist.id} 
            className={styles.card}
            style={{ background: getGradient(playlist.id) }}
            onClick={() => navigate(`/playlist/${playlist.id}`)}
          >
            <h3 className={styles.cardTitle}>{playlist.name}</h3>
          </div>
        ))}

        {/* If empty, show a placeholder */}
        {playlists.length === 0 && (
          <div className={styles.emptyState}>
            <p>No playlists yet.</p>
            <button onClick={handleCreate} className={styles.createBtn}>Create One</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Genres;
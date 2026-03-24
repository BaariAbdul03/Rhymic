import React, { useEffect, useState } from 'react';
import { useMusicStore } from '../store/musicStore';
import CategoryRow from './CategoryRow';
import { SongCardSkeleton } from './Skeleton';
import styles from './Discover.module.css';

const Discover = () => {
  const { playlists, fetchPlaylists, aiCategories, fetchAiCategories } = useMusicStore();
  const [loading, setLoading] = useState(true);
  const [isAiLoading, setIsAiLoading] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchPlaylists();
      setLoading(false);
      
      const p = useMusicStore.getState().playlists;
      const systems = p.filter(pl => pl.is_system);
      const systemNames = systems.map(s => s.name);
      
      if (!useMusicStore.getState().aiCategories && systemNames.length > 0) {
        // Fire and forget - don't block the UI!
        fetchAiCategories(systemNames).catch(console.error);
      }
    };
    loadData();
    window.scrollTo(0, 0);
  }, [fetchPlaylists, fetchAiCategories]);

  // Use system playlists for discover categories
  const systemPlaylists = playlists.filter(p => p.is_system);

  return (
    <div className={styles.discoverContainer}>
      <div className={styles.header}>
        <h1>Discover New Music</h1>
        <p>Curated playlists and genres just for you.</p>
      </div>

      {loading ? (
        <div className={styles.loadingGrid}>
          {[1, 2, 3].map((row) => (
             <div key={row} style={{marginBottom: '40px'}}>
               <div style={{height: '30px', width: '200px', backgroundColor: 'var(--bg-elevated)', borderRadius: '8px', marginBottom: '16px'}} />
               <div style={{display: 'flex', gap: '16px'}}>
                 {[1, 2, 3, 4, 5].map((card) => (
                    <SongCardSkeleton key={card} />
                 ))}
               </div>
             </div>
          ))}
        </div>
      ) : (
        <div className={styles.categoriesWrapper}>
          {systemPlaylists.map(playlist => (
            <CategoryRow key={playlist.id} playlist={playlist} />
          ))}
          {systemPlaylists.length === 0 && (
             <p className={styles.emptyState}>No categories found. Run the scanner.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default Discover;

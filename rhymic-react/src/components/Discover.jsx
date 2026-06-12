import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useMusicStore } from '../store/musicStore';
import { streamApi } from '../services/api';
import CategoryRow from './CategoryRow';
import { SongCardSkeleton } from './Skeleton';
import { preloadImages } from '../utils/preloadImages';
import styles from './Discover.module.css';

const DEFAULT_DISCOVER_CATEGORIES = ['Hindi', 'English', 'Rap', 'Modern', 'Retro Classics', 'Romantic'];

const Discover = () => {
  const location = useLocation();
  const { playlists, fetchPlaylists, fetchAiCategories } = useMusicStore();
  const [loading, setLoading] = useState(true);
  const [onlineCategories, setOnlineCategories] = useState(null);
  const [usingOnline, setUsingOnline] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Checking online catalog');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchPlaylists();

      const p = useMusicStore.getState().playlists;
      const systems = p.filter(pl => pl.is_system);
      const systemNames = systems.length > 0 ? systems.map(s => s.name) : DEFAULT_DISCOVER_CATEGORIES;

      try {
        const statusRes = await streamApi.status();
        if (statusRes.data?.enabled !== false) {
          const categoriesRes = await streamApi.getCategories(systemNames, 10);
          const grouped = categoriesRes.data?.categories || {};
          const hasOnlineRows = Object.values(grouped).some(row => Array.isArray(row) && row.length > 0);
          if (hasOnlineRows) {
            preloadImages(Object.values(grouped).flat(), 36);
            setOnlineCategories(grouped);
            setUsingOnline(true);
            setStatusMessage('Online catalog active');
            setLoading(false);
            return;
          }
        } else {
          setStatusMessage('Online streaming disabled');
        }
      } catch (error) {
        console.error("Online Discover categories failed, using local fallback:", error);
        setStatusMessage('Using local fallback');
      }

      const currentAiCategories = useMusicStore.getState().aiCategories;
      const needsAiFetch = !currentAiCategories || Object.keys(currentAiCategories).length === 0;

      if (needsAiFetch && systemNames.length > 0) {
        // Fire and forget - don't block the UI!
        fetchAiCategories(systemNames).catch(console.error);
      }

      setOnlineCategories(null);
      setUsingOnline(false);
      setStatusMessage((current) => current === 'Checking online catalog' ? 'Using local fallback' : current);
      setLoading(false);
    };
    loadData();
    window.scrollTo(0, 0);
  }, [fetchPlaylists, fetchAiCategories]);

  // Use system playlists for discover categories
  const systemPlaylists = playlists.filter(p => p.is_system);
  const onlineRows = onlineCategories
    ? Object.entries(onlineCategories)
        .filter(([, songs]) => songs.length > 0)
        .map(([name, songs]) => ({
          id: `online-${name}`,
          name,
          is_system: true,
          songs
        }))
    : [];
  const selectedCategory = new URLSearchParams(location.search).get('category');
  const unsortedRows = usingOnline ? onlineRows : systemPlaylists;
  const categoryRows = selectedCategory
    ? [...unsortedRows].sort((a, b) => {
        const aMatch = a.name?.toLowerCase() === selectedCategory.toLowerCase();
        const bMatch = b.name?.toLowerCase() === selectedCategory.toLowerCase();
        return Number(bMatch) - Number(aMatch);
      })
    : unsortedRows;

  return (
    <div className={styles.discoverContainer}>
      <div className={styles.header}>
        <div>
          <h1>Discover New Music</h1>
          <p>{selectedCategory ? `${selectedCategory} picks first, followed by the rest of the catalog.` : (usingOnline ? 'Live online tracks grouped by genre and language.' : 'Curated playlists and genres just for you.')}</p>
        </div>
        <span className={`${styles.statusPill} ${usingOnline ? styles.online : ''}`}>
          {statusMessage}
        </span>
      </div>

      {loading ? (
        <div className={styles.loadingGrid}>
          {[1, 2, 3].map((row) => (
            <div key={row} style={{ marginBottom: '40px' }}>
              <div style={{ height: '30px', width: '200px', backgroundColor: 'var(--bg-elevated)', borderRadius: '8px', marginBottom: '16px' }} />
              <div style={{ display: 'flex', gap: '16px' }}>
                {[1, 2, 3, 4, 5].map((card) => (
                  <SongCardSkeleton key={card} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.categoriesWrapper}>
          {categoryRows.map(playlist => (
            <CategoryRow key={playlist.id} playlist={playlist} songs={playlist.songs} />
          ))}
          {categoryRows.length === 0 && (
            <p className={styles.emptyState}>No categories found. Try Explore Online or check the stream provider.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default Discover;

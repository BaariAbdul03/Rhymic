import React, { useEffect } from 'react';
import styles from './Home.module.css';
import Hero from './Hero';
import TopSongs from './TopSongs';
import { useMusicStore } from '../store/musicStore';

const Home = () => {
  const playlists = useMusicStore((state) => state.playlists);
  
  useEffect(() => {
    // Scroll to top on mount
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className={styles.homeContainer}>
      <Hero />
      
      {/* Categories Removed per user request */}

      <div className={styles.topSongsSection}>
        <div className={styles.sectionHeader}>
          <h2>Popular Songs</h2>
          <button className={styles.seeAll}>See All</button>
        </div>
        <TopSongs limit={5} hideHeader={true} />
      </div>

    </div>
  );
};

export default Home;
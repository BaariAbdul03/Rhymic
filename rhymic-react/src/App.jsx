import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';

import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import ProgressBar from './components/ProgressBar';
import Home from './components/Home';
import Discover from './components/Discover';
import PlaylistDetails from './components/PlaylistDetails';
import LikedSongs from './components/LikedSongsPage';
import UploadMetadata from './components/UploadMetadata';
import PremiumPlaceholder from './components/PremiumPlaceholder';
import ArtistDetail from './components/ArtistDetail';
import RightPanel from './components/RightPanel';
import PageWrapper from './components/PageWrapper';
import SmartDJ from './components/SmartDJ';
import MobilePlayer from './components/MobilePlayer';

import Login from './components/Login';
import Profile from './components/Profile';
import Signup from './components/Signup';
import LandingPage from './components/LandingPage';
import Settings from './components/Settings';
import styles from './App.module.css';

import { useMusicStore } from './store/musicStore';
import { useAuthStore } from './store/authStore';
import { useUIStore } from './store/uiStore';

const AppContent = () => {
  const fetchSongs = useMusicStore((state) => state.fetchSongs);
  const fetchPlaylists = useMusicStore((state) => state.fetchPlaylists);
  const fetchLikedSongs = useMusicStore((state) => state.fetchLikedSongs);
  
  const token = useAuthStore((state) => state.token);
  const location = useLocation();

  useEffect(() => {
    if (token) {
      fetchSongs();
      fetchPlaylists();
      fetchLikedSongs();
    }
  }, [fetchSongs, fetchPlaylists, fetchLikedSongs, token]);

  const showSidebarAndPlayer = !['/login', '/signup', '/landing'].includes(location.pathname);

  if (!token && showSidebarAndPlayer) {
    return <Navigate to="/landing" replace />;
  }

  if (!showSidebarAndPlayer) {
    return (
      <div className={styles.authContainer}>
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/landing" element={<PageWrapper>{token ? <Navigate to="/" /> : <LandingPage />}</PageWrapper>} />
            <Route path="/login" element={<PageWrapper>{token ? <Navigate to="/" /> : <Login />}</PageWrapper>} />
            <Route path="/signup" element={<PageWrapper>{token ? <Navigate to="/" /> : <Signup />}</PageWrapper>} />
          </Routes>
        </AnimatePresence>
      </div>
    );
  }

  const { currentSong, queue } = useMusicStore();
  const isRightPanelOpen = useUIStore(state => state.isRightPanelOpen);
  const isPlayerOpen = useUIStore(state => state.isPlayerOpen);
  const showRightPanel = (currentSong || queue.length > 0) && isRightPanelOpen;

  return (
    <div className={`${styles.appContainer} ${!showRightPanel ? styles.hideRightPanel : ''}`}>
      <Sidebar />
      
      <main className={styles.mainWrapper}>
        <Topbar />
        <div className={styles.scrollableContent}>
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              {/* Main App Routes */}
              <Route path="/" element={<PageWrapper><Home /></PageWrapper>} />
              <Route path="/discover" element={<PageWrapper><Discover /></PageWrapper>} />
              <Route path="/playlist/:id" element={<PageWrapper><PlaylistDetails /></PageWrapper>} />
              <Route path="/liked" element={<PageWrapper><LikedSongs /></PageWrapper>} />
              <Route path="/artist/:name" element={<PageWrapper><ArtistDetail /></PageWrapper>} />
              <Route path="/profile" element={<PageWrapper><Profile /></PageWrapper>} />
              <Route path="/settings" element={<PageWrapper><Settings /></PageWrapper>} />
              <Route path="/upload" element={<PageWrapper><UploadMetadata /></PageWrapper>} />

              {/* Premium Placeholders & Features */}
              <Route path="/dj" element={<PageWrapper><SmartDJ /></PageWrapper>} />
              <Route path="/subscribe" element={<PageWrapper><PremiumPlaceholder title="Rhymic Premium" description="Unlock high-fidelity audio, exclusive podcasts, and ad-free listening." /></PageWrapper>} />
            </Routes>
          </AnimatePresence>
        </div>
      </main>
      
      {showRightPanel && <RightPanel isOverlay={isPlayerOpen} />}
      
      <div className={styles.bottomPlayer}>
        <ProgressBar />
      </div>

      <MobilePlayer />
    </div>
  );
};

const App = () => {
  return <AppContent />;
};

export default App;
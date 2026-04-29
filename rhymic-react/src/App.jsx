import React, { useEffect, Suspense, lazy } from 'react';
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
import RightPanel from './components/RightPanel';
import PageWrapper from './components/PageWrapper';
import MoodOrb from './components/MoodOrb';

import Login from './components/Login';
import Signup from './components/Signup';
import LandingPage from './components/LandingPage';
import Skeleton from './components/Skeleton';
import styles from './App.module.css';

import { useMusicStore } from './store/musicStore';
import { useAuthStore } from './store/authStore';
import { useUIStore } from './store/uiStore';

const OnlineSearch = lazy(() => import('./components/OnlineSearch'));
const ArtistDetail = lazy(() => import('./components/ArtistDetail'));
const SmartDJ = lazy(() => import('./components/SmartDJ'));
const MobilePlayer = lazy(() => import('./components/MobilePlayer'));
const Visualizer = lazy(() => import('./components/Visualizer'));
const AudioLab = lazy(() => import('./components/AudioLab'));
const Profile = lazy(() => import('./components/Profile'));
const Settings = lazy(() => import('./components/Settings'));

const AppContent = () => {
  const fetchSongs = useMusicStore((state) => state.fetchSongs);
  const fetchPlaylists = useMusicStore((state) => state.fetchPlaylists);
  const fetchLikedSongs = useMusicStore((state) => state.fetchLikedSongs);

  // FIX #22: All hooks must be called unconditionally before any early returns
  const currentSong = useMusicStore((state) => state.currentSong);
  const queue = useMusicStore((state) => state.queue);
  const isRightPanelOpen = useUIStore(state => state.isRightPanelOpen);
  const isPlayerOpen = useUIStore(state => state.isPlayerOpen);
  
  const token = useAuthStore((state) => state.token);
  const error = useMusicStore((state) => state.error);
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
              <Route path="/explore" element={<PageWrapper><Suspense fallback={<Skeleton type="list" />}><OnlineSearch /></Suspense></PageWrapper>} />
              <Route path="/playlist/:id" element={<PageWrapper><PlaylistDetails /></PageWrapper>} />
              <Route path="/liked" element={<PageWrapper><LikedSongs /></PageWrapper>} />
              <Route path="/artist/:name" element={<PageWrapper><Suspense fallback={<Skeleton type="header" />}><ArtistDetail /></Suspense></PageWrapper>} />
              <Route path="/profile" element={<PageWrapper><Suspense fallback={<Skeleton type="header" />}><Profile /></Suspense></PageWrapper>} />
              <Route path="/settings" element={<PageWrapper><Suspense fallback={<Skeleton type="list" />}><Settings /></Suspense></PageWrapper>} />
              <Route path="/upload" element={<PageWrapper><UploadMetadata /></PageWrapper>} />

              {/* Premium Placeholders & Features */}
              <Route path="/dj" element={<PageWrapper><Suspense fallback={<Skeleton type="card" count={4} />}><SmartDJ /></Suspense></PageWrapper>} />
              <Route path="/subscribe" element={<PageWrapper><PremiumPlaceholder title="Rhymic Premium" description="Unlock high-fidelity audio, exclusive podcasts, and ad-free listening." /></PageWrapper>} />
            </Routes>
          </AnimatePresence>
        </div>
      </main>
      
      {showRightPanel && <RightPanel isOverlay={isPlayerOpen} />}
      
      <div className={styles.bottomPlayer}>
        <ProgressBar />
      </div>

      <MoodOrb />
      <Suspense fallback={null}>
        <AudioLab />
        <Visualizer />
        <MobilePlayer />
      </Suspense>

      {/* Global Error Toast */}
      <AnimatePresence>
        {error && (
          <motion.div 
            className={styles.errorToast}
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 50, x: '-50%' }}
          >
            <div className={styles.errorIcon}>!</div>
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const App = () => {
  return <AppContent />;
};

export default App;
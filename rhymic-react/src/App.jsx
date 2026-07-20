import React, { useEffect, Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Toaster } from 'react-hot-toast';

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
  const fetchUser = useAuthStore((state) => state.fetchUser);

  // FIX #22: All hooks must be called unconditionally before any early returns
  const currentSong = useMusicStore((state) => state.currentSong);
  const queue = useMusicStore((state) => state.queue);
  const isRightPanelOpen = useUIStore(state => state.isRightPanelOpen);
  const isPlayerOpen = useUIStore(state => state.isPlayerOpen);
  const isSidebarCompact = useUIStore(state => state.isSidebarCompact);
  
  const token = useAuthStore((state) => state.token);
  const error = useMusicStore((state) => state.error);
  const streamFallbackUrl = useMusicStore((state) => state.streamFallbackUrl);
  const nextSong = useMusicStore((state) => state.nextSong);
  const clearStreamFallback = useMusicStore((state) => state.clearStreamFallback);
  const location = useLocation();

  // On token change (including initial mount), first validate the token
  // server-side via fetchUser() before fetching data.
  // This catches tokens that are still valid client-side (not expired)
  // but were invalidated server-side (e.g., new JWT_SECRET_KEY on deploy).
  useEffect(() => {
    let cancelled = false;
    
    async function initApp() {
      if (!token) return;
      
      try {
        // First, validate the token by fetching the current user
        await fetchUser();
        if (cancelled) return;
        
        // Only fetch data if the token is still valid after validation
        // (fetchUser will call logout() and clear token on 401/404)
        if (useAuthStore.getState().token) {
          fetchSongs();
          fetchPlaylists();
          fetchLikedSongs();
        }
      } catch {
        // fetchUser handles its own errors; nothing to do here
      }
    }
    
    initApp();
    return () => { cancelled = true; };
  }, [fetchUser, fetchSongs, fetchPlaylists, fetchLikedSongs, token]);

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
    <div className={`${styles.appContainer} ${isSidebarCompact ? styles.compactSidebar : ''} ${!showRightPanel ? styles.hideRightPanel : ''}`}>
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
              <Route path="/subscribe" element={<PageWrapper><PremiumPlaceholder title="RhyMic Premium" description="Unlock high-fidelity audio, exclusive podcasts, and ad-free listening." /></PageWrapper>} />
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

      <Toaster 
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: 'rgba(18, 18, 18, 0.8)',
            color: '#fff',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(212, 168, 67, 0.2)',
            borderRadius: '12px',
            padding: '12px 20px',
            fontSize: '14px',
            fontWeight: '500',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          },
          success: {
            iconTheme: {
              primary: 'var(--accent-primary)',
              secondary: '#121212',
            },
          },
          error: {
            style: {
              border: '1px solid rgba(255, 75, 75, 0.2)',
            },
          },
        }}
      />

      {/* Global Error Toast — with YouTube fallback button for cloud-blocked streams */}
      <AnimatePresence>
        {error && (
          <Motion.div
            className={styles.errorToast}
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 50, x: '-50%' }}
          >
            <div className={styles.errorIcon}>!</div>
            <span className={styles.errorMessage}>{error}</span>
            {streamFallbackUrl && (
              <div className={styles.fallbackActions}>
                <a 
                  href={streamFallbackUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.youtubeBtn}
                  onClick={() => {
                    const store = useMusicStore.getState();
                    store.clearStreamFallback();
                    store.clearError();
                    store.nextSong();
                  }}
                >
                  ▶ Play on YouTube Music
                </a>
                <button 
                  className={styles.skipBtn}
                  onClick={() => {
                    const store = useMusicStore.getState();
                    store.clearStreamFallback();
                    store.clearError();
                    store.nextSong();
                  }}
                >
                  Skip
                </button>
              </div>
            )}
            {!streamFallbackUrl && (
              <button className={styles.dismissBtn} onClick={() => useMusicStore.getState().clearError()}>
                ✕
              </button>
            )}
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const App = () => {
  return <AppContent />;
};

export default App;

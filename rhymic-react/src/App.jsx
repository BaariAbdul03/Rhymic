import React, { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import ProgressBar from './components/ProgressBar';
import styles from './App.module.css';
import { useAudio } from './hooks/useAudio';
import Home from './components/Home'; 
import LikedSongsPage from './components/LikedSongsPage';
import Login from './components/Login';
import Signup from './components/Signup';
import SmartDJ from './components/SmartDJ';
import Discover from './components/Discover';
import PlaylistDetails from './components/PlaylistDetails';
import { useMusicStore } from './store/musicStore';
import { useAuthStore } from './store/authStore';

// Removed ArtistsPage / ArtistDetailsPage imports

function App() {
  useAudio();
  
  const fetchLikedSongs = useMusicStore((state) => state.fetchLikedSongs);
  const fetchSongs = useMusicStore((state) => state.fetchSongs);
  const token = useAuthStore((state) => state.token);

  useEffect(() => {
    fetchSongs();
  }, [fetchSongs]);

  useEffect(() => {
    if (token) {
      fetchLikedSongs();
    }
  }, [token, fetchLikedSongs]);

  return (
    <div className={styles.appContainer}>
       <Sidebar />
       <main className={styles.contentArea}>
        <Topbar />
        <div className={styles.mainDashboard}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/liked" element={<LikedSongsPage />} />
            <Route path="/discover" element={<Discover />} />
            <Route path="/playlist/:id" element={<PlaylistDetails />} />
            <Route path="/dj" element={<SmartDJ />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            {/* Removed Artist Routes */}
          </Routes>
        </div>
      </main>
      <div className={styles.progressBarArea}>
        <ProgressBar />
      </div>
    </div>
  );
}

export default App;
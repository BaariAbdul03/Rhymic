import React, { useState, useEffect, useRef } from 'react';
import { Search, Menu, User as UserIcon, LogOut, Settings as SettingsIcon } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import { useMusicStore } from '../store/musicStore';
import styles from './Topbar.module.css';

const Topbar = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const searchRef = useRef(null);
  const [scrolled, setScrolled] = useState(false);
  
  const user = useAuthStore((state) => state.user);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const songs = useMusicStore((state) => state.songs);
  const setCurrentSong = useMusicStore((state) => state.setCurrentSong);

  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getBreadcrumbs = () => {
    const path = location.pathname;
    if (path === '/') return 'Trending / Hits';
    if (path === '/discover') return 'Discover / Genres';
    if (path.startsWith('/playlist/')) return 'Library / Playlist';
    if (path === '/liked') return 'Library / Favorite Songs';
    if (path === '/dj') return 'AI / Smart DJ';
    if (path === '/subscribe') return 'Podcast';
    if (path === '/upload') return 'Library / Local Files';
    if (path.startsWith('/artist/')) return 'Explore / Artist';
    return 'Rhymic';
  };

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setSearchResults([]);
      setIsDropdownOpen(false);
      return;
    }
    
    const filtered = songs.filter(song =>
      song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      song.artist.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setSearchResults(filtered);
    setIsDropdownOpen(true);
  }, [searchQuery, songs]);

  const handleResultClick = (song) => {
    setCurrentSong(song);
    setSearchQuery('');
    setSearchResults([]);
    setIsDropdownOpen(false);
  };
  
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className={`${styles.topbar} ${scrolled ? styles.scrolled : ''}`}>
      <div className={styles.leftSection}>
        <button className={styles.hamburger} onClick={toggleSidebar}>
          <Menu size={24} />
        </button>

        <div className={styles.breadcrumbs}>
          {getBreadcrumbs()}
        </div>
      </div>

      <div className={styles.searchContainer} ref={searchRef}>
        <div className={styles.searchWrapper}>
          <Search className={styles.searchIcon} size={18} />
          <input 
            type="text" 
            placeholder="Search for artist, songs..." 
            className={styles.searchInput}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => {if(searchQuery.trim() !== '') setIsDropdownOpen(true)}}
          />
        </div>

        <AnimatePresence>
          {isDropdownOpen && searchResults.length > 0 && (
            <motion.div 
              className={styles.searchResults}
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
            >
              {searchResults.map((song, i) => (
                <motion.div 
                  key={song.id} 
                  className={styles.resultItem}
                  onClick={() => handleResultClick(song)}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <img loading="lazy" width="40" height="40" src={song.cover} alt="cover" className={styles.resultCover} onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = "/placeholder-cover.png"; }} />
                  <div className={styles.resultInfo}>
                    <p className={styles.resultTitle}>{song.title}</p>
                    <p className={styles.resultArtist}>{song.artist}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className={styles.rightSection}>
        {user ? (
          <div className={styles.userProfile} onClick={() => navigate('/profile')}>
            <div className={styles.avatarWrapper}>
              {user.profile_pic ? (
                <img src={user.profile_pic} alt="Profile" className={styles.profileImage} />
              ) : (
                <div className={styles.profileFallback}>
                  <UserIcon size={18} />
                </div>
              )}
            </div>
            <span className={styles.userName}>{user.name}</span>
            <button 
              className={styles.logoutBtn} 
              onClick={(e) => { e.stopPropagation(); navigate('/settings'); }}
              title="Settings"
            >
              <SettingsIcon size={18} />
            </button>
            <button 
              className={styles.logoutBtn} 
              onClick={(e) => { e.stopPropagation(); handleLogout(); }}
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        ) : (
          <button className={styles.loginBtn} onClick={() => navigate('/login')}>
            Log In
          </button>
        )}
      </div>
    </header>
  );
};

export default Topbar;
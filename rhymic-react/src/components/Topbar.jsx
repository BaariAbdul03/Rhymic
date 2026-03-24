import React, { useState, useEffect, useRef } from 'react';
import { Search, Menu, User as UserIcon, LogOut } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import { useMusicStore } from '../store/musicStore';
import styles from './Topbar.module.css';

const Topbar = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const searchRef = useRef(null);
  
  const user = useAuthStore((state) => state.user);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const songs = useMusicStore((state) => state.songs);
  const setCurrentSong = useMusicStore((state) => state.setCurrentSong);

  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  const location = useLocation();

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
    if (path === '/podcast') return 'Podcast';
    if (path === '/local-files') return 'Library / Local Files';
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
    <header className={styles.topbar}>
      <div className={styles.leftSection}>
        <button className={styles.hamburger} onClick={toggleSidebar}>
          <Menu size={24} />
        </button>

        <div className={styles.navControls}>
          {/* Toggles Removed per user request */}
        </div>

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

        {isDropdownOpen && searchResults.length > 0 && (
          <div className={styles.searchResults}>
            {searchResults.map((song) => (
              <div 
                key={song.id} 
                className={styles.resultItem}
                onClick={() => handleResultClick(song)}
              >
                <img src={song.cover} alt="cover" className={styles.resultCover} />
                <div className={styles.resultInfo}>
                  <p className={styles.resultTitle}>{song.title}</p>
                  <p className={styles.resultArtist}>{song.artist}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.rightSection}>
        {/* Bell Icon Removed per user request */}

        {user ? (
          <div className={styles.userProfile} onClick={() => navigate('/profile')}>
            {user.profile_pic ? (
              <img src={user.profile_pic} alt="Profile" className={styles.profileImage} />
            ) : (
              <div className={styles.profileFallback}>
                <UserIcon size={18} />
              </div>
            )}
            <span className={styles.userName}>{user.name}</span>
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
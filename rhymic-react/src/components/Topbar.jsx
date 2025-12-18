import React, { useState, useRef, useEffect } from 'react';
import styles from './Topbar.module.css';
import { Search, User, Camera } from 'lucide-react';
import { useMusicStore } from '../store/musicStore';
import { useAuthStore } from '../store/authStore';
import { Link } from 'react-router-dom';

const Topbar = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isFocused, setIsFocused] = useState(false);
  const searchRef = useRef(null);

  const user = useAuthStore((state) => state.user);
  const updateAvatar = useAuthStore((state) => state.updateAvatar);
  const [showProfile, setShowProfile] = useState(false);
  
  const allSongs = useMusicStore((state) => state.songs);
  const setCurrentSong = useMusicStore((state) => state.setCurrentSong);

  const BASE_URL = 'http://127.0.0.1:5000';
  const avatarUrl = user?.profile_pic ? `${BASE_URL}${user.profile_pic}` : null;

  // --- SEARCH LOGIC ---
  useEffect(() => {
    if (query.trim() === '') {
      setResults([]);
      return;
    }
    const lowerQuery = query.toLowerCase();
    const filtered = allSongs.filter(song => 
      song.title.toLowerCase().includes(lowerQuery) ||
      song.artist.toLowerCase().includes(lowerQuery)
    );
    setResults(filtered);
  }, [query, allSongs]);

  const handleResultClick = (song) => {
    setCurrentSong(song);
    setQuery('');
    setResults([]);
    setIsFocused(false);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // --- PROFILE LOGIC ---
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) updateAvatar(file);
  };

  return (
    <nav className={styles.topbar}>
      
      {/* 1. SEARCH SECTION (Restored) */}
      <div className={styles.searchWrapper} ref={searchRef}>
        <div className={styles.searchContainer}>
          <Search size={18} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search music, artists..."
            className={styles.searchInput}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
          />
        </div>
        
        {/* Search Dropdown */}
        {isFocused && query.length > 0 && (
          <div className={styles.resultsDropdown}>
            {results.length > 0 ? (
              results.map(song => (
                <div key={song.id} className={styles.resultItem} onClick={() => handleResultClick(song)}>
                  <img src={song.cover} alt={song.title} className={styles.resultCover} />
                  <div className={styles.resultInfo}>
                    <h4>{song.title}</h4>
                    <p>{song.artist}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className={styles.message}>No matches found</div>
            )}
          </div>
        )}
      </div>

      {/* 2. USER CONTROLS (Right Side) */}
      <div className={styles.userControls}>
        
        <div style={{position: 'relative'}}>
            <button 
                className={styles.userIcon} 
                onClick={() => setShowProfile(!showProfile)}
            >
                {avatarUrl ? (
                    <img src={avatarUrl} alt="Profile" style={{width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover'}} />
                ) : (
                    <User size={20} />
                )}
            </button>

            {/* Profile Popup */}
            {showProfile && (
                <div className={styles.profilePopup}>
                    <div className={styles.popupHeader}>
                        <div className={styles.bigAvatar}>
                             {avatarUrl ? <img src={avatarUrl} alt="" /> : <User size={40} />}
                             <label className={styles.uploadBtn}>
                                <Camera size={16} />
                                <input type="file" hidden onChange={handleFileChange} accept="image/*"/>
                             </label>
                        </div>
                        <h3>{user?.name || "Guest"}</h3>
                        <p>{user?.email}</p>
                    </div>
                </div>
            )}
        </div>

        <button className={styles.subscribeButton}>Subscribe</button>
      </div>
    </nav>
  );
};

export default Topbar;
import React, { useState, useEffect, useRef } from 'react';
import { Search, Menu, User as UserIcon, LogOut, Settings as SettingsIcon } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
/* eslint-disable-next-line no-unused-vars */
import { motion, AnimatePresence } from 'motion/react';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import { useMusicStore } from '../store/musicStore';
import { streamApi } from '../services/api';
import SongCover from './SongCover';
import styles from './Topbar.module.css';

const Topbar = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState({ songs: [], artists: [], playlists: [], online: [] });
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const searchRef = useRef(null);
  const [scrolled, setScrolled] = useState(false);
  
  const user = useAuthStore((state) => state.user);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const songs = useMusicStore((state) => state.songs);
  const playlists = useMusicStore((state) => state.playlists);
  const setCurrentSong = useMusicStore((state) => state.setCurrentSong);
  const setQueue = useMusicStore((state) => state.setQueue);

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
    return 'RhyMic';
  };

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setSearchResults({ songs: [], artists: [], playlists: [], online: [] });
      setSearchError('');
      setIsDropdownOpen(false);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filteredSongs = songs
      .filter(song =>
        song.title.toLowerCase().includes(query) ||
        song.artist.toLowerCase().includes(query)
      )
      .slice(0, 5);
    const artistMap = new Map();
    songs.forEach((song) => {
      if (song.artist?.toLowerCase().includes(query) && !artistMap.has(song.artist)) {
        artistMap.set(song.artist, song);
      }
    });
    const filteredPlaylists = playlists
      .filter((playlist) => playlist.name?.toLowerCase().includes(query))
      .slice(0, 4);

    setSearchResults({ songs: filteredSongs, artists: Array.from(artistMap.values()).slice(0, 4), playlists: filteredPlaylists, online: [] });
    setIsDropdownOpen(true);
    setSearchLoading(true);
    setSearchError('');

    const timeout = setTimeout(async () => {
      try {
        const statusRes = await streamApi.status();
        if (statusRes.data?.enabled === false) {
          setSearchLoading(false);
          return;
        }
        const res = await streamApi.search(searchQuery);
        setSearchResults((current) => ({ ...current, online: Array.isArray(res.data) ? res.data.slice(0, 5) : [] }));
      } catch {
        setSearchError('Online search unavailable');
      } finally {
        setSearchLoading(false);
      }
    }, 350);

    return () => clearTimeout(timeout);
  }, [searchQuery, songs, playlists]);

  const handleResultClick = (song) => {
    setQueue([song]);
    setCurrentSong(song);
    setSearchQuery('');
    setSearchResults({ songs: [], artists: [], playlists: [], online: [] });
    setIsDropdownOpen(false);
  };

  const closeSearch = () => {
    setSearchQuery('');
    setSearchResults({ songs: [], artists: [], playlists: [], online: [] });
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
              placeholder="Search songs, artists, playlists, online..." 
            className={styles.searchInput}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => {if(searchQuery.trim() !== '') setIsDropdownOpen(true)}}
          />
        </div>

        <AnimatePresence>
          {isDropdownOpen && (
            <motion.div 
              className={styles.searchResults}
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
            >
              {searchResults.songs.length > 0 && (
                <div className={styles.resultSection}>
                  <p className={styles.resultSectionTitle}>Songs</p>
                  {searchResults.songs.map((song, i) => (
                    <motion.div key={`song-${song.id}`} className={styles.resultItem} onClick={() => handleResultClick(song)} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
                      <SongCover src={song.cover} alt={song.title} size="small" className={styles.resultCover} />
                      <div className={styles.resultInfo}>
                        <p className={styles.resultTitle}>{song.title}</p>
                        <p className={styles.resultArtist}>{song.artist}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {searchResults.artists.length > 0 && (
                <div className={styles.resultSection}>
                  <p className={styles.resultSectionTitle}>Artists</p>
                  {searchResults.artists.map((song) => (
                    <div key={`artist-${song.artist}`} className={styles.resultItem} onClick={() => { navigate(`/artist/${encodeURIComponent(song.artist)}`); closeSearch(); }}>
                      <SongCover src={song.cover} alt={song.artist} size="small" className={styles.resultCover} />
                      <div className={styles.resultInfo}>
                        <p className={styles.resultTitle}>{song.artist}</p>
                        <p className={styles.resultArtist}>Artist</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {searchResults.playlists.length > 0 && (
                <div className={styles.resultSection}>
                  <p className={styles.resultSectionTitle}>Playlists</p>
                  {searchResults.playlists.map((playlist) => (
                    <div key={`playlist-${playlist.id}`} className={styles.resultItem} onClick={() => { navigate(`/playlist/${playlist.id}`); closeSearch(); }}>
                      <div className={styles.resultIcon}>PL</div>
                      <div className={styles.resultInfo}>
                        <p className={styles.resultTitle}>{playlist.name}</p>
                        <p className={styles.resultArtist}>Playlist</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {searchResults.online.length > 0 && (
                <div className={styles.resultSection}>
                  <p className={styles.resultSectionTitle}>Online</p>
                  {searchResults.online.map((song) => (
                    <div key={`online-${song.id}`} className={styles.resultItem} onClick={() => handleResultClick(song)}>
                      <SongCover src={song.cover} alt={song.title} size="small" className={styles.resultCover} />
                      <div className={styles.resultInfo}>
                        <p className={styles.resultTitle}>{song.title}</p>
                        <p className={styles.resultArtist}>{song.artist}</p>
                      </div>
                      <span className={styles.onlineBadge}>Online</span>
                    </div>
                  ))}
                </div>
              )}

              {searchLoading && <p className={styles.searchState}>Searching online catalog...</p>}
              {searchError && <p className={styles.searchState}>{searchError}</p>}
              {!searchLoading && !searchError && Object.values(searchResults).every((items) => items.length === 0) && (
                <p className={styles.searchState}>No matching songs, artists, playlists, or online tracks.</p>
              )}
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

import React, { useEffect } from 'react';
import styles from './Sidebar.module.css';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, Compass, Heart, ListMusic, PlusSquare, LogOut, Moon, Sun, Sparkles } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useMusicStore } from '../store/musicStore';
import { useThemeStore } from '../store/themeStore';

const Sidebar = () => {
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  
  const playlists = useMusicStore((state) => state.playlists);
  const fetchPlaylists = useMusicStore((state) => state.fetchPlaylists);
  const createPlaylist = useMusicStore((state) => state.createPlaylist);
  const token = useAuthStore((state) => state.token);

  // Theme State
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const initTheme = useThemeStore((state) => state.initTheme);

  useEffect(() => {
    initTheme();
    if (token) fetchPlaylists();
  }, [token, fetchPlaylists, initTheme]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // --- RESTORED FUNCTION ---
  const handleCreatePlaylist = () => {
    const name = prompt("Enter playlist name:");
    if (name) {
      createPlaylist(name);
    }
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logoHeader}>
        <div className={styles.logo}>Rhymic</div>
        <button onClick={toggleTheme} className={styles.themeBtn}>
          {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
        </button>
      </div>
      
      <nav className={styles.menu}>
        <h2 className={styles.menuTitle}>Menu</h2>
        <NavLink to="/" end className={({ isActive }) => `${styles.menuItem} ${isActive ? styles.active : ''}`}>
          <Home size={20} /> <span>Home</span>
        </NavLink>
        <NavLink to="/dj" className={({ isActive }) => `${styles.menuItem} ${isActive ? styles.active : ''}`}>
          <Sparkles size={20} style={{ color: 'var(--accent-color)' }} /> <span>Smart DJ</span>
        </NavLink>
        <NavLink to="/discover" className={({ isActive }) => `${styles.menuItem} ${isActive ? styles.active : ''}`}>
          <Compass size={20} /> <span>Discover</span>
        </NavLink>
        <NavLink to="/liked" className={({ isActive }) => `${styles.menuItem} ${isActive ? styles.active : ''}`}>
          <Heart size={20} /> <span>Liked Songs</span>
        </NavLink>
      </nav>

      <nav className={styles.menu}>
        <div className={styles.libraryHeader}>
          <h2 className={styles.menuTitle} style={{marginBottom: 0}}>Library</h2>
          <button onClick={handleCreatePlaylist} className={styles.createButton}>
            <PlusSquare size={18} />
          </button>
        </div>
        
        {playlists.length > 0 ? (
          playlists.map((playlist) => (
            <NavLink 
              key={playlist.id}
              to={`/playlist/${playlist.id}`} 
              className={({ isActive }) => `${styles.menuItem} ${isActive ? styles.active : ''}`}
            >
              <ListMusic size={20} />
              <span>{playlist.name}</span>
            </NavLink>
          ))
        ) : (
          <p className={styles.emptyText}>No playlists yet</p>
        )}
      </nav>

      <div style={{ marginTop: 'auto' }}>
        <button onClick={handleLogout} className={styles.menuItem} style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer' }}>
          <LogOut size={20} color="#e53e3e" />
          <span style={{ color: '#e53e3e' }}>Log Out</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
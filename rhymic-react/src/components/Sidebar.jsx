import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { ListMusic, Home, Compass, Radio, Disc, Mic2, PlusSquare, LogOut, Heart, Sparkles, Plus } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useMusicStore } from '../store/musicStore';
import { useUIStore } from '../store/uiStore';
import Modal from './Modal';
import styles from './Sidebar.module.css';

const Sidebar = () => {
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  
  const playlists = useMusicStore((state) => state.playlists);
  const fetchPlaylists = useMusicStore((state) => state.fetchPlaylists);
  const createPlaylist = useMusicStore((state) => state.createPlaylist);
  const token = useAuthStore((state) => state.token);

  // UI State
  const { isSidebarOpen, closeSidebar } = useUIStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  useEffect(() => {
    // Keep dark mode forced
    document.documentElement.setAttribute('data-theme', 'dark');
    if (token) fetchPlaylists();
  }, [token, fetchPlaylists]);

  const handleLogout = () => {
    closeSidebar();
    logout();
    navigate('/login');
  };

  const handleCreatePlaylistClick = () => {
    closeSidebar();
    setIsModalOpen(true);
  };

  const handleCreatePlaylistSubmit = (e) => {
    e.preventDefault();
    if (newPlaylistName.trim()) {
      createPlaylist(newPlaylistName.trim());
      setIsModalOpen(false);
      setNewPlaylistName('');
    }
  };

  const onNavClick = () => {
    closeSidebar();
  };

  return (
    <>
      <div 
        className={`${styles.overlay} ${isSidebarOpen ? styles.visible : ''}`} 
        onClick={closeSidebar}
      />
      <aside className={`${styles.sidebar} ${isSidebarOpen ? styles.mobileOpen : ''}`}>
        <div className={styles.logoHeader}>
          <div className={styles.logo}>
            <Sparkles size={24} color="var(--accent-primary)" />
            <span>Rhymic</span>
          </div>
        </div>
        
        <nav className={styles.menu}>
          <NavLink onClick={onNavClick} to="/" end className={({ isActive }) => `${styles.menuItem} ${isActive ? styles.active : ''}`}>
            <Home size={20} /> <span>Home</span>
          </NavLink>
          <NavLink onClick={onNavClick} to="/discover" className={({ isActive }) => `${styles.menuItem} ${isActive ? styles.active : ''}`}>
            <Compass size={20} /> <span>Discover</span>
          </NavLink>
          <NavLink onClick={onNavClick} to="/dj" className={({ isActive }) => `${styles.menuItem} ${isActive ? styles.active : ''}`}>
             <Radio size={20} /> <span>Smart DJ</span>
          </NavLink>
          <NavLink onClick={onNavClick} to="/subscribe" className={({ isActive }) => `${styles.menuItem} ${isActive ? styles.active : ''}`}>
             <Mic2 size={20} /> <span>Podcast</span>
          </NavLink>
        </nav>

        <nav className={styles.menu}>
          <h2 className={styles.menuTitle}>LIBRARY</h2>
          <NavLink onClick={onNavClick} to="/liked" className={({ isActive }) => `${styles.menuItem} ${isActive ? styles.active : ''}`}>
            <Heart size={20} /> <span>Favorite Songs</span>
          </NavLink>
           <NavLink onClick={onNavClick} to="/upload" className={({ isActive }) => `${styles.menuItem} ${isActive ? styles.active : ''}`}>
            <PlusSquare size={20} /> <span>Local Files</span>
          </NavLink>
        </nav>

        <nav className={styles.menu}>
          <div className={styles.libraryHeader}>
            <h2 className={styles.menuTitle}>PLAYLIST</h2>
            <button onClick={handleCreatePlaylistClick} className={styles.createButton}>
              <Plus size={16} strokeWidth={2.5} />
            </button>
          </div>
          
          <div className={styles.playlistScroll}>
            {playlists.length > 0 ? (
              playlists.map((playlist) => (
                <NavLink 
                  key={playlist.id}
                  onClick={onNavClick}
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
          </div>
        </nav>

      </aside>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        title="Create Playlist"
      >
        <form onSubmit={handleCreatePlaylistSubmit} className={styles.modalForm}>
          <input 
            type="text" 
            placeholder="New playlist name..." 
            value={newPlaylistName}
            onChange={(e) => setNewPlaylistName(e.target.value)}
            className={styles.modalInput}
            autoFocus
          />
          <div className={styles.modalActions}>
            <button type="button" onClick={() => setIsModalOpen(false)} className={styles.cancelBtn}>
              Cancel
            </button>
            <button type="submit" disabled={!newPlaylistName.trim()} className={styles.submitBtn}>
              Create
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
};

export default Sidebar;
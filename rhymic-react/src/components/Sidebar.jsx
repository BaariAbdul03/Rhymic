import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { ListMusic, Home, Compass, Radio, Mic2, PlusSquare, Heart, Sparkles, Plus, Globe, Settings as SettingsIcon, ChevronsLeft, ChevronsRight } from 'lucide-react';
/* eslint-disable-next-line no-unused-vars */
import { motion, AnimatePresence } from 'motion/react';
import { useAuthStore } from '../store/authStore';
import { useMusicStore } from '../store/musicStore';
import { useUIStore } from '../store/uiStore';
import Modal from './Modal';
import styles from './Sidebar.module.css';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 260, damping: 20 } }
};

const Sidebar = () => {
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  
  const playlists = useMusicStore((state) => state.playlists);
  const fetchPlaylists = useMusicStore((state) => state.fetchPlaylists);
  const createPlaylist = useMusicStore((state) => state.createPlaylist);
  const token = useAuthStore((state) => state.token);

  // UI State
  const isSidebarOpen = useUIStore((state) => state.isSidebarOpen);
  const isSidebarCompact = useUIStore((state) => state.isSidebarCompact);
  const closeSidebar = useUIStore((state) => state.closeSidebar);
  const toggleSidebarCompact = useUIStore((state) => state.toggleSidebarCompact);
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
      <aside className={`${styles.sidebar} ${isSidebarOpen ? styles.mobileOpen : ''} ${isSidebarCompact ? styles.compact : ''}`}>
        <div className={styles.logoHeader}>
          <div className={styles.logo}>
            <Sparkles size={24} color="var(--accent-primary)" />
            <span>RhyMic</span>
          </div>
          <button className={styles.compactToggle} onClick={toggleSidebarCompact} title={isSidebarCompact ? 'Expand sidebar' : 'Compact sidebar'}>
            {isSidebarCompact ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
          </button>
        </div>
        
        <motion.nav 
          className={styles.menu}
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={itemVariants}>
            <NavLink onClick={onNavClick} to="/" end className={({ isActive }) => `${styles.menuItem} ${isActive ? styles.active : ''}`}>
              <Home size={20} /> <span>Home</span>
            </NavLink>
          </motion.div>
          <motion.div variants={itemVariants}>
            <NavLink onClick={onNavClick} to="/discover" className={({ isActive }) => `${styles.menuItem} ${isActive ? styles.active : ''}`}>
              <Compass size={20} /> <span>Discover</span>
            </NavLink>
          </motion.div>
          <motion.div variants={itemVariants}>
            <NavLink onClick={onNavClick} to="/dj" className={({ isActive }) => `${styles.menuItem} ${isActive ? styles.active : ''}`}>
               <Radio size={20} /> <span>Smart DJ</span>
            </NavLink>
          </motion.div>
          <motion.div variants={itemVariants}>
            <NavLink onClick={onNavClick} to="/explore" className={({ isActive }) => `${styles.menuItem} ${isActive ? styles.active : ''}`}>
               <Globe size={20} /> <span>Explore Online</span>
            </NavLink>
          </motion.div>
          <motion.div variants={itemVariants}>
            <NavLink onClick={onNavClick} to="/subscribe" className={({ isActive }) => `${styles.menuItem} ${isActive ? styles.active : ''}`}>
               <Mic2 size={20} /> <span>Podcast</span>
            </NavLink>
          </motion.div>
          <motion.div variants={itemVariants}>
            <NavLink onClick={onNavClick} to="/settings" className={({ isActive }) => `${styles.menuItem} ${isActive ? styles.active : ''}`}>
               <SettingsIcon size={20} /> <span>Settings</span>
            </NavLink>
          </motion.div>
        </motion.nav>

        <motion.nav 
          className={styles.menu}
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.h2 variants={itemVariants} className={styles.menuTitle}>LIBRARY</motion.h2>
          <motion.div variants={itemVariants}>
            <NavLink onClick={onNavClick} to="/liked" className={({ isActive }) => `${styles.menuItem} ${isActive ? styles.active : ''}`}>
              <Heart size={20} /> <span>Favorite Songs</span>
            </NavLink>
          </motion.div>
          <motion.div variants={itemVariants}>
             <NavLink onClick={onNavClick} to="/upload" className={({ isActive }) => `${styles.menuItem} ${isActive ? styles.active : ''}`}>
              <PlusSquare size={20} /> <span>Local Files</span>
            </NavLink>
          </motion.div>
        </motion.nav>

        <motion.nav 
          className={styles.menu}
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={itemVariants} className={styles.libraryHeader}>
            <h2 className={styles.menuTitle}>PLAYLIST</h2>
            <button onClick={handleCreatePlaylistClick} className={styles.createButton}>
              <Plus size={16} strokeWidth={2.5} />
            </button>
          </motion.div>
          
          <div className={styles.playlistScroll}>
            <AnimatePresence>
              {playlists.length > 0 ? (
                playlists.map((playlist) => (
                  <motion.div
                    key={playlist.id}
                    variants={itemVariants}
                    initial="hidden"
                    animate="visible"
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <NavLink 
                      onClick={onNavClick}
                      to={`/playlist/${playlist.id}`} 
                      className={({ isActive }) => `${styles.menuItem} ${isActive ? styles.active : ''}`}
                    >
                      <ListMusic size={20} />
                      <span>{playlist.name}</span>
                    </NavLink>
                  </motion.div>
                ))
              ) : (
                <motion.p variants={itemVariants} className={styles.emptyText}>No playlists yet</motion.p>
              )}
            </AnimatePresence>
          </div>
        </motion.nav>

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

import React, { useRef, useEffect } from 'react';
import styles from './Profile.module.css';
import { useAuthStore } from '../store/authStore';
import { Camera, Mail, User } from 'lucide-react';

const Profile = () => {
  const user = useAuthStore((state) => state.user);
  const fetchUser = useAuthStore((state) => state.fetchUser);
  
  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  if (!user) return <div style={{padding: 40, textAlign:'center'}}>Loading Profile...</div>;

  const PLACEHOLDER_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150' viewBox='0 0 150 150'%3E%3Crect width='150' height='150' fill='%23cccccc'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='Arial' font-size='24' fill='%23666666'%3EUser%3C/text%3E%3C/svg%3E";

  const profilePic = user.profile_pic || PLACEHOLDER_IMG;

  return (
    <div className={styles.profileContainer}>
      <div className={styles.card}>
        <div className={styles.avatarWrapper} style={{ cursor: 'default' }}>
          <img 
            src={profilePic} 
            alt="Profile" 
            className={styles.avatar} 
            onError={(e) => { e.target.onerror = null; e.target.src = PLACEHOLDER_IMG; }}
          />
        </div>
        
        <h1 className={styles.name}>{user.name}</h1>
        <p className={styles.email}>{user.email}</p>

        <div className={styles.infoGroup}>
          <div style={{marginBottom: 20}}>
            <span className={styles.label}>Username</span>
            <div className={styles.value} style={{display:'flex', alignItems:'center', gap: 10}}>
              <User size={18} /> {user.name}
            </div>
          </div>
          
          <div>
            <span className={styles.label}>Email Address</span>
            <div className={styles.value} style={{display:'flex', alignItems:'center', gap: 10}}>
              <Mail size={18} /> {user.email}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
import React, { useState, useRef } from 'react';
import { 
  Shield, 
  ShieldCheck, 
  ShieldAlert, 
  Key, 
  User as UserIcon, 
  Camera, 
  Lock, 
  Mail,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import styles from './Settings.module.css';

const Settings = () => {
  const { user, setup2FA, enable2FA, updateProfile, uploadProfilePic, changePassword } = useAuthStore();
  const fileInputRef = useRef(null);

  // Profile State
  const [name, setName] = useState(user?.name || '');
  const [profileLoading, setProfileLoading] = useState(false);

  // Security / 2FA State
  const [setupData, setSetupData] = useState(null);
  const [twoFACode, setTwoFACode] = useState('');
  const [securityLoading, setSecurityLoading] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  
  // Password State
  const [passwords, setPasswords] = useState({ old: '', new: '', confirm: '' });

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    if (name === user.name) return;
    setProfileLoading(true);
    const success = await updateProfile({ name });
    if (success) toast.success("Profile updated!");
    setProfileLoading(false);
  };

  const handleAvatarClick = () => fileInputRef.current.click();

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setProfileLoading(true);
    const success = await uploadProfilePic(file);
    if (success) toast.success("Profile picture updated!");
    else toast.error("Failed to upload image.");
    setProfileLoading(false);
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setSecurityLoading(true);
    const success = await changePassword(passwords.old, passwords.new);
    if (success) {
      toast.success("Password changed successfully!");
      setShowPasswordForm(false);
      setPasswords({ old: '', new: '', confirm: '' });
    }
    setSecurityLoading(false);
  };

  const handle2FASetup = async () => {
    setSecurityLoading(true);
    const data = await setup2FA();
    if (data) setSetupData(data);
    setSecurityLoading(false);
  };

  const handle2FAVerify = async () => {
    setSecurityLoading(true);
    const success = await enable2FA(twoFACode);
    if (success) {
      toast.success("2FA Enabled!");
      setSetupData(null);
    }
    setSecurityLoading(false);
  };

  if (!user) return null;

  return (
    <motion.div 
      className={styles.container}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <header className={styles.header}>
        <h1>Settings</h1>
        <p>Manage your account identity and security preferences.</p>
      </header>

      {/* --- Profile Section --- */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <UserIcon size={22} color="var(--accent-primary)" />
          <h2>Profile Details</h2>
        </div>

        <div className={styles.profileGrid}>
          <div className={styles.avatarSection}>
            <div className={styles.avatarContainer}>
              <img 
                src={user.profile_pic || '/assets/default_avatar.png'} 
                alt={user.name} 
                className={styles.avatar} 
              />
              <div className={styles.avatarOverlay} onClick={handleAvatarClick}>
                <Camera size={24} />
                <span>Change</span>
              </div>
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              hidden 
              accept="image/*" 
              onChange={handleFileChange} 
            />
          </div>

          <form className={styles.formGroup} onSubmit={handleProfileUpdate}>
            <div className={styles.inputField}>
              <label>Display Name</label>
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                placeholder="Your Name"
              />
            </div>
            <div className={styles.inputField}>
              <label>Email Address</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', opacity: 0.6 }}>
                <Mail size={18} />
                <span>{user.email}</span>
                <CheckCircle2 size={14} color="#4cd964" />
              </div>
            </div>
            <button 
              type="submit" 
              className={styles.saveBtn}
              disabled={profileLoading || name === user.name}
            >
              {profileLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>
      </section>

      {/* --- Security Section --- */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <Shield size={22} color="var(--accent-primary)" />
          <h2>Security & Privacy</h2>
        </div>

        {/* Change Password Toggle */}
        <div className={styles.securityItem}>
          <div className={styles.securityInfo}>
            <h3>Account Password</h3>
            <p>Update your password regularly to keep your account secure.</p>
          </div>
          <button 
            className={styles.actionBtn} 
            onClick={() => setShowPasswordForm(!showPasswordForm)}
          >
            {showPasswordForm ? 'Cancel' : 'Change Password'}
          </button>
        </div>

        <AnimatePresence>
          {showPasswordForm && (
            <motion.form 
              className={styles.setupCard}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              onSubmit={handlePasswordChange}
            >
              <div className={styles.formGroup}>
                <div className={styles.inputField}>
                  <label>Current Password</label>
                  <input 
                    type="password" 
                    required 
                    value={passwords.old}
                    onChange={e => setPasswords({...passwords, old: e.target.value})}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className={styles.inputField}>
                    <label>New Password</label>
                    <input 
                      type="password" 
                      required 
                      value={passwords.new}
                      onChange={e => setPasswords({...passwords, new: e.target.value})}
                    />
                  </div>
                  <div className={styles.inputField}>
                    <label>Confirm Password</label>
                    <input 
                      type="password" 
                      required 
                      value={passwords.confirm}
                      onChange={e => setPasswords({...passwords, confirm: e.target.value})}
                    />
                  </div>
                </div>
                <button type="submit" className={styles.saveBtn} disabled={securityLoading}>
                  {securityLoading ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {/* 2FA Item */}
        <div className={styles.securityItem}>
          <div className={styles.securityInfo}>
            <h3 style={{ color: user.is_two_factor_enabled ? '#4cd964' : 'inherit' }}>
              Two-Factor Authentication
              {user.is_two_factor_enabled ? <ShieldCheck size={18} /> : <ShieldAlert size={18} color="#ff9500" />}
            </h3>
            <p>Add an extra layer of security using an authenticator app.</p>
          </div>
          {!user.is_two_factor_enabled && !setupData && (
            <button className={`${styles.actionBtn} ${styles.accentBtn}`} onClick={handle2FASetup}>
              Enable 2FA
            </button>
          )}
          {user.is_two_factor_enabled && (
            <div className={styles.success}>
              <CheckCircle2 size={16} /> Verified
            </div>
          )}
        </div>

        {/* 2FA Setup Flow */}
        <AnimatePresence>
          {setupData && (
            <motion.div 
              className={styles.setupCard}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <h4 style={{ margin: '0 0 12px 0' }}>Authenticator Setup</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                1. Scan the QR code or enter the key: <code>{setupData.secret}</code>
              </p>
              
              <div className={styles.qrContainer}>
                <div className={styles.qrCode}>
                  <img src={setupData.qr_code} alt="QR" width={140} height={140} />
                </div>
                <div className={styles.qrDetails}>
                  <div className={styles.inputField}>
                    <label>Verification Code</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input 
                        type="text" 
                        placeholder="000000" 
                        maxLength={6}
                        value={twoFACode}
                        onChange={e => setTwoFACode(e.target.value.replace(/\D/g, ''))}
                        style={{ flex: 1, letterSpacing: '4px', textAlign: 'center', fontSize: '1.2rem' }}
                      />
                      <button 
                        className={styles.saveBtn} 
                        style={{ marginTop: 0 }}
                        onClick={handle2FAVerify}
                        disabled={twoFACode.length !== 6 || securityLoading}
                      >
                        Verify
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

    </motion.div>
  );
};

export default Settings;

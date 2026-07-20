// src/components/Login.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
/* eslint-disable-next-line no-unused-vars */
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, Eye, EyeOff, CheckCircle, KeyRound, ShieldAlert } from 'lucide-react';
import styles from './Auth.module.css';
import { useAuthStore } from '../store/authStore';
import { useMusicStore } from '../store/musicStore';

const Login = ({ initialSignup = false }) => {
  const [mode, setMode] = useState(initialSignup ? 'signup' : 'login'); // 'login', 'signup', 'forgot', 'reset', 'tfa'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState(''); // For 2FA or Reset PIN
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  
  // Validation tracking
  const [touched, setTouched] = useState({ name: false, email: false, password: false, code: false });
  const [localError, setLocalError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const navigate = useNavigate();
  const { login, signup, forgotPassword, resetPassword, verify2FA, error: authError } = useAuthStore();
  
  // Fetch existing covers to use as dynamic background
  const songs = useMusicStore((state) => state.songs);
  const bgImage = songs.length > 0 ? songs[0].cover : 'https://images.unsplash.com/photo-1614680376593-902f74cf0d41?q=80&w=1000';

  useEffect(() => {
    // Clear errors when toggling modes
    setLocalError(null);
    setSuccessMessage(null);
    setTouched({ name: false, email: false, password: false, code: false });
    useAuthStore.setState({ error: null });
  }, [mode]);

  const validateEmail = (val) => {
    return /^\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b/.test(val);
  };

  const validatePasswordStrength = (val) => {
    if (val.length < 8 || !/\d/.test(val)) return 'weak';
    if (val.length >= 12 && /\d/.test(val) && /[^A-Za-z0-9]/.test(val)) return 'strong';
    return 'fair';
  };

  const isNameValid = /^\w{3,30}$/.test(name);
  const isEmailValid = validateEmail(email);
  const pwdStrength = validatePasswordStrength(password);
  const isPwdValid = pwdStrength !== 'weak';

  const handleBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError(null);
    setSuccessMessage(null);
    setIsLoading(true);

    if (mode === 'signup') {
      if (!isNameValid || !isEmailValid || !isPwdValid) {
        setLocalError("Please fix validation errors.");
        setIsLoading(false);
        return;
      }
      const success = await signup(name, email, password);
      if (success) {
        setMode('login');
        setSuccessMessage("Account created! Please log in.");
      }
    } 
    else if (mode === 'login') {
      const result = await login(email, password, rememberMe);
      if (result === '2fa_required') {
        setMode('tfa');
      } else if (result) {
        navigate('/');
      }
    }
    else if (mode === 'forgot') {
      if (!isEmailValid) {
        setLocalError("Enter a valid email.");
        setIsLoading(false);
        return;
      }
      const res = await forgotPassword(email);
      if (res) {
        setMode('reset');
        setSuccessMessage(res.message);
      }
    }
    else if (mode === 'reset') {
      if (!isPwdValid) {
        setLocalError("Password must be at least 8 characters and contain a number.");
        setIsLoading(false);
        return;
      }
      const res = await resetPassword(email, code, password);
      if (res) {
        setMode('login');
        setPassword('');
        setCode('');
        setSuccessMessage("Password reset successfully! Log in normally.");
      }
    }
    else if (mode === 'tfa') {
      const success = await verify2FA(code, rememberMe);
      if (success) {
        navigate('/');
      }
    }

    setIsLoading(false);
  };

  const renderStrengthBar = () => {
    if ((mode !== 'signup' && mode !== 'reset') || password.length === 0) return null;
    let colors = ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.1)', 'rgba(255,255,255,0.1)'];
    if (pwdStrength === 'weak') colors[0] = '#ff4d4d';
    if (pwdStrength === 'fair') { colors[0] = '#ffd60a'; colors[1] = '#ffd60a'; }
    if (pwdStrength === 'strong') { colors[0] = '#34c759'; colors[1] = '#34c759'; colors[2] = '#34c759'; }

    return (
      <div className={styles.passwordStrength}>
        <div className={styles.strengthSegment} style={{ background: colors[0] }} />
        <div className={styles.strengthSegment} style={{ background: colors[1] }} />
        <div className={styles.strengthSegment} style={{ background: colors[2] }} />
      </div>
    );
  };

  const displayError = localError || authError;

  return (
    <div className={styles.authContainer}>
      <div 
        className={`${styles.authBackground} ${styles.authBackgroundMobile}`} 
        style={{ backgroundImage: `url(${bgImage})` }} 
      />
      
      <AnimatePresence mode="wait">
        <motion.div 
          key={mode}
          className={styles.authCard}
          initial={{ opacity: 0, y: 40, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -40, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 240, damping: 24 }}
        >
          <div className={styles.logoArea}>
            <h1 className={styles.logoText}>RhyMic<span className={styles.logoAccent}>.</span></h1>
          </div>

          <h2 className={styles.title}>
            {mode === 'login' && "Welcome Back"}
            {mode === 'signup' && "Create an Account"}
            {mode === 'forgot' && "Recover Account"}
            {mode === 'reset' && "Set New Password"}
            {mode === 'tfa' && "Two-Step Verification"}
          </h2>
          <p className={styles.subtitle}>
            {mode === 'login' && "Log in to continue to RhyMic"}
            {mode === 'signup' && "Join the golden standard of streaming"}
            {mode === 'forgot' && "Enter your email to receive a 6-digit PIN"}
            {mode === 'reset' && "Enter the PIN sent to your email"}
            {mode === 'tfa' && "Enter the 6-digit code from your authenticator app"}
          </p>
          
          {displayError && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className={styles.errorPill}>
              {displayError}
            </motion.div>
          )}

          {successMessage && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} style={{ background: 'rgba(76,217,100,0.15)', color: '#4cd964', border: '1px solid rgba(76,217,100,0.3)' }} className={styles.errorPill}>
              {successMessage}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className={styles.form}>
            {mode === 'signup' && (
              <div className={styles.inputGroup}>
                <label>Username</label>
                <div className={`${styles.inputWrapper} ${touched.name && !isNameValid ? styles.invalid : ''}`}>
                  <User size={18} className={styles.inputIcon} />
                  <input 
                    type="text" 
                    placeholder="Alphanumeric & underscores"
                    className={styles.inputField}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={() => handleBlur('name')}
                    required
                  />
                  {touched.name && isNameValid && <CheckCircle size={16} className={styles.validIcon} />}
                </div>
              </div>
            )}

            {(mode === 'login' || mode === 'signup' || mode === 'forgot') && (
              <div className={styles.inputGroup}>
                <label>Email</label>
                <div className={`${styles.inputWrapper} ${touched.email && !isEmailValid ? styles.invalid : ''}`}>
                  <Mail size={18} className={styles.inputIcon} />
                  <input 
                    type="email" 
                    placeholder="Enter your email"
                    className={styles.inputField}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={() => handleBlur('email')}
                    required
                  />
                  {touched.email && isEmailValid && <CheckCircle size={16} className={styles.validIcon} />}
                </div>
              </div>
            )}

            {(mode === 'reset' || mode === 'tfa') && (
              <div className={styles.inputGroup}>
                <label>{mode === 'reset' ? '6-Digit PIN' : 'Authenticator Code'}</label>
                <div className={`${styles.inputWrapper}`}>
                  {mode === 'tfa' ? <ShieldAlert size={18} className={styles.inputIcon} /> : <KeyRound size={18} className={styles.inputIcon} />}
                  <input 
                    type="text" 
                    placeholder="123456"
                    className={styles.inputField}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                    required
                  />
                </div>
              </div>
            )}
            
            {(mode === 'login' || mode === 'signup' || mode === 'reset') && (
              <div className={styles.inputGroup}>
                <label>{mode === 'reset' ? 'New Password' : 'Password'}</label>
                <div className={`${styles.inputWrapper} ${touched.password && (mode === 'signup' || mode === 'reset') && !isPwdValid ? styles.invalid : ''}`}>
                  <Lock size={18} className={styles.inputIcon} />
                  <input 
                    type={showPassword ? "text" : "password"} 
                    placeholder={(mode === 'signup' || mode === 'reset') ? "Create a secure password" : "Enter your password"}
                    className={styles.inputField}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onBlur={() => handleBlur('password')}
                    required
                  />
                  <button 
                    type="button" 
                    className={styles.togglePasswordBtn} 
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ right: (touched.password && (mode === 'signup' || mode === 'reset') && isPwdValid) ? '40px' : '12px' }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                  {touched.password && (mode === 'signup' || mode === 'reset') && isPwdValid && <CheckCircle size={16} className={styles.validIcon} />}
                </div>
                {renderStrengthBar()}
                {mode === 'login' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', userSelect: 'none' }}>
                      <input 
                        type="checkbox" 
                        checked={rememberMe} 
                        onChange={(e) => setRememberMe(e.target.checked)}
                        style={{ accentColor: 'var(--accent-primary, #d4af37)', cursor: 'pointer' }}
                      />
                      Remember Me
                    </label>
                    <button type="button" className={styles.toggleLink} style={{ fontSize: '0.8rem', margin: 0 }} onClick={() => setMode('forgot')}>
                      Forgot Password?
                    </button>
                  </div>
                )}
              </div>
            )}

            <button type="submit" className={styles.submitButton} disabled={isLoading}>
              {isLoading ? <div className={styles.loader} /> : (
                mode === 'login' ? 'Log In' : 
                mode === 'signup' ? 'Sign Up' : 
                mode === 'forgot' ? 'Send PIN' : 
                mode === 'reset' ? 'Reset Password' : 
                'Verify & Login'
              )}
            </button>
          </form>

          <p className={styles.footerText}>
            {mode === 'login' ? "Don't have an account?" : mode === 'signup' ? "Already have an account?" : "Remember your password?"}
            <button 
              type="button"
              className={styles.toggleLink}
              onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
            >
              {mode === 'login' ? 'Sign Up' : 'Log In'}
            </button>
          </p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default Login;
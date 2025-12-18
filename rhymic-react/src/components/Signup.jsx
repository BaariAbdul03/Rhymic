// src/components/Signup.jsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styles from './Auth.module.css';
import { useAuthStore } from '../store/authStore'; // <-- Import Store

const Signup = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const signup = useAuthStore((state) => state.signup);
  const error = useAuthStore((state) => state.error);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const success = await signup(name, email, password);
    if (success) {
      // Auto redirect to login page on success
      navigate('/login');
    }
  };

  return (
    <div className={styles.authContainer}>
      <div className={styles.authCard}>
        {/* --- LOGO BRANDING --- */}
        <h1 style={{ 
            fontSize: '3rem', fontWeight: '900', color: 'var(--accent-color)', 
            margin: '0 0 10px 0', textShadow: '0 0 20px rgba(59, 130, 246, 0.5)'
        }}>
            Rhymic
        </h1>

        <h2 className={styles.title}>Get Started</h2>
        <p className={styles.subtitle}>Create your Rhymic account</p>
        
        {error && <p style={{color: '#ef4444', marginBottom: '16px', fontSize:'0.9rem'}}>{error}</p>}
        
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <label>Name</label>
            <input type="text" placeholder="Your Name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className={styles.inputGroup}>
            <label>Email</label>
            <input type="email" placeholder="name @example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          
          <div className={styles.inputGroup}>
            <label>Password</label>
            <input type="password" placeholder="Create a password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>

          <button type="submit" className={styles.submitButton}>Sign Up</button>
        </form>

        <p className={styles.footerText}>
          Already have an account? <Link to="/login">Log In</Link>
        </p>
      </div>
    </div>
  );
};

export default Signup;
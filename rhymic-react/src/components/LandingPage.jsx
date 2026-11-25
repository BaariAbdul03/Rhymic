import React from 'react';
import { useNavigate } from 'react-router-dom';

const LandingPage = () => {
  const navigate = useNavigate();
  return (
    <div style={{
      padding: 'clamp(20px, 6vw, 60px)',
      textAlign: 'center',
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      boxSizing: 'border-box',
    }}>
      <h1 style={{ fontSize: 'clamp(2.6rem, 13vw, 4rem)', color: 'var(--accent-primary)', margin: '0 0 16px' }}>RhyMic</h1>
      <p style={{ fontSize: 'clamp(1rem, 4vw, 1.2rem)', color: 'var(--text-secondary)', margin: '0 0 40px', maxWidth: '32ch' }}>
        Your premium AI-powered music streaming experience.
      </p>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button 
          onClick={() => navigate('/login')}
          style={{ padding: '12px 32px', backgroundColor: 'var(--accent-primary)', color: 'var(--bg-primary)', border: 'none', borderRadius: '30px', fontWeight: 'bold', cursor: 'pointer', minWidth: '160px' }}
        >
          Sign In
        </button>
        <button 
          onClick={() => navigate('/signup')}
          style={{ padding: '12px 32px', backgroundColor: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '30px', fontWeight: 'bold', cursor: 'pointer', minWidth: '160px' }}
        >
          Create Account
        </button>
      </div>
    </div>
  );
};

export default LandingPage;

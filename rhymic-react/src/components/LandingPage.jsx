import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const LandingPage = () => {
  const navigate = useNavigate();
  return (
    <div style={{ padding: '60px', textAlign: 'center', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <h1 style={{ fontSize: '4rem', color: 'var(--accent-primary)', marginBottom: '16px' }}>Rhymic</h1>
      <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', marginBottom: '40px' }}>Your premium AI-powered music streaming experience.</p>
      <div style={{ display: 'flex', gap: '16px' }}>
        <button 
          onClick={() => navigate('/login')}
          style={{ padding: '12px 32px', backgroundColor: 'var(--accent-primary)', color: 'var(--bg-primary)', border: 'none', borderRadius: '30px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          Sign In
        </button>
        <button 
          onClick={() => navigate('/signup')}
          style={{ padding: '12px 32px', backgroundColor: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '30px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          Create Account
        </button>
      </div>
    </div>
  );
};

export default LandingPage;

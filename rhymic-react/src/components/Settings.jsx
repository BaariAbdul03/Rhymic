import React from 'react';

const Settings = () => {
  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '8px' }}>Settings</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '40px' }}>Manage your account and preferences.</p>
      
      <div style={{ backgroundColor: 'var(--bg-elevated)', padding: '24px', borderRadius: '12px', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>Account</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Account settings are currently being integrated with the new backend. Check back soon.</p>
      </div>
    </div>
  );
};

export default Settings;

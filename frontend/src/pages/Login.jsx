import React, { useState } from 'react';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = () => {
    setLoading(true);
    setError('');

    // Fetch Google OAuth / Mock authorization consent URL from Flask backend
    fetch('http://localhost:5000/api/auth/login-url')
      .then(resp => {
        if (!resp.ok) {
          throw new Error('Authentication gateway is offline.');
        }
        return resp.json();
      })
      .then(data => {
        if (data.status === 'success' && data.login_url) {
          // Redirect browser to consent page
          window.location.href = data.login_url;
        } else {
          throw new Error('Failed to retrieve login redirection URL.');
        }
      })
      .catch(err => {
        setLoading(false);
        setError(err.message || 'Server connection failed.');
      });
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>PhishGuard Gateway</h2>
        <p style={styles.subtitle}>AI-Powered Phishing Email Detection Website</p>
        
        <div style={styles.banner}>
          <strong>Warning:</strong> Authorized Access Only. Credentials authentication required to inspect scanned email feeds.
        </div>

        {error && (
          <div style={styles.errorBox}>
            <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '8px' }}></i>
            {error}
          </div>
        )}
        
        <button 
          style={{ ...styles.btn, opacity: loading ? 0.7 : 1 }} 
          onClick={handleLogin}
          disabled={loading}
        >
          <i className="fa-brands fa-google" style={{ marginRight: '8px' }}></i>
          {loading ? 'Initializing Authorization...' : 'Connect Gmail Workspace'}
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: '#0A0D14',
    fontFamily: 'sans-serif',
    color: '#FFF'
  },
  card: {
    width: '100%',
    maxWidth: '420px',
    padding: '40px',
    background: 'rgba(22, 28, 45, 0.85)',
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    boxShadow: '0 8px 32px 0 rgba(0,0,0,0.3)',
    textAlign: 'center'
  },
  title: {
    fontSize: '28px',
    fontWeight: '700',
    marginBottom: '8px',
    color: '#06B6D4'
  },
  subtitle: {
    color: '#9CA3AF',
    fontSize: '14px',
    marginBottom: '24px'
  },
  banner: {
    fontSize: '11px',
    background: 'rgba(239, 68, 68, 0.08)',
    border: '1px solid rgba(239, 68, 68, 0.15)',
    color: '#EF4444',
    padding: '10px 14px',
    borderRadius: '8px',
    marginBottom: '24px',
    textAlign: 'left',
    lineHeight: '1.4'
  },
  errorBox: {
    fontSize: '12px',
    background: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.25)',
    color: '#FCA5A5',
    padding: '10px',
    borderRadius: '8px',
    marginBottom: '20px',
    textAlign: 'left'
  },
  btn: {
    background: 'linear-gradient(135deg, #06B6D4 0%, #6366F1 100%)',
    color: '#FFF',
    border: 'none',
    width: '100%',
    padding: '14px',
    borderRadius: '8px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 4px 15px rgba(99, 102, 241, 0.35)',
    transition: 'opacity 0.2s'
  }
};

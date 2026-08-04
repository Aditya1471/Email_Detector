import React, { useState } from 'react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [server, setServer] = useState('imap.gmail.com');
  const [loading, setLoading] = useState(false);
  const [sandboxLoading, setSandboxLoading] = useState(false);
  const [error, setError] = useState('');

  // 1. Direct IMAP connection and login
  const handleDirectLogin = (e) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setError('');

    fetch('http://localhost:5000/api/auth/login-direct', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, server }),
      credentials: 'include'
    })
      .then(resp => resp.json())
      .then(data => {
        setLoading(false);
        if (data.status === 'success') {
          // Trigger hard reload to let App.jsx catch authenticated status
          window.location.reload();
        } else {
          setError(data.message || 'Verification failed.');
        }
      })
      .catch(() => {
        setLoading(false);
        setError('Server is offline. Start the backend process first.');
      });
  };

  // 2. Fast bypass demo account chooser
  const handleSandboxBypass = () => {
    setSandboxLoading(true);
    setError('');

    fetch('http://localhost:5000/api/auth/login-url')
      .then(resp => resp.json())
      .then(data => {
        if (data.status === 'success' && data.login_url) {
          window.location.href = data.login_url;
        } else {
          throw new Error('Failed to retrieve login redirection.');
        }
      })
      .catch(err => {
        setSandboxLoading(false);
        setError(err.message || 'Server connection failed.');
      });
  };

  return (
    <div style={styles.container}>
      <div style={styles.card} className="glass-panel">
        <h2 style={styles.title}>PhishGuard Gateway</h2>
        <p style={styles.subtitle}>AI-Powered Phishing Email Detection Website</p>
        
        {error && (
          <div style={styles.errorBox}>
            <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '8px' }}></i>
            {error}
          </div>
        )}

        <form onSubmit={handleDirectLogin} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Real Email Address</label>
            <input 
              type="email" 
              placeholder="e.g. yourname@gmail.com" 
              style={styles.input}
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div style={styles.inputGroup}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={styles.label}>Google App Password</label>
              <span style={styles.tooltipBtn} title="Gmail Security -> 2-Step Verification -> App Passwords (16 character code)">
                <i className="fa-solid fa-circle-question"></i> Help
              </span>
            </div>
            <input 
              type="password" 
              placeholder="16-character code" 
              style={styles.input}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          <button 
            type="submit" 
            style={{ ...styles.btn, opacity: loading ? 0.7 : 1 }} 
            disabled={loading || sandboxLoading}
          >
            {loading ? (
              <span><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '8px' }}></i>Linking Mailbox...</span>
            ) : (
              <span><i className="fa-solid fa-envelope" style={{ marginRight: '8px' }}></i>Sign In & Connect Inbox</span>
            )}
          </button>
        </form>

        <div style={styles.divider}>
          <span style={styles.dividerLine}></span>
          <span style={styles.dividerText}>OR</span>
          <span style={styles.dividerLine}></span>
        </div>

        <button 
          style={{ ...styles.btnDemo, opacity: sandboxLoading ? 0.7 : 1 }} 
          onClick={handleSandboxBypass}
          disabled={loading || sandboxLoading}
        >
          {sandboxLoading ? (
            <span><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '8px' }}></i>Starting Sandbox...</span>
          ) : (
            <span><i className="fa-solid fa-server" style={{ marginRight: '8px' }}></i>Access Demo Sandbox (Mock)</span>
          )}
        </button>

        <div style={styles.hint}>
          Note: Real email linking connects securely via SSL IMAP protocols to retrieve and audit the last 15 emails instantly.
        </div>
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
    background: 'radial-gradient(circle at center, #161a29 0%, #080a10 100%)',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#FFF',
    padding: '20px'
  },
  card: {
    width: '100%',
    maxWidth: '440px',
    padding: '40px',
    background: 'rgba(22, 28, 45, 0.45)',
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5)'
  },
  title: {
    fontSize: '28px',
    fontWeight: '800',
    margin: '0 0 6px 0',
    color: '#06B6D4',
    textAlign: 'center',
    letterSpacing: '-0.5px'
  },
  subtitle: {
    color: '#9CA3AF',
    fontSize: '13.5px',
    margin: '0 0 32px 0',
    textAlign: 'center'
  },
  errorBox: {
    background: 'rgba(239, 68, 68, 0.08)',
    border: '1px solid rgba(239, 68, 68, 0.15)',
    color: '#EF4444',
    padding: '12px',
    borderRadius: '8px',
    fontSize: '13px',
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  label: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#E5E7EB',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  input: {
    padding: '12px 14px',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    background: 'rgba(0, 0, 0, 0.2)',
    color: '#FFF',
    fontSize: '14px',
    outline: 'none',
    transition: 'border 0.2s'
  },
  tooltipBtn: {
    fontSize: '12px',
    color: '#06B6D4',
    cursor: 'help',
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  btn: {
    background: 'linear-gradient(135deg, #06B6D4 0%, #6366F1 100%)',
    color: '#FFF',
    border: 'none',
    padding: '12px',
    borderRadius: '8px',
    fontWeight: '700',
    cursor: 'pointer',
    fontSize: '14px',
    boxShadow: '0 4px 15px rgba(99, 102, 241, 0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px'
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '24px 0',
    gap: '12px'
  },
  dividerLine: {
    flexGrow: 1,
    height: '1px',
    background: 'rgba(255, 255, 255, 0.08)'
  },
  dividerText: {
    fontSize: '11px',
    color: '#4B5563',
    fontWeight: '700'
  },
  btnDemo: {
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    color: '#9CA3AF',
    padding: '12px',
    borderRadius: '8px',
    fontWeight: '600',
    cursor: 'pointer',
    fontSize: '14px',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px'
  },
  hint: {
    fontSize: '11px',
    color: '#4B5563',
    textAlign: 'center',
    marginTop: '24px',
    lineHeight: '1.4'
  }
};

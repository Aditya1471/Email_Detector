import React, { useState } from 'react';

export default function Login() {
  const [activeTab, setActiveTab] = useState('signin'); // signin, signup
  const [name, setName] = useState('');
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

  // 2. Direct system registration (signup)
  const handleSignUp = (e) => {
    e.preventDefault();
    if (!name || !email) return;

    setLoading(true);
    setError('');

    fetch('http://localhost:5000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, server }),
      credentials: 'include'
    })
      .then(resp => resp.json())
      .then(data => {
        setLoading(false);
        if (data.status === 'success') {
          window.location.reload();
        } else {
          setError(data.message || 'Registration failed.');
        }
      })
      .catch(() => {
        setLoading(false);
        setError('Server is offline. Start the backend process first.');
      });
  };

  // 3. Fast bypass demo account chooser
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
      {/* 1. TOP NAVBAR */}
      <header style={styles.navbar}>
        <div style={styles.logoGroup}>
          <div style={styles.shieldIcon}>
            <svg width="24" height="28" viewBox="0 0 24 28" fill="none">
              <path d="M12 2L2 6v8c0 5.52 4.48 10 10 10s10-4.48 10-10V6L12 2z" stroke="#10B981" strokeWidth="2.5" fill="rgba(16, 185, 129, 0.1)"/>
              <path d="M12 7v10M9 12h6" stroke="#10B981" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <div style={styles.logoMain}>PhishShield AI</div>
            <div style={styles.logoSub}>AI PHISHING EMAIL DETECTION</div>
          </div>
        </div>

        <div style={styles.navLinks}>
          <span style={styles.navLink}>Support</span>
          <span style={styles.navLink}>Docs</span>
          <button style={styles.navOpenBtn}>Open</button>
        </div>
      </header>

      {/* 2. LOGIN MAIN CARD */}
      <div style={styles.card} className="animate-slide-in">
        <h2 style={styles.cardTitle}>Access PhishShield Portal</h2>
        <p style={styles.cardSubtitle}>Configure your credentials to connect the threat detection system.</p>

        {/* Tab Selector */}
        <div style={styles.tabGroup}>
          <button 
            style={{ ...styles.tabBtn, ...(activeTab === 'signin' ? styles.tabBtnActive : {}) }}
            type="button"
            onClick={() => { setActiveTab('signin'); setError(''); }}
          >
            Sign In
          </button>
          <button 
            style={{ ...styles.tabBtn, ...(activeTab === 'signup' ? styles.tabBtnActive : {}) }}
            type="button"
            onClick={() => { setActiveTab('signup'); setError(''); }}
          >
            Sign Up
          </button>
        </div>

        {error && (
          <div style={styles.errorBox}>
            <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '8px' }}></i>
            {error}
          </div>
        )}

        {activeTab === 'signin' ? (
          /* SIGN IN FORM */
          <form onSubmit={handleDirectLogin} style={styles.form}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Gmail Address</label>
              <div style={styles.inputWrapper}>
                <input 
                  type="email" 
                  placeholder="you@gmail.com" 
                  style={styles.input}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
                <span style={styles.inputIcon}>
                  <i className="fa-solid fa-envelope" style={{ color: '#10B981' }}></i>
                </span>
              </div>
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Google App Password</label>
              <div style={styles.inputWrapper}>
                <input 
                  type="password" 
                  placeholder="16-character app password" 
                  style={styles.input}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
                <span style={styles.inputIcon}>
                  <i className="fa-solid fa-key" style={{ color: '#10B981' }}></i>
                </span>
              </div>
            </div>

            <button 
              type="submit" 
              style={{ ...styles.btnSubmit, opacity: loading ? 0.7 : 1 }}
              disabled={loading || sandboxLoading}
            >
              {loading ? 'Connecting Mailbox...' : 'Sign In & Connect Inbox'}
            </button>
          </form>
        ) : (
          /* SIGN UP FORM */
          <form onSubmit={handleSignUp} style={styles.form}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Full Name</label>
              <div style={styles.inputWrapper}>
                <input 
                  type="text" 
                  placeholder="Your Name" 
                  style={styles.input}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
                <span style={styles.inputIcon}>
                  <i className="fa-solid fa-user" style={{ color: '#10B981' }}></i>
                </span>
              </div>
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Gmail Address</label>
              <div style={styles.inputWrapper}>
                <input 
                  type="email" 
                  placeholder="you@gmail.com" 
                  style={styles.input}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
                <span style={styles.inputIcon}>
                  <i className="fa-solid fa-envelope" style={{ color: '#10B981' }}></i>
                </span>
              </div>
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Google App Password (Optional)</label>
              <div style={styles.inputWrapper}>
                <input 
                  type="password" 
                  placeholder="16-character app password for live IMAP scans" 
                  style={styles.input}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <span style={styles.inputIcon}>
                  <i className="fa-solid fa-key" style={{ color: '#10B981' }}></i>
                </span>
              </div>
            </div>

            <button 
              type="submit" 
              style={{ ...styles.btnSubmit, opacity: loading ? 0.7 : 1 }}
              disabled={loading || sandboxLoading}
            >
              {loading ? 'Creating Identity...' : 'Register Account & Sign In'}
            </button>
          </form>
        )}

        {/* 3. SMTP SIMULATOR BOX */}
        <div style={styles.simulatorBox}>
          <div style={styles.simTitle}>SMTP SIMULATOR: Mock Consent Access</div>
          <button 
            style={{ ...styles.btnSim, opacity: sandboxLoading ? 0.7 : 1 }}
            onClick={handleSandboxBypass}
            disabled={loading || sandboxLoading}
          >
            {sandboxLoading ? 'Opening Sandbox...' : 'Open Magic Link (Sign In)'}
          </button>
        </div>
      </div>

      {/* 4. FOOTER */}
      <footer style={styles.footer}>
        © 2026 PhishShield Inc. | Privacy Policy | Terms of Service
      </footer>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: `radial-gradient(circle at center, rgba(10, 15, 20, 0.75) 0%, rgba(5, 7, 10, 0.95) 100%), url('/login_bg.jpg')`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    fontFamily: "'Outfit', sans-serif",
    color: '#FFF',
    padding: '20px',
    position: 'relative'
  },
  navbar: {
    position: 'absolute',
    top: '30px',
    left: '0',
    right: '0',
    padding: '0 60px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    boxSizing: 'border-box'
  },
  logoGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  shieldIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  logoMain: {
    fontSize: '22px',
    fontWeight: '900',
    letterSpacing: '1px',
    color: '#FFF',
    lineHeight: '1'
  },
  logoSub: {
    fontSize: '9px',
    color: '#10B981',
    fontWeight: '700',
    letterSpacing: '0.5px',
    marginTop: '4px'
  },
  navLinks: {
    display: 'flex',
    alignItems: 'center',
    gap: '24px'
  },
  navLink: {
    fontSize: '14px',
    color: '#9CA3AF',
    cursor: 'pointer',
    fontWeight: '500',
    transition: 'color 0.2s'
  },
  navOpenBtn: {
    background: 'rgba(255, 255, 255, 0.85)',
    color: '#111827',
    border: 'none',
    padding: '8px 24px',
    borderRadius: '8px',
    fontWeight: '700',
    fontSize: '14px',
    cursor: 'pointer',
    boxShadow: '0 2px 10px rgba(0,0,0,0.3)'
  },
  card: {
    width: '100%',
    maxWidth: '460px',
    padding: '40px',
    background: 'rgba(15, 23, 42, 0.85)',
    borderRadius: '16px',
    border: '2px solid #10B981',
    boxShadow: '0 0 35px rgba(16, 185, 129, 0.25)',
    backdropFilter: 'blur(16px)',
    marginTop: '60px'
  },
  cardTitle: {
    fontSize: '24px',
    fontWeight: '700',
    margin: '0 0 8px 0',
    color: '#FFF',
    textAlign: 'center'
  },
  cardSubtitle: {
    color: '#9CA3AF',
    fontSize: '13.5px',
    margin: '0 0 24px 0',
    textAlign: 'center',
    lineHeight: '1.4'
  },
  tabGroup: {
    display: 'flex',
    background: '#0d111c',
    border: '1px solid rgba(255,255,255,0.05)',
    padding: '4px',
    borderRadius: '8px',
    marginBottom: '24px'
  },
  tabBtn: {
    background: 'none',
    border: 'none',
    color: '#8A92A6',
    flex: 1,
    padding: '10px 0',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '700',
    transition: 'all 0.2s',
    fontFamily: "'Outfit', sans-serif"
  },
  tabBtnActive: {
    background: 'rgba(16, 185, 129, 0.15)',
    color: '#10B981',
    border: '1px solid rgba(16, 185, 129, 0.3)'
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
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center'
  },
  input: {
    width: '100%',
    padding: '12px 40px 12px 14px',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    background: 'rgba(0, 0, 0, 0.25)',
    color: '#FFF',
    fontSize: '14px',
    outline: 'none',
    fontFamily: "'Outfit', sans-serif"
  },
  inputIcon: {
    position: 'absolute',
    right: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  btnSubmit: {
    background: '#10B981',
    color: '#FFF',
    border: 'none',
    padding: '14px',
    borderRadius: '8px',
    fontWeight: '800',
    cursor: 'pointer',
    fontSize: '14px',
    boxShadow: '0 0 15px rgba(16, 185, 129, 0.35)',
    transition: '0.2s',
    fontFamily: "'Outfit', sans-serif"
  },
  simulatorBox: {
    marginTop: '28px',
    padding: '20px',
    border: '2px dashed rgba(16, 185, 129, 0.4)',
    borderRadius: '10px',
    background: 'rgba(16, 185, 129, 0.02)',
    textAlign: 'center'
  },
  simTitle: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#E5E7EB',
    marginBottom: '12px'
  },
  btnSim: {
    background: 'transparent',
    border: '1px solid #10B981',
    color: '#10B981',
    padding: '8px 20px',
    borderRadius: '8px',
    fontWeight: '700',
    fontSize: '13px',
    cursor: 'pointer',
    transition: '0.2s',
    fontFamily: "'Outfit', sans-serif"
  },
  footer: {
    position: 'absolute',
    bottom: '24px',
    fontSize: '12px',
    color: '#4B5563',
    textAlign: 'center'
  }
};

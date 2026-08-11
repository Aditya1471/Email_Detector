/**
 * ============================================================================
 * COMPONENT: Login.jsx (Authentication & Identity Portal)
 * ============================================================================
 * Description:
 * Renders the secure cyber landing card for PhishShield AI. Supports multi-tab
 * options for user Sign In (IMAP direct authentication) and Sign Up (new user
 * manual registration). Integrates password recovery assistance.
 *
 * Endpoints Called:
 * - POST  http://127.0.0.1:5000/api/auth/login-direct  (Direct login check)
 * - POST  http://127.0.0.1:5000/api/auth/register      (Manual account signup)
 * - GET   http://127.0.0.1:5000/api/auth/login-url      (OAuth sandbox bypass)
 * - POST  http://127.0.0.1:5000/api/auth/reset-password (Clear stored credentials)
 * ============================================================================
 */

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

  // Forgot password state variables
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  // 1. Direct IMAP connection and login
  const handleDirectLogin = (e) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setError('');

    fetch('http://127.0.0.1:5000/api/auth/login-direct', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, server }),
      credentials: 'include'
    })
      .then(resp => resp.json())
      .then(data => {
        setLoading(false);
        if (data.status === 'success') {
          if (data.access_token) {
            localStorage.setItem('phishshield_token', data.access_token);
          }
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

    fetch('http://127.0.0.1:5000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, server }),
      credentials: 'include'
    })
      .then(resp => resp.json())
      .then(data => {
        setLoading(false);
        if (data.status === 'success') {
          if (data.access_token) {
            localStorage.setItem('phishshield_token', data.access_token);
          }
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

    fetch('http://127.0.0.1:5000/api/auth/login-url')
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

  // 4. Reset stored IMAP credentials in DB
  const handleForgotSubmit = (e) => {
    e.preventDefault();
    if (!forgotEmail) {
      setForgotMessage('Please enter your registered Gmail address.');
      return;
    }

    setForgotLoading(true);
    setForgotMessage('');

    fetch('http://127.0.0.1:5000/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: forgotEmail })
    })
      .then(r => r.json())
      .then(data => {
        setForgotLoading(false);
        if (data.status === 'success') {
          setForgotMessage('Stored credentials cleared successfully!');
        } else {
          setForgotMessage(data.message || 'Reset failed.');
        }
      })
      .catch(() => {
        setForgotLoading(false);
        setForgotMessage('Server offline. Reset failed.');
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
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                <span 
                  onClick={() => { setShowForgotModal(true); setForgotMessage(''); setForgotEmail(''); }}
                  style={{ fontSize: '11px', color: '#10B981', cursor: 'pointer', fontWeight: '600' }}
                >
                  Forgot App Password?
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

      {/* 4. FORGOT PASSWORD OVERLAY MODAL */}
      {showForgotModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard} className="glass-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#FFF' }}>Forgot App Password Help</h3>
              <button style={styles.modalClose} onClick={() => setShowForgotModal(false)}>&times;</button>
            </div>
            
            <div style={{ fontSize: '13px', color: '#D1D5DB', lineHeight: '1.5', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                PhishShield AI connects directly to Gmail over secure IMAP using a <strong>16-character Google App Password</strong> instead of your real account password.
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                <strong>How to generate an App Password:</strong>
                <ol style={{ margin: '8px 0 0 0', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <li>Go to your <a href="https://myaccount.google.com/" target="_blank" rel="noopener noreferrer" style={{ color: '#10B981', fontWeight: 'bold' }}>Google Account Settings</a></li>
                  <li>Search for <strong>"App Passwords"</strong> (requires 2-Step Verification enabled)</li>
                  <li>Select app <em>"Mail"</em> and device <em>"Other"</em>, then click <strong>Generate</strong></li>
                  <li>Copy the 16-character code and paste it into the sign-in form</li>
                </ol>
              </div>

              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '14px', marginTop: '6px' }}>
                <strong>Bypass / Magic Link Option:</strong>
                <div style={{ marginTop: '8px' }}>
                  If you just want to test or demo the app, close this and click the <strong>"Open Magic Link"</strong> sandbox bypass button on the login screen to sign in instantly without any password!
                </div>
              </div>

              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <strong>Reset Stored Credentials:</strong>
                <div>If you need to disconnect or overwrite a previously stored app password:</div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                  <input 
                    type="email" 
                    placeholder="Enter your Gmail address..." 
                    value={forgotEmail} 
                    onChange={e => setForgotEmail(e.target.value)}
                    style={styles.modalInput}
                  />
                  <button 
                    onClick={handleForgotSubmit}
                    style={styles.btnReset}
                    disabled={forgotLoading}
                  >
                    {forgotLoading ? 'Clearing...' : 'Clear Password'}
                  </button>
                </div>
                {forgotMessage && (
                  <div style={{ fontSize: '12px', color: forgotMessage.includes('successfully') ? '#10B981' : '#EF4444', marginTop: '4px', fontWeight: '600' }}>
                    {forgotMessage}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. FOOTER */}
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
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999,
    padding: '20px',
    backdropFilter: 'blur(4px)'
  },
  modalCard: {
    background: '#0d111a',
    borderRadius: '16px',
    border: '2px solid #10B981',
    boxShadow: '0 0 35px rgba(16, 185, 129, 0.25)',
    padding: '30px',
    width: '100%',
    maxWidth: '500px',
    boxSizing: 'border-box'
  },
  modalClose: {
    background: 'none',
    border: 'none',
    color: '#9CA3AF',
    fontSize: '24px',
    cursor: 'pointer',
    lineHeight: '1'
  },
  modalInput: {
    background: 'rgba(0,0,0,0.25)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    padding: '10px 14px',
    color: '#FFF',
    fontSize: '13px',
    outline: 'none',
    flexGrow: 1,
    fontFamily: "'Outfit', sans-serif"
  },
  btnReset: {
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    color: '#EF4444',
    padding: '10px 16px',
    borderRadius: '8px',
    fontWeight: '700',
    fontSize: '12px',
    cursor: 'pointer',
    flexShrink: 0,
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

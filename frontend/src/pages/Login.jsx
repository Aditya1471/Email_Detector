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
import './Login.css';

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
    <div className="login-container">
      {/* 1. TOP NAVBAR */}
      <header className="login-navbar">
        <div className="login-logo-group">
          <div className="login-shield-svg">
            <svg width="24" height="28" viewBox="0 0 24 28" fill="none">
              <path d="M12 2L2 6v8c0 5.52 4.48 10 10 10s10-4.48 10-10V6L12 2z" stroke="#10B981" strokeWidth="2.5" fill="rgba(16, 185, 129, 0.1)"/>
              <path d="M12 7v10M9 12h6" stroke="#10B981" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <div className="login-logo-main">PhishShield AI</div>
            <div className="login-logo-sub">AI PHISHING EMAIL DETECTION</div>
          </div>
        </div>

        <div className="login-nav-links">
          <span className="login-nav-link">Support</span>
          <span className="login-nav-link">Docs</span>
          <button className="login-nav-open-btn">Open</button>
        </div>
      </header>

      {/* 2. LOGIN MAIN CARD */}
      <div className="login-card">
        <h2 className="login-card-title">Access PhishShield Portal</h2>
        <p className="login-card-subtitle">Configure your credentials to connect the threat detection system.</p>

        {/* Tab Selector */}
        <div className="login-tab-group">
          <button 
            className={`login-tab-btn ${activeTab === 'signin' ? 'login-tab-btn-active' : ''}`}
            type="button"
            onClick={() => { setActiveTab('signin'); setError(''); }}
          >
            Sign In
          </button>
          <button 
            className={`login-tab-btn ${activeTab === 'signup' ? 'login-tab-btn-active' : ''}`}
            type="button"
            onClick={() => { setActiveTab('signup'); setError(''); }}
          >
            Sign Up
          </button>
        </div>

        {error && (
          <div className="login-error-box">
            <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '8px' }}></i>
            {error}
          </div>
        )}

        {activeTab === 'signin' ? (
          /* SIGN IN FORM */
          <form onSubmit={handleDirectLogin} className="login-form">
            <div className="login-input-group">
              <label className="login-label">Gmail Address</label>
              <div className="login-input-wrapper">
                <input 
                  type="email" 
                  placeholder="you@gmail.com" 
                  className="login-input"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
                <span className="login-input-icon">
                  <i className="fa-solid fa-envelope" style={{ color: '#10B981' }}></i>
                </span>
              </div>
            </div>

            <div className="login-input-group">
              <label className="login-label">Google App Password</label>
              <div className="login-input-wrapper">
                <input 
                  type="password" 
                  placeholder="16-character app password" 
                  className="login-input"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
                <span className="login-input-icon">
                  <i className="fa-solid fa-key" style={{ color: '#10B981' }}></i>
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                <span 
                  onClick={() => { setShowForgotModal(true); setForgotMessage(''); setForgotEmail(''); }}
                  className="login-forgot-trigger"
                >
                  Forgot App Password?
                </span>
              </div>
            </div>

            <button 
              type="submit" 
              className="login-btn-submit"
              style={{ opacity: loading ? 0.7 : 1 }}
              disabled={loading || sandboxLoading}
            >
              {loading ? 'Connecting Mailbox...' : 'Sign In & Connect Inbox'}
            </button>
          </form>
        ) : (
          /* SIGN UP FORM */
          <form onSubmit={handleSignUp} className="login-form">
            <div className="login-input-group">
              <label className="login-label">Full Name</label>
              <div className="login-input-wrapper">
                <input 
                  type="text" 
                  placeholder="Your Name" 
                  className="login-input"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
                <span className="login-input-icon">
                  <i className="fa-solid fa-user" style={{ color: '#10B981' }}></i>
                </span>
              </div>
            </div>

            <div className="login-input-group">
              <label className="login-label">Gmail Address</label>
              <div className="login-input-wrapper">
                <input 
                  type="email" 
                  placeholder="you@gmail.com" 
                  className="login-input"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
                <span className="login-input-icon">
                  <i className="fa-solid fa-envelope" style={{ color: '#10B981' }}></i>
                </span>
              </div>
            </div>

            <div className="login-input-group">
              <label className="login-label">Google App Password (Optional)</label>
              <div className="login-input-wrapper">
                <input 
                  type="password" 
                  placeholder="16-character app password for live IMAP scans" 
                  className="login-input"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <span className="login-input-icon">
                  <i className="fa-solid fa-key" style={{ color: '#10B981' }}></i>
                </span>
              </div>
            </div>

            <button 
              type="submit" 
              className="login-btn-submit"
              style={{ opacity: loading ? 0.7 : 1 }}
              disabled={loading || sandboxLoading}
            >
              {loading ? 'Creating Identity...' : 'Register Account & Sign In'}
            </button>
          </form>
        )}

        {/* 3. SMTP SIMULATOR BOX */}
        <div className="login-simulator-box">
          <div className="login-sim-title">SMTP SIMULATOR: Mock Consent Access</div>
          <button 
            className="login-btn-sim"
            style={{ opacity: sandboxLoading ? 0.7 : 1 }}
            onClick={handleSandboxBypass}
            disabled={loading || sandboxLoading}
          >
            {sandboxLoading ? 'Opening Sandbox...' : 'Open Magic Link (Sign In)'}
          </button>
        </div>
      </div>

      {/* 4. FORGOT PASSWORD OVERLAY MODAL */}
      {showForgotModal && (
        <div className="login-modal-overlay">
          <div className="login-modal-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#FFF' }}>Forgot App Password Help</h3>
              <button className="login-modal-close" onClick={() => setShowForgotModal(false)}>&times;</button>
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
                    className="login-modal-input"
                  />
                  <button 
                    onClick={handleForgotSubmit}
                    className="login-btn-reset"
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
      <footer className="login-footer">
        © 2026 PhishShield Inc. | Privacy Policy | Terms of Service
      </footer>
    </div>
  );
}

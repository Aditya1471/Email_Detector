import React, { useState, useEffect } from 'react';

export default function Dashboard({ user }) {
  const [stats, setStats] = useState({
    total_scanned: 0,
    phishing_count: 0,
    suspect_count: 0,
    safe_count: 0,
    avg_risk_score: 0
  });
  const [emails, setEmails] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeToast, setActiveToast] = useState(null);

  // Real IMAP account connection state
  const [imapEmail, setImapEmail] = useState('');
  const [imapPassword, setImapPassword] = useState('');
  const [imapServer, setImapServer] = useState('imap.gmail.com');
  const [connectingImap, setConnectingImap] = useState(false);
  const [connectedAccount, setConnectedAccount] = useState(null);

  useEffect(() => {
    fetchDashboardData();
    fetchConnectedAccount();
    const timer = setInterval(pollNotifications, 8000);
    return () => clearInterval(timer);
  }, []);

  const fetchDashboardData = () => {
    // 1. Fetch Stats
    fetch('http://localhost:5000/api/dashboard/stats', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data.status === 'success') {
          setStats(data.stats);
        }
      })
      .catch(console.error);

    // 2. Fetch Recent Emails
    fetch('http://localhost:5000/api/emails/history', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data.status === 'success') {
          setEmails(data.emails);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  const fetchConnectedAccount = () => {
    fetch('http://localhost:5000/api/auth/me', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data.status === 'success' && data.user.imap_config) {
          setConnectedAccount(data.user.imap_config);
        } else {
          setConnectedAccount(null);
        }
      })
      .catch(console.error);
  };

  const pollNotifications = () => {
    fetch('http://localhost:5000/api/emails/notifications', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data.status === 'success' && data.notifications.length > 0) {
          const unreadPhish = data.notifications.find(n => n.channel === 'in_app' && !n.read);
          if (unreadPhish) {
            setActiveToast(unreadPhish);
          }
        }
      })
      .catch(console.error);
  };

  const handleSync = () => {
    setSyncing(true);
    fetch('http://localhost:5000/api/emails/sync', { method: 'POST', credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        setSyncing(false);
        if (data.status === 'success') {
          fetchDashboardData();
          alert(data.message);
        }
      })
      .catch(() => {
        setSyncing(false);
        alert('Mailbox sync timeout.');
      });
  };

  // Connect Real Inbox via IMAP
  const handleConnectImap = (e) => {
    e.preventDefault();
    if (!imapEmail || !imapPassword) return;

    setConnectingImap(true);
    fetch('http://localhost:5000/api/emails/connect-imap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: imapEmail, password: imapPassword, server: imapServer }),
      credentials: 'include'
    })
      .then(r => r.json())
      .then(data => {
        setConnectingImap(false);
        if (data.status === 'success') {
          setImapEmail('');
          setImapPassword('');
          fetchConnectedAccount();
          fetchDashboardData();
          alert(data.message);
        } else {
          alert(data.message || 'Failed to connect email account.');
        }
      })
      .catch(() => {
        setConnectingImap(false);
        alert('Verification request failed. Server offline.');
      });
  };

  // Disconnect active IMAP mailbox
  const handleDisconnectImap = () => {
    if (!window.confirm('Disconnect this email account from real-time monitoring?')) return;
    
    fetch('http://localhost:5000/api/emails/disconnect-imap', { method: 'POST', credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data.status === 'success') {
          setConnectedAccount(null);
          fetchDashboardData();
          alert(data.message);
        }
      })
      .catch(console.error);
  };

  const closeToast = () => {
    if (activeToast) {
      fetch('http://localhost:5000/api/emails/notifications/read-all', { method: 'POST', credentials: 'include' })
        .then(() => {
          setActiveToast(null);
        });
    }
  };

  return (
    <div style={styles.container}>
      {/* 1. FLOATING WARNING TOAST */}
      {activeToast && (
        <div style={styles.toastCard} className="glass-panel glow-phishing animate-slide-in">
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={styles.toastIconBox}>
              <i className="fa-solid fa-triangle-exclamation" style={{ color: '#EF4444' }}></i>
            </div>
            <div style={{ flexGrow: 1 }}>
              <div style={styles.toastTitle}>{activeToast.title}</div>
              <div style={styles.toastMsg}>{activeToast.message}</div>
            </div>
            <button style={styles.toastCloseBtn} onClick={closeToast}>&times;</button>
          </div>
        </div>
      )}

      {/* Header section */}
      <header style={styles.header}>
        <div>
          <h2 style={styles.title}>AI Phishing Detection Center</h2>
          <p style={styles.subtitle}>Real-time mailbox sync monitoring and homoglyph threat inspection dashboard</p>
        </div>
        
        {connectedAccount && (
          <button 
            style={{ ...styles.btnSync, opacity: syncing ? 0.7 : 1 }} 
            onClick={handleSync}
            disabled={syncing}
          >
            <i className={`fa-solid fa-rotate ${syncing ? 'fa-spin' : ''}`} style={{ marginRight: '8px' }}></i>
            {syncing ? 'Scanning Real Mailbox...' : 'Sync Inbox Now'}
          </button>
        )}
      </header>

      {/* 2. REAL IMAP MAILBOX CONNECTOR SECTION */}
      <section style={styles.connectorCard} className="glass-panel">
        {connectedAccount ? (
          <div style={styles.connectedRow}>
            <div>
              <div style={styles.connectedTitle}>
                <span style={styles.activeDot}></span>
                Active Real-Time Monitoring
              </div>
              <p style={styles.connectedDesc}>
                Connected to <strong style={{ color: '#06B6D4' }}>{connectedAccount.email}</strong> via secure IMAP. 
                Recent incoming emails are scanned in real-time.
              </p>
            </div>
            <button style={styles.btnDisconnect} onClick={handleDisconnectImap}>
              <i className="fa-solid fa-link-slash" style={{ marginRight: '6px' }}></i>Disconnect Account
            </button>
          </div>
        ) : (
          <div>
            <div style={styles.connectorHeader}>
              <i className="fa-solid fa-circle-nodes text-cyan" style={{ fontSize: '20px' }}></i>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700' }}>Connect Your Real Email Account</h3>
            </div>
            <p style={styles.connectorDesc}>
              To scan your actual emails in real-time, link your account using a secure **App Password**. 
              This will pull your last 15 emails and check them for phishing instantly.
            </p>
            
            <form onSubmit={handleConnectImap} style={styles.imapForm}>
              <input 
                type="email" 
                placeholder="Gmail Address (e.g. yourname@gmail.com)" 
                style={styles.input}
                value={imapEmail}
                onChange={e => setImapEmail(e.target.value)}
                required
              />
              <input 
                type="password" 
                placeholder="Google App Password (16 characters)" 
                style={styles.input}
                value={imapPassword}
                onChange={e => setImapPassword(e.target.value)}
                required
              />
              <button type="submit" style={styles.btnConnect} disabled={connectingImap}>
                {connectingImap ? 'Connecting...' : 'Link & Scan Real Inbox'}
              </button>
            </form>
            
            <div style={styles.imapHint}>
              <i className="fa-solid fa-circle-info" style={{ marginRight: '6px' }}></i>
              <strong>Gmail Setup:</strong> Go to your Google Account Settings &rarr; Security &rarr; Enable 2-Step Verification &rarr; Search "App Passwords" to generate a 16-character code. Do not enter your main password.
            </div>
          </div>
        )}
      </section>

      {/* Grid statistics metrics dials */}
      <section style={styles.statsGrid}>
        <div style={styles.statCard} className="glass-panel">
          <div style={styles.statIcon}><i className="fa-solid fa-envelope-open-text text-cyan"></i></div>
          <div>
            <div style={styles.statLabel}>Emails Scanned</div>
            <div style={styles.statVal}>{stats.total_scanned}</div>
          </div>
        </div>
        
        <div style={{ ...styles.statCard }} className="glass-panel glow-phishing">
          <div style={{ ...styles.statIcon, background: 'rgba(239, 68, 68, 0.12)' }}>
            <i className="fa-solid fa-shield-virus" style={{ color: '#EF4444' }}></i>
          </div>
          <div>
            <div style={styles.statLabel}>Phishing Detected</div>
            <div style={{ ...styles.statVal, color: '#EF4444' }}>{stats.phishing_count}</div>
          </div>
        </div>

        <div style={styles.statCard} className="glass-panel glow-safe">
          <div style={{ ...styles.statIcon, background: 'rgba(16, 185, 129, 0.12)' }}>
            <i className="fa-solid fa-shield-halved" style={{ color: '#10B981' }}></i>
          </div>
          <div>
            <div style={styles.statLabel}>Safe Emails</div>
            <div style={{ ...styles.statVal, color: '#10B981' }}>{stats.safe_count}</div>
          </div>
        </div>

        <div style={styles.statCard} className="glass-panel">
          <div style={styles.statIcon}><i className="fa-solid fa-circle-exclamation text-warning"></i></div>
          <div>
            <div style={styles.statLabel}>Risk Index</div>
            <div style={styles.statVal}>
              {stats.avg_risk_score}%
              <span style={{ fontSize: '11px', color: '#9CA3AF', marginLeft: '6px', fontWeight: 'normal' }}>avg</span>
            </div>
          </div>
        </div>
      </section>

      {/* Scanned emails feed list */}
      <section style={styles.tablePanel} className="glass-panel">
        <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>Mailbox Scan Records history</h3>
        
        {loading ? (
          <div style={styles.spinnerBox}>
            <div style={styles.spinner}></div>
          </div>
        ) : emails.length === 0 ? (
          <div style={styles.emptyState}>
            <i className="fa-solid fa-inbox" style={{ fontSize: '42px', color: '#4B5563', marginBottom: '16px' }}></i>
            <p>No email scans loaded. Connect your email account via the connector above to start real-time threat scanning.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.thRow}>
                  <th style={styles.th}>Sender Address</th>
                  <th style={styles.th}>Subject Line</th>
                  <th style={styles.th}>Scanned At</th>
                  <th style={styles.th}>Risk Index</th>
                  <th style={styles.th}>Classification</th>
                </tr>
              </thead>
              <tbody>
                {emails.map((email, idx) => (
                  <tr key={email.id || idx} style={styles.trRow}>
                    <td style={styles.td}>
                      <span style={styles.senderText}>{email.sender}</span>
                    </td>
                    <td style={styles.td}>{email.subject}</td>
                    <td style={{ ...styles.td, color: '#6B7280', fontSize: '12px' }}>
                      {email.scanned_at ? email.scanned_at.split('T')[0] : 'N/A'}
                    </td>
                    <td style={styles.td}>
                      <div style={styles.scoreBarBg}>
                        <div style={{ 
                          ...styles.scoreBarFill, 
                          width: `${email.risk_score}%`,
                          background: email.classification === 'phishing' ? '#EF4444' : email.classification === 'suspect' ? '#F59E0B' : '#10B981'
                        }}></div>
                      </div>
                      <span style={{ fontSize: '11px', color: '#9CA3AF' }}>{email.risk_score}%</span>
                    </td>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.badge,
                        background: email.classification === 'phishing' ? 'rgba(239, 68, 68, 0.12)' : email.classification === 'suspect' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                        color: email.classification === 'phishing' ? '#EF4444' : email.classification === 'suspect' ? '#F59E0B' : '#10B981',
                        border: `1px solid ${email.classification === 'phishing' ? 'rgba(239, 68, 68, 0.2)' : email.classification === 'suspect' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`
                      }}>
                        {email.classification.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

const styles = {
  container: {
    padding: '40px',
    background: 'radial-gradient(circle at 50% 0%, rgba(99, 102, 241, 0.08) 0%, rgba(0,0,0,0) 60%), #080A10',
    minHeight: '100vh',
    position: 'relative'
  },
  toastCard: {
    position: 'fixed',
    top: '30px',
    right: '30px',
    width: '380px',
    padding: '16px',
    borderRadius: '12px',
    zIndex: 9999,
    background: '#161928'
  },
  toastIconBox: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: 'rgba(239, 68, 68, 0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    flexShrink: 0
  },
  toastTitle: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#FFF',
    marginBottom: '4px'
  },
  toastMsg: {
    fontSize: '12px',
    color: '#9CA3AF',
    lineHeight: '1.4'
  },
  toastCloseBtn: {
    background: 'none',
    border: 'none',
    color: '#9CA3AF',
    fontSize: '20px',
    cursor: 'pointer',
    alignSelf: 'flex-start'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '32px',
    flexWrap: 'wrap',
    gap: '20px'
  },
  title: {
    fontSize: '30px',
    fontWeight: '800',
    margin: '0 0 6px 0',
    color: '#FFF',
    letterSpacing: '-0.5px'
  },
  subtitle: {
    margin: 0,
    color: '#9CA3AF',
    fontSize: '14px'
  },
  connectorCard: {
    borderRadius: '16px',
    padding: '24px',
    marginBottom: '32px',
    background: 'rgba(22, 28, 45, 0.45)',
    border: '1px solid rgba(255, 255, 255, 0.05)'
  },
  connectorHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '10px'
  },
  connectorDesc: {
    fontSize: '13.5px',
    color: '#9CA3AF',
    margin: '0 0 16px 0',
    lineHeight: '1.5'
  },
  imapForm: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
    marginBottom: '16px'
  },
  input: {
    flex: '1 1 250px',
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(0,0,0,0.2)',
    color: '#FFF',
    fontSize: '13.5px',
    outline: 'none'
  },
  btnConnect: {
    background: 'linear-gradient(135deg, #06B6D4 0%, #6366F1 100%)',
    color: '#FFF',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '8px',
    fontWeight: '700',
    cursor: 'pointer',
    fontSize: '13.5px',
    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)'
  },
  imapHint: {
    fontSize: '12px',
    color: '#F59E0B',
    lineHeight: '1.5',
    background: 'rgba(245, 158, 11, 0.05)',
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid rgba(245, 158, 11, 0.1)'
  },
  connectedRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '20px'
  },
  connectedTitle: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#FFF',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '6px'
  },
  activeDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    background: '#10B981',
    boxShadow: '0 0 10px #10B981',
    display: 'inline-block'
  },
  connectedDesc: {
    margin: 0,
    fontSize: '13.5px',
    color: '#9CA3AF'
  },
  btnDisconnect: {
    background: 'rgba(239, 68, 68, 0.08)',
    border: '1px solid rgba(239, 68, 68, 0.15)',
    color: '#EF4444',
    padding: '10px 16px',
    borderRadius: '8px',
    fontWeight: '600',
    cursor: 'pointer',
    fontSize: '13px',
    transition: '0.2s'
  },
  btnSync: {
    background: 'linear-gradient(135deg, #06B6D4 0%, #6366F1 100%)',
    color: '#FFF',
    border: 'none',
    padding: '12px 24px',
    borderRadius: '8px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 4px 15px rgba(99, 102, 241, 0.35)',
    display: 'flex',
    alignItems: 'center',
    fontSize: '14px',
    transition: 'transform 0.2s'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '24px',
    marginBottom: '40px'
  },
  statCard: {
    borderRadius: '16px',
    padding: '24px',
    display: 'flex',
    alignItems: 'center',
    gap: '20px'
  },
  statIcon: {
    width: '52px',
    height: '52px',
    borderRadius: '12px',
    background: 'rgba(6, 182, 212, 0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '22px',
    flexShrink: 0
  },
  statLabel: {
    fontSize: '12px',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    fontWeight: '600',
    marginBottom: '6px'
  },
  statVal: {
    fontSize: '28px',
    fontWeight: '800',
    color: '#FFF'
  },
  tablePanel: {
    borderRadius: '16px',
    padding: '32px'
  },
  spinnerBox: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '60px'
  },
  spinner: {
    width: '36px',
    height: '36px',
    border: '4px solid rgba(6, 182, 212, 0.15)',
    borderTop: '4px solid #06B6D4',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  emptyState: {
    textAlign: 'center',
    padding: '40px 20px',
    color: '#9CA3AF'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left'
  },
  thRow: {
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
  },
  th: {
    padding: '12px 16px',
    fontSize: '12px',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    fontWeight: '700'
  },
  trRow: {
    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
    transition: 'background 0.2s',
    cursor: 'pointer'
  },
  td: {
    padding: '16px',
    fontSize: '14px',
    color: '#E5E7EB'
  },
  senderText: {
    fontWeight: '600',
    color: '#06B6D4'
  },
  badge: {
    padding: '4px 10px',
    borderRadius: '20px',
    fontSize: '10px',
    fontWeight: '800',
    letterSpacing: '0.5px'
  },
  scoreBarBg: {
    width: '100px',
    height: '6px',
    background: 'rgba(255, 255, 255, 0.08)',
    borderRadius: '3px',
    marginBottom: '4px',
    overflow: 'hidden'
  },
  scoreBarFill: {
    height: '100%'
  }
};

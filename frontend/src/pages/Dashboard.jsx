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
  
  // Real-Time Warning Alert Toast state
  const [activeToast, setActiveToast] = useState(null);

  useEffect(() => {
    fetchDashboardData();
    // Poll notifications every 8 seconds to detect background sync threat intercepts
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

  const pollNotifications = () => {
    fetch('http://localhost:5000/api/emails/notifications', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data.status === 'success' && data.notifications.length > 0) {
          // Detect latest unread threat
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

  const closeToast = () => {
    if (activeToast) {
      // Mark notifications as read in backend
      fetch('http://localhost:5000/api/emails/notifications/read-all', { method: 'POST', credentials: 'include' })
        .then(() => {
          setActiveToast(null);
        });
    }
  };

  return (
    <div style={styles.container}>
      {/* 1. FLOATING WARING TOAST */}
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
        <button 
          style={{ ...styles.btnSync, opacity: syncing ? 0.7 : 1 }} 
          onClick={handleSync}
          disabled={syncing}
        >
          <i className={`fa-solid fa-rotate ${syncing ? 'fa-spin' : ''}`} style={{ marginRight: '8px' }}></i>
          {syncing ? 'Scanning Mailbox...' : 'Sync Gmail Inbox'}
        </button>
      </header>

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
            <p>No email scans loaded. Connect Gmail and sync mailbox or visit Email Details to paste and analyze text manually.</p>
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
    marginBottom: '40px',
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

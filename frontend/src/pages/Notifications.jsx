import React, { useState, useEffect } from 'react';

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 8000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = () => {
    fetch('http://localhost:5000/api/emails/notifications', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data.status === 'success') {
          // Sort chronologically (latest first)
          const sorted = data.notifications.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
          setNotifications(sorted);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  const handleMarkAllRead = () => {
    setClearing(true);
    fetch('http://localhost:5000/api/emails/notifications/read-all', { method: 'POST', credentials: 'include' })
      .then(r => r.json())
      .then(() => {
        setClearing(false);
        fetchNotifications();
      })
      .catch(() => setClearing(false));
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>System Alerts & Notifications</h2>
          <p style={styles.subtitle}>Audit history of all real-time security threats and system status updates.</p>
        </div>
        <button 
          style={styles.btnReadInfo} 
          onClick={handleMarkAllRead}
          disabled={clearing || notifications.filter(n => !n.read).length === 0}
        >
          <i className="fa-solid fa-envelope-open" style={{ marginRight: '8px' }}></i>
          {clearing ? 'Marking...' : 'Mark All as Read'}
        </button>
      </div>

      <div style={styles.grid}>
        {/* Main Notifications List */}
        <div style={styles.feedCard} className="glass-panel">
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>
              <i className="fa-solid fa-bell" style={{ color: '#6366F1', marginRight: '10px' }}></i>
              Active Warnings ({notifications.filter(n => !n.read).length} unread)
            </h3>
          </div>

          {loading ? (
            <div style={styles.loadingBox}>
              <div style={styles.spinner}></div>
            </div>
          ) : notifications.length === 0 ? (
            <div style={styles.emptyBox}>
              <i className="fa-solid fa-bell-slash" style={{ fontSize: '24px', color: '#6B7280', marginBottom: '12px' }}></i>
              <div>No alerts on record. Your mailbox is secure.</div>
            </div>
          ) : (
            <div style={styles.feedList}>
              {notifications.map((item, idx) => {
                const isPhish = item.title?.toLowerCase().includes('suspicious') || 
                                item.title?.toLowerCase().includes('warning') || 
                                item.message?.toLowerCase().includes('threat');
                return (
                  <div 
                    key={item.id || idx} 
                    style={{ 
                      ...styles.feedItem, 
                      ...(item.read ? {} : styles.unreadFeedItem),
                      borderLeft: `4px solid ${isPhish ? '#EF4444' : '#10B981'}`
                    }}
                  >
                    <div style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '50%',
                      background: isPhish ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <i className={isPhish ? "fa-solid fa-triangle-exclamation" : "fa-solid fa-circle-check"} style={{ color: isPhish ? '#EF4444' : '#10B981', fontSize: '15px' }}></i>
                    </div>

                    <div style={{ flexGrow: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ ...styles.feedTitle, color: isPhish ? '#EF4444' : '#FFF' }}>{item.title}</div>
                        <span style={styles.feedTime}>
                          {item.created_at ? new Date(item.created_at).toLocaleString() : 'N/A'}
                        </span>
                      </div>
                      <div style={styles.feedMsg}>{item.message}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right side alert statistics summary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={styles.card} className="glass-panel" style={{ ...styles.card, border: '2px solid #EF4444', boxShadow: '0 0 25px rgba(239, 68, 68, 0.15)' }}>
            <h3 style={styles.cardTitle}>
              <i className="fa-solid fa-shield-virus" style={{ color: '#EF4444', marginRight: '10px' }}></i>
              Security Advisory
            </h3>
            <p style={styles.advisoryText}>
              Any email flag marked as <strong>Suspicious Email Detected</strong> requires immediate action. PhishShield AI automatically quarantines high-risk spoof messages into the spam directory.
            </p>
            <div style={styles.advisoryBullet}>
              <i className="fa-solid fa-circle-nodes" style={{ color: '#EF4444' }}></i>
              <span>Heuristic SPF rules block unauthorized senders.</span>
            </div>
            <div style={styles.advisoryBullet}>
              <i className="fa-solid fa-circle-nodes" style={{ color: '#EF4444' }}></i>
              <span>NLTK analyzes semantic urgency indicators.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: '30px',
    background: 'transparent',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px'
  },
  title: {
    fontSize: '28px',
    fontWeight: '800',
    margin: 0,
    color: '#FFF',
    letterSpacing: '-0.5px'
  },
  subtitle: {
    fontSize: '13.5px',
    color: '#8A92A6',
    margin: '4px 0 0 0'
  },
  btnReadInfo: {
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    color: '#FFF',
    padding: '10px 20px',
    borderRadius: '8px',
    fontWeight: '700',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1.5fr 1fr',
    gap: '30px',
    alignItems: 'start'
  },
  feedCard: {
    borderRadius: '16px',
    padding: '24px',
    minHeight: '400px'
  },
  card: {
    padding: '24px',
    borderRadius: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  cardHeader: {
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    paddingBottom: '16px',
    marginBottom: '16px'
  },
  cardTitle: {
    fontSize: '15px',
    fontWeight: '800',
    color: '#FFF',
    margin: '0',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    display: 'flex',
    alignItems: 'center'
  },
  loadingBox: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '300px'
  },
  spinner: {
    width: '36px',
    height: '36px',
    border: '4px solid rgba(99, 102, 241, 0.15)',
    borderTop: '4px solid #6366F1',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  emptyBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '300px',
    color: '#8A92A6',
    fontSize: '14px'
  },
  feedList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  feedItem: {
    background: 'rgba(0, 0, 0, 0.15)',
    border: '1px solid rgba(255, 255, 255, 0.03)',
    borderRadius: '10px',
    padding: '16px',
    display: 'flex',
    gap: '14px',
    alignItems: 'flex-start',
    transition: 'all 0.25s ease'
  },
  unreadFeedItem: {
    background: 'rgba(99, 102, 241, 0.03)',
    border: '1px solid rgba(99, 102, 241, 0.12)',
    boxShadow: '0 0 15px rgba(99, 102, 241, 0.04)'
  },
  feedTitle: {
    fontSize: '13.5px',
    fontWeight: '700',
    lineHeight: '1'
  },
  feedTime: {
    fontSize: '11px',
    color: '#8A92A6'
  },
  feedMsg: {
    fontSize: '12.5px',
    color: '#D1D5DB',
    marginTop: '6px',
    lineHeight: '1.4'
  },
  advisoryText: {
    fontSize: '13px',
    color: '#D1D5DB',
    lineHeight: '1.5',
    margin: '0 0 6px 0'
  },
  advisoryBullet: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '12px',
    color: '#8A92A6'
  }
};

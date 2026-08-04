import React, { useState, useEffect } from 'react';

export default function AdminPanel() {
  const [threshold, setThreshold] = useState(70);
  const [whitelist, setWhitelist] = useState(['university.edu', 'google.com', 'microsoft.com']);
  const [newDomain, setNewDomain] = useState('');
  
  const [notifications, setNotifications] = useState([]);
  const [loadingNotifs, setLoadingNotifs] = useState(true);

  useEffect(() => {
    fetchNotificationLogs();
  }, []);

  const fetchNotificationLogs = () => {
    fetch('http://localhost:5000/api/emails/notifications', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data.status === 'success') {
          // Filter to show simulated SMS / Email outbound relay queues
          const outbound = data.notifications.filter(n => n.channel !== 'in_app');
          setNotifications(outbound);
        }
        setLoadingNotifs(false);
      })
      .catch(() => setLoadingNotifs(false));
  };

  const handleAddWhitelist = (e) => {
    e.preventDefault();
    if (newDomain.trim() && !whitelist.includes(newDomain.trim())) {
      setWhitelist([...whitelist, newDomain.trim()]);
      setNewDomain('');
      alert('Whitelist parameters updated.');
    }
  };

  const handleRemoveWhitelist = (domain) => {
    setWhitelist(whitelist.filter(d => d !== domain));
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h2 style={styles.title}>System Admin Dashboard</h2>
        <p style={styles.subtitle}>Configure AI classifier thresholds and inspect outbound alert relay queues</p>
      </header>

      <div style={styles.layoutGrid}>
        {/* Threshold sensitivity configuration */}
        <section style={styles.cardPanel} className="glass-panel">
          <h3 style={styles.panelTitle}>Classifier Cutoffs</h3>
          <p style={styles.description}>Set the phishing threat risk score threshold at which emails are flagged as malicious.</p>
          
          <div style={styles.sliderGroup}>
            <div style={styles.sliderLabelRow}>
              <span>Sensitivity Threshold</span>
              <span style={{ color: '#EF4444', fontWeight: 'bold' }}>{threshold}% Risk</span>
            </div>
            <input 
              type="range" 
              min="30" 
              max="90" 
              style={styles.slider} 
              value={threshold} 
              onChange={e => setThreshold(e.target.value)} 
            />
            <div style={styles.sliderLimits}>
              <span>High Alert (30)</span>
              <span>Lenient (90)</span>
            </div>
          </div>
        </section>

        {/* Global Whitelisted Domains list */}
        <section style={styles.cardPanel} className="glass-panel">
          <h3 style={styles.panelTitle}>Whitelisted Domains</h3>
          <p style={styles.description}>Bypass checking checks for trusted organizational domain senders.</p>
          
          <form onSubmit={handleAddWhitelist} style={styles.inlineForm}>
            <input 
              type="text" 
              placeholder="e.g. mycompany.com" 
              style={styles.input}
              value={newDomain}
              onChange={e => setNewDomain(e.target.value)}
              required
            />
            <button type="submit" style={styles.btnAdd}>Whitelist</button>
          </form>

          <div style={styles.tagsContainer}>
            {whitelist.map(domain => (
              <span key={domain} style={styles.tag}>
                {domain}
                <button style={styles.tagClose} onClick={() => handleRemoveWhitelist(domain)}>&times;</button>
              </span>
            ))}
          </div>
        </section>
      </div>

      {/* Outbound Relays Alert log queues (Twilio SMS and SMTP logs) */}
      <section style={{ ...styles.cardPanel, marginTop: '32px' }} className="glass-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={styles.panelTitle}>Simulated Alerts Dispatch Relay Queue</h3>
          <button style={styles.btnRefresh} onClick={fetchNotificationLogs}>
            <i className="fa-solid fa-arrows-rotate" style={{ marginRight: '6px' }}></i>Refresh logs
          </button>
        </div>
        <p style={styles.description}>Live transmission history of warning dispatches triggered on phishing intersections (SMS & Email relays).</p>

        {loadingNotifs ? (
          <div style={styles.spinnerBox}>
            <div style={styles.spinner}></div>
          </div>
        ) : notifications.length === 0 ? (
          <div style={styles.emptyState}>
            No outbound transmissions logged yet. Sync inbox or scan suspicious emails to populate.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.thRow}>
                  <th style={styles.th}>Dispatched At</th>
                  <th style={styles.th}>Alert Type</th>
                  <th style={styles.th}>Recipient target</th>
                  <th style={styles.th}>Transmission Message payload</th>
                  <th style={styles.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {notifications.map((notif, idx) => (
                  <tr key={notif.id || idx} style={styles.trRow}>
                    <td style={{ ...styles.td, fontSize: '12px', color: '#6B7280' }}>
                      {notif.dispatched_at ? notif.dispatched_at.split('T')[0] : 'Just now'}
                    </td>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.badge,
                        background: notif.channel === 'sms_sim' ? 'rgba(6, 182, 212, 0.1)' : 'rgba(99, 102, 241, 0.1)',
                        color: notif.channel === 'sms_sim' ? '#06B6D4' : '#6366F1'
                      }}>
                        {notif.channel === 'sms_sim' ? 'SMS: TWILIO' : 'EMAIL: SMTP'}
                      </span>
                    </td>
                    <td style={{ ...styles.td, fontWeight: 'bold' }}>{notif.recipient_target}</td>
                    <td style={{ ...styles.td, color: '#9CA3AF', fontSize: '13px' }}>{notif.message}</td>
                    <td style={styles.td}>
                      <span style={styles.badgeSuccess}>
                        <i className="fa-solid fa-circle-check" style={{ marginRight: '6px' }}></i>SENT
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
    background: 'transparent',
    minHeight: '100vh'
  },
  header: {
    marginBottom: '32px'
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
  layoutGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
    gap: '32px',
    alignItems: 'start'
  },
  cardPanel: {
    padding: '32px',
    borderRadius: '16px'
  },
  panelTitle: {
    fontSize: '18px',
    fontWeight: '600',
    margin: '0 0 8px 0'
  },
  description: {
    fontSize: '13.5px',
    color: '#9CA3AF',
    lineHeight: '1.5',
    margin: '0 0 24px 0'
  },
  sliderGroup: {
    marginTop: '20px'
  },
  sliderLabelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px',
    fontWeight: '600',
    marginBottom: '10px'
  },
  slider: {
    width: '100%',
    height: '6px',
    background: 'rgba(255,255,255,0.08)',
    borderRadius: '3px',
    outline: 'none',
    cursor: 'pointer',
    accentColor: '#06B6D4'
  },
  sliderLimits: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '11px',
    color: '#6B7280',
    marginTop: '8px'
  },
  inlineForm: {
    display: 'flex',
    gap: '12px',
    marginBottom: '20px'
  },
  input: {
    flexGrow: 1,
    padding: '10px 14px',
    borderRadius: '6px',
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(0,0,0,0.2)',
    color: '#FFF',
    fontSize: '13.5px',
    outline: 'none'
  },
  btnAdd: {
    background: '#06B6D4',
    color: '#FFF',
    border: 'none',
    padding: '10px 16px',
    borderRadius: '6px',
    fontWeight: 'bold',
    cursor: 'pointer'
  },
  tagsContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px'
  },
  tag: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '16px',
    padding: '6px 12px',
    fontSize: '12.5px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px'
  },
  tagClose: {
    background: 'none',
    border: 'none',
    color: '#EF4444',
    fontWeight: 'bold',
    cursor: 'pointer',
    fontSize: '14px',
    padding: 0
  },
  btnRefresh: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#E5E7EB',
    padding: '8px 14px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  spinnerBox: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '40px'
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '4px solid rgba(6, 182, 212, 0.15)',
    borderTop: '4px solid #06B6D4',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  emptyState: {
    textAlign: 'center',
    padding: '40px',
    color: '#6B7280'
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
    padding: '12px',
    fontSize: '11px',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  trRow: {
    borderBottom: '1px solid rgba(255, 255, 255, 0.04)'
  },
  td: {
    padding: '14px 12px',
    fontSize: '13.5px',
    color: '#E5E7EB'
  },
  badge: {
    padding: '3px 8px',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: '700'
  },
  badgeSuccess: {
    color: '#10B981',
    fontWeight: 'bold',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center'
  }
};

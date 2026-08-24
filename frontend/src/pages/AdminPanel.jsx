/**
 * ============================================================================
 * COMPONENT: AdminPanel.jsx (Outbound Relay Controller & SMTP Rules)
 * ============================================================================
 * Description:
 * Provides administrators with controls to tune model risk thresholds,
 * white-list trusted domains, and audit outbound mock notification logs (Email/SMS).
 *
 * Endpoints Called:
 * - GET   http://127.0.0.1:5000/api/emails/notifications   (Outbound notification relays)
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import './AdminPanel.css';

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
    fetch('http://127.0.0.1:5000/api/emails/notifications', { credentials: 'include' })
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
    <div className="admin-panel-container">
      <header className="admin-panel-header">
        <h2 className="admin-panel-title">System Administration</h2>
        <p className="admin-panel-subtitle">Access global classifier heuristics and transmission configurations</p>
      </header>

      <div className="admin-panel-layout-grid">
        {/* Core AI Classification Parameter sliders */}
        <section className="admin-panel-card-panel glass-panel">
          <h3 className="admin-panel-panel-title">Model Decision Boundary</h3>
          <p className="admin-panel-description">Adjust threshold parameter weights to intercept threat structures.</p>
          
          <div className="admin-panel-slider-group">
            <div className="admin-panel-slider-label-row">
              <span>NLTK Sensitivity Boundary:</span>
              <strong className="text-cyan">{threshold}%</strong>
            </div>
            <input 
              type="range" 
              min="40" 
              max="95" 
              value={threshold} 
              onChange={e => setThreshold(parseInt(e.target.value))}
              className="admin-panel-slider"
            />
            <div className="admin-panel-slider-limits">
              <span>Strict (40%)</span>
              <span>Lenient (95%)</span>
            </div>
          </div>
        </section>

        {/* Sender Whitelist manager */}
        <section className="admin-panel-card-panel glass-panel">
          <h3 className="admin-panel-panel-title">Whitelisted Domains</h3>
          <p className="admin-panel-description">Bypass checking checks for trusted organizational domain senders.</p>
          
          <form onSubmit={handleAddWhitelist} className="admin-panel-inline-form">
            <input 
              type="text" 
              placeholder="e.g. mycompany.com" 
              className="admin-panel-input"
              value={newDomain}
              onChange={e => setNewDomain(e.target.value)}
              required
            />
            <button type="submit" className="admin-panel-btn-add">Whitelist</button>
          </form>

          <div className="admin-panel-tags-container">
            {whitelist.map(domain => (
              <span key={domain} className="admin-panel-tag">
                {domain}
                <button className="admin-panel-tag-close" onClick={() => handleRemoveWhitelist(domain)}>&times;</button>
              </span>
            ))}
          </div>
        </section>
      </div>

      {/* Outbound Relays Alert log queues (Twilio SMS and SMTP logs) */}
      <section className="admin-panel-card-panel glass-panel" style={{ marginTop: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 className="admin-panel-panel-title">Simulated Alerts Dispatch Relay Queue</h3>
          <button className="admin-panel-btn-refresh" onClick={fetchNotificationLogs}>
            <i className="fa-solid fa-arrows-rotate" style={{ marginRight: '6px' }}></i>Refresh logs
          </button>
        </div>
        <p className="admin-panel-description">Live transmission history of warning dispatches triggered on phishing intersections (SMS & Email relays).</p>

        {loadingNotifs ? (
          <div className="admin-panel-spinner-box">
            <div className="admin-panel-spinner"></div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="admin-panel-empty-state">
            No outbound transmissions logged yet. Sync inbox or scan suspicious emails to populate.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-panel-table">
              <thead>
                <tr className="admin-panel-th-row">
                  <th className="admin-panel-th">Dispatched At</th>
                  <th className="admin-panel-th">Alert Type</th>
                  <th className="admin-panel-th">Recipient target</th>
                  <th className="admin-panel-th">Transmission Message payload</th>
                  <th className="admin-panel-th">Status</th>
                </tr>
              </thead>
              <tbody>
                {notifications.map((notif, idx) => (
                  <tr key={notif.id || idx} className="admin-panel-tr-row">
                    <td className="admin-panel-td" style={{ fontSize: '12px', color: '#6B7280' }}>
                      {notif.dispatched_at ? notif.dispatched_at.split('T')[0] : 'Just now'}
                    </td>
                    <td className="admin-panel-td">
                      <span 
                        className="admin-panel-badge"
                        style={{
                          background: notif.channel === 'sms_sim' ? 'rgba(6, 182, 212, 0.1)' : 'rgba(99, 102, 241, 0.1)',
                          color: notif.channel === 'sms_sim' ? '#06B6D4' : '#6366F1'
                        }}
                      >
                        {notif.channel === 'sms_sim' ? 'SMS: TWILIO' : 'EMAIL: SMTP'}
                      </span>
                    </td>
                    <td className="admin-panel-td" style={{ fontWeight: 'bold' }}>{notif.recipient_target}</td>
                    <td className="admin-panel-td" style={{ color: '#9CA3AF', fontSize: '13px' }}>{notif.message}</td>
                    <td className="admin-panel-td">
                      <span className="admin-panel-badge-success">
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

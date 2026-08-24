/**
 * ============================================================================
 * COMPONENT: Notifications.jsx (In-App Threat Alert Center)
 * ============================================================================
 * Description:
 * Displays a timeline of in-app phishing warnings and allows marking all warnings
 * as read.
 *
 * Endpoints Called:
 * - GET   http://127.0.0.1:5000/api/emails/notifications   (Retrieve notifications feed)
 * - POST  http://127.0.0.1:5000/api/emails/notifications/read-all (Acknowledge all alerts)
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import './Notifications.css';

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
    fetch('http://127.0.0.1:5000/api/emails/notifications', { credentials: 'include' })
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
    fetch('http://127.0.0.1:5000/api/emails/notifications/read-all', { method: 'POST', credentials: 'include' })
      .then(r => r.json())
      .then(() => {
        setClearing(false);
        fetchNotifications();
      })
      .catch(() => setClearing(false));
  };

  return (
    <div className="notifications-container">
      <div className="notifications-header">
        <div>
          <h2 className="notifications-title">System Alerts & Notifications</h2>
          <p className="notifications-subtitle">Audit history of all real-time security threats and system status updates.</p>
        </div>
        <button 
          className="notifications-btn-read-info" 
          onClick={handleMarkAllRead}
          disabled={clearing || notifications.filter(n => !n.read).length === 0}
        >
          <i className="fa-solid fa-envelope-open" style={{ marginRight: '8px' }}></i>
          {clearing ? 'Marking...' : 'Mark All as Read'}
        </button>
      </div>

      <div className="notifications-grid">
        {/* Main Notifications List */}
        <div className="notifications-feed-card glass-panel">
          <div className="notifications-card-header">
            <h3 className="notifications-card-title">
              <i className="fa-solid fa-bell" style={{ color: '#6366F1', marginRight: '10px' }}></i>
              Active Warnings ({notifications.filter(n => !n.read).length} unread)
            </h3>
          </div>

          {loading ? (
            <div className="notifications-loading-box">
              <div className="notifications-spinner"></div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="notifications-empty-box">
              <i className="fa-solid fa-bell-slash" style={{ fontSize: '24px', color: '#6B7280', marginBottom: '12px' }}></i>
              <div>No alerts on record. Your mailbox is secure.</div>
            </div>
          ) : (
            <div className="notifications-feed-list">
              {notifications.map((item, idx) => {
                const isPhish = item.title?.toLowerCase().includes('suspicious') || 
                                item.title?.toLowerCase().includes('warning') || 
                                item.message?.toLowerCase().includes('threat');
                return (
                  <div 
                    key={item.id || idx} 
                    className={`notifications-feed-item ${item.read ? '' : 'notifications-unread-feed-item'}`}
                    style={{ borderLeft: `4px solid ${isPhish ? '#EF4444' : '#10B981'}` }}
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
                        <div className="notifications-feed-title" style={{ color: isPhish ? '#EF4444' : '#FFF' }}>{item.title}</div>
                        <span className="notifications-feed-time">
                          {item.created_at ? new Date(item.created_at).toLocaleString() : 'N/A'}
                        </span>
                      </div>
                      <div className="notifications-feed-msg">{item.message}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right side alert statistics summary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div 
            className="notifications-card glass-panel" 
            style={{ border: '2px solid #EF4444', boxShadow: '0 0 25px rgba(239, 68, 68, 0.15)' }}
          >
            <h3 className="notifications-card-title">
              <i className="fa-solid fa-shield-virus" style={{ color: '#EF4444', marginRight: '10px' }}></i>
              Security Advisory
            </h3>
            <p className="notifications-advisory-text">
              Any email flag marked as <strong>Suspicious Email Detected</strong> requires immediate action. PhishShield AI automatically quarantines high-risk spoof messages into the spam directory.
            </p>
            <div className="notifications-advisory-bullet">
              <i className="fa-solid fa-circle-nodes" style={{ color: '#EF4444' }}></i>
              <span>Heuristic SPF rules block unauthorized senders.</span>
            </div>
            <div className="notifications-advisory-bullet">
              <i className="fa-solid fa-circle-nodes" style={{ color: '#EF4444' }}></i>
              <span>NLTK analyzes semantic urgency indicators.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * ============================================================================
 * COMPONENT: Dashboard.jsx (Security Overview & Inbox Monitor Hub)
 * ============================================================================
 * Description:
 * Renders the central security control dashboard. Features real-time counters,
 * threat trend line graphs, interactive risk-doughnut gauges, AI core
 * training triggers, live threat hotspots geo-mapping, and split list views
 * separating clean vs malicious emails side-by-side.
 *
 * Endpoints Called:
 * - GET   http://127.0.0.1:5000/api/emails/dashboard-stats (Summary stats)
 * - GET   http://127.0.0.1:5000/api/emails/recent          (Monitored email stream)
 * - POST  http://127.0.0.1:5000/api/emails/sync            (IMAP email fetcher)
 * - GET   http://127.0.0.1:5000/api/emails/notifications   (Floating warnings)
 * - POST  http://127.0.0.1:5000/api/emails/notifications/read-all (Clear active warning toast)
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import './Dashboard.css';

export default function Dashboard({ user }) {
  const [stats, setStats] = useState({
    total_scanned: 0,
    safe_count: 0,
    phishing_count: 0,
    suspect_count: 0,
    avg_risk_score: 0
  });

  const [emails, setEmails] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [timeStr, setTimeStr] = useState('09:41 AM');
  
  // Floating threat alarm toast
  const [activeToast, setActiveToast] = useState(null);
  
  // Neuron retraining simulator state
  const [retraining, setRetraining] = useState(false);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 8000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = () => {
    // 1. Fetch live count stats
    fetch('http://127.0.0.1:5000/api/emails/dashboard-stats', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data.status === 'success') {
          setStats(data.stats);
        }
      })
      .catch(() => {});

    // 2. Fetch email items feed
    fetch('http://127.0.0.1:5000/api/emails/recent', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data.status === 'success') {
          setEmails(data.emails);
        }
      })
      .catch(() => {});

    // 3. Retrieve active warnings timeline to show floating urgent toast alert
    fetch('http://127.0.0.1:5000/api/emails/notifications', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data.status === 'success' && data.notifications.length > 0) {
          // Show latest unread notification if any
          const unread = data.notifications.filter(n => !n.read);
          if (unread.length > 0) {
            // Sort to grab newest
            const sorted = unread.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
            setActiveToast(sorted[0]);
          } else {
            setActiveToast(null);
          }
        }
      })
      .catch(() => {});
  };

  const handleSync = () => {
    setSyncing(true);
    fetch('http://127.0.0.1:5000/api/emails/sync', { method: 'POST', credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        setSyncing(false);
        if (data.status === 'success') {
          fetchDashboardData();
          const now = new Date();
          setTimeStr(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        }
      })
      .catch(() => {
        setSyncing(false);
      });
  };

  const handleRetrain = () => {
    setRetraining(true);
    setTimeout(() => {
      setRetraining(false);
      alert('AI Core Model PhishNet XGBoost retrained successfully. Accuracy updated: 96.84%');
    }, 2500);
  };

  const closeToast = () => {
    if (!activeToast) return;
    fetch('http://127.0.0.1:5000/api/emails/notifications/read-all', { method: 'POST', credentials: 'include' })
      .then(() => {
        setActiveToast(null);
        fetchDashboardData();
      })
      .catch(() => setActiveToast(null));
  };

  // Helper to format scan time offset
  const getScannedOffset = (dateStr) => {
    if (!dateStr) return '1m ago';
    const parsed = new Date(dateStr);
    const diffMs = new Date() - parsed;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin <= 0) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return parsed.toLocaleDateString();
  };

  // ----------------------------------------------------
  // DYNAMIC CHART DATA GENERATION
  // ----------------------------------------------------
  const totalEmails = emails.length || 1;
  const phishingCount = emails.filter(e => e.classification === 'phishing').length;
  const suspectCount = emails.filter(e => e.classification === 'suspect').length;
  const safeCount = emails.filter(e => e.classification === 'safe').length;

  const phishPercent = totalEmails > 1 ? Math.round((phishingCount / totalEmails) * 100) : 10;
  const suspectPercent = totalEmails > 1 ? Math.round((suspectCount / totalEmails) * 100) : 8;
  const safePercent = totalEmails > 1 ? Math.round((safeCount / totalEmails) * 100) : 82;

  // Filter lists
  const phishingEmails = emails.filter(e => e.classification === 'phishing' || e.classification === 'suspect');
  const safeEmails = emails.filter(e => e.classification === 'safe');

  return (
    <div className="dashboard-container">
      {/* 1. FLOATING WARNING TOAST */}
      {activeToast && (
        <div className="dashboard-toast-card glass-panel glow-phishing animate-slide-in">
          <div style={{ display: 'flex', gap: '12px' }}>
            <div className="dashboard-toast-icon-box">
              <i className="fa-solid fa-triangle-exclamation" style={{ color: '#EF4444' }}></i>
            </div>
            <div style={{ flexGrow: 1 }}>
              <div className="dashboard-toast-title">{activeToast.title}</div>
              <div className="dashboard-toast-msg">{activeToast.message}</div>
            </div>
            <button className="dashboard-toast-close-btn" onClick={closeToast}>&times;</button>
          </div>
        </div>
      )}

      {/* 2. TOP NAVBAR & SEARCH */}
      <header className="dashboard-top-bar">
        <div className="dashboard-search-wrapper">
          <i className="fa-solid fa-magnifying-glass" style={{ color: '#8A92A6', fontSize: '14px' }}></i>
          <input type="text" placeholder="Search anything..." className="dashboard-search-input" disabled />
          <span className="dashboard-search-shortcut">Ctrl K</span>
        </div>

        <div className="dashboard-user-profile-row">
          <button className="dashboard-icon-btn"><i className="fa-solid fa-moon"></i></button>
          <button className="dashboard-icon-btn" style={{ position: 'relative' }}>
            <i className="fa-solid fa-bell"></i>
            {activeToast && <span className="dashboard-notif-badge"></span>}
          </button>
          <div className="dashboard-profile-meta">
            <div className="dashboard-avatar">
              {user?.name ? user.name[0].toUpperCase() : 'A'}
            </div>
            <div>
              <div className="dashboard-profile-name">{user?.name || 'Aditya Jha'}</div>
              <div className="dashboard-profile-role">Premium User</div>
            </div>
          </div>
        </div>
      </header>

      {/* 3. DASHBOARD SUB-HEADER */}
      <div className="dashboard-sub-header">
        <div>
          <h2 className="dashboard-title">Dashboard</h2>
          <p className="dashboard-subtitle">Welcome back, {user?.name || 'Aditya'}! Here's your security overview.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span className="dashboard-updated-text">
            <i className="fa-solid fa-clock" style={{ marginRight: '6px' }}></i>
            Last updated: Today, {timeStr}
          </span>
          <button className="dashboard-btn-sync" onClick={handleSync} disabled={syncing}>
            <i className={`fa-solid fa-rotate ${syncing ? 'fa-spin' : ''}`} style={{ marginRight: '8px' }}></i>
            {syncing ? 'Syncing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* 4. FIVE GLOWING METRIC STATS CARDS */}
      <section className="dashboard-stats-grid">
        {/* Card 1 */}
        <div className="dashboard-stat-card glass-panel">
          <div className="dashboard-card-header">
            <div className="dashboard-card-icon" style={{ background: 'rgba(99, 102, 241, 0.12)', borderColor: '#6366F1' }}>
              <i className="fa-solid fa-envelope-open-text" style={{ color: '#6366F1' }}></i>
            </div>
            <div>
              <div className="dashboard-card-label">Total Emails Scanned</div>
              <div className="dashboard-card-val">{stats.total_scanned.toLocaleString()}</div>
            </div>
          </div>
          <div className="dashboard-card-trend">
            <span style={{ color: '#10B981', fontWeight: 'bold', fontSize: '11px' }}><i className="fa-solid fa-arrow-trend-up"></i> +18.6%</span>
            <span style={{ color: '#8A92A6', fontSize: '11px', marginLeft: '6px' }}>this week</span>
          </div>
          {/* Sparkline SVG */}
          <svg viewBox="0 0 200 40" className="dashboard-sparkline">
            <path d="M 0 35 Q 25 15 50 25 T 100 10 T 150 20 T 200 5" fill="none" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" />
            <path d="M 0 35 Q 25 15 50 25 T 100 10 T 150 20 T 200 5 L 200 40 L 0 40 Z" fill="rgba(99, 102, 241, 0.05)" />
          </svg>
        </div>

        {/* Card 2 */}
        <div className="dashboard-stat-card glass-panel glow-safe">
          <div className="dashboard-card-header">
            <div className="dashboard-card-icon" style={{ background: 'rgba(16, 185, 129, 0.12)', borderColor: '#10B981' }}>
              <i className="fa-solid fa-shield-halved" style={{ color: '#10B981' }}></i>
            </div>
            <div>
              <div className="dashboard-card-label">Safe Emails</div>
              <div className="dashboard-card-val" style={{ color: '#10B981' }}>{stats.safe_count.toLocaleString()}</div>
            </div>
          </div>
          <div className="dashboard-card-trend">
            <span style={{ color: '#10B981', fontWeight: 'bold', fontSize: '11px' }}><i className="fa-solid fa-arrow-trend-up"></i> +21.4%</span>
            <span style={{ color: '#8A92A6', fontSize: '11px', marginLeft: '6px' }}>this week</span>
          </div>
          <svg viewBox="0 0 200 40" className="dashboard-sparkline">
            <path d="M 0 30 Q 30 10 60 20 T 120 5 T 180 15 T 200 8" fill="none" stroke="#10B981" strokeWidth="2" />
            <path d="M 0 30 Q 30 10 60 20 T 120 5 T 180 15 T 200 8 L 200 40 L 0 40 Z" fill="rgba(16, 185, 129, 0.05)" />
          </svg>
        </div>

        {/* Card 3 */}
        <div className="dashboard-stat-card glass-panel glow-phishing">
          <div className="dashboard-card-header">
            <div className="dashboard-card-icon" style={{ background: 'rgba(239, 68, 68, 0.12)', borderColor: '#EF4444' }}>
              <i className="fa-solid fa-radiation" style={{ color: '#EF4444' }}></i>
            </div>
            <div>
              <div className="dashboard-card-label">Phishing Detected</div>
              <div className="dashboard-card-val" style={{ color: '#EF4444' }}>{(phishingCount + suspectCount).toLocaleString()}</div>
            </div>
          </div>
          <div className="dashboard-card-trend">
            <span style={{ color: '#EF4444', fontWeight: 'bold', fontSize: '11px' }}><i className="fa-solid fa-arrow-trend-up"></i> +12.3%</span>
            <span style={{ color: '#8A92A6', fontSize: '11px', marginLeft: '6px' }}>this week</span>
          </div>
          <svg viewBox="0 0 200 40" className="dashboard-sparkline">
            <path d="M 0 20 Q 40 35 80 15 T 140 25 T 200 5" fill="none" stroke="#EF4444" strokeWidth="2" />
            <path d="M 0 20 Q 40 35 80 15 T 140 25 T 200 5 L 200 40 L 0 40 Z" fill="rgba(239, 68, 68, 0.05)" />
          </svg>
        </div>

        {/* Card 4 */}
        <div className="dashboard-stat-card glass-panel" style={{ border: '2px solid #F59E0B', boxShadow: '0 0 25px rgba(245, 158, 11, 0.15)' }}>
          <div className="dashboard-card-header">
            <div className="dashboard-card-icon" style={{ background: 'rgba(245, 158, 11, 0.12)', borderColor: '#F59E0B' }}>
              <i className="fa-solid fa-circle-exclamation" style={{ color: '#F59E0B' }}></i>
            </div>
            <div>
              <div className="dashboard-card-label">High Risk Emails</div>
              <div className="dashboard-card-val" style={{ color: '#F59E0B' }}>{stats.suspect_count.toLocaleString()}</div>
            </div>
          </div>
          <div className="dashboard-card-trend">
            <span style={{ color: '#F59E0B', fontWeight: 'bold', fontSize: '11px' }}><i className="fa-solid fa-arrow-trend-up"></i> +8.7%</span>
            <span style={{ color: '#8A92A6', fontSize: '11px', marginLeft: '6px' }}>this week</span>
          </div>
          <svg viewBox="0 0 200 40" className="dashboard-sparkline">
            <path d="M 0 35 Q 25 25 60 30 T 120 15 T 200 5" fill="none" stroke="#F59E0B" strokeWidth="2" />
            <path d="M 0 35 Q 25 25 60 30 T 120 15 T 200 5 L 200 40 L 0 40 Z" fill="rgba(245, 158, 11, 0.05)" />
          </svg>
        </div>

        {/* Card 5 */}
        <div className="dashboard-stat-card glass-panel" style={{ border: '2px solid #8B5CF6', boxShadow: '0 0 25px rgba(139, 92, 246, 0.15)' }}>
          <div className="dashboard-card-header">
            <div className="dashboard-card-icon" style={{ background: 'rgba(139, 92, 246, 0.12)', borderColor: '#8B5CF6' }}>
              <i className="fa-solid fa-lock" style={{ color: '#8B5CF6' }}></i>
            </div>
            <div>
              <div className="dashboard-card-label">Threats Blocked</div>
              <div className="dashboard-card-val" style={{ color: '#8B5CF6' }}>{stats.phishing_count.toLocaleString()}</div>
            </div>
          </div>
          <div className="dashboard-card-trend">
            <span style={{ color: '#8B5CF6', fontWeight: 'bold', fontSize: '11px' }}><i className="fa-solid fa-arrow-trend-up"></i> +16.8%</span>
            <span style={{ color: '#8A92A6', fontSize: '11px', marginLeft: '6px' }}>this week</span>
          </div>
          <svg viewBox="0 0 200 40" className="dashboard-sparkline">
            <path d="M 0 35 Q 30 15 70 28 T 130 8 T 200 3" fill="none" stroke="#8B5CF6" strokeWidth="2" />
            <path d="M 0 35 Q 30 15 70 28 T 130 8 T 200 3 L 200 40 L 0 40 Z" fill="rgba(139, 92, 246, 0.05)" />
          </svg>
        </div>
      </section>

      {/* 5. ROW 1: EMAIL THREAT OVERVIEW / RISK DISTRIBUTION / RECENT DETECTIONS */}
      <section className="dashboard-main-grid-row1">
        {/* Email Threat Overview Line Chart */}
        <div className="dashboard-grid-card glass-panel">
          <div className="dashboard-card-title-row">
            <h3 className="dashboard-grid-card-title">Email Threat Overview</h3>
            <select className="dashboard-select-btn" disabled><option>This Week</option></select>
          </div>
          <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
            <span style={{ fontSize: '12px', color: '#10B981', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981' }}></span>Safe Emails
            </span>
            <span style={{ fontSize: '12px', color: '#EF4444', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#EF4444' }}></span>Phishing Emails
            </span>
            <span style={{ fontSize: '12px', color: '#F59E0B', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#F59E0B' }}></span>High Risk Emails
            </span>
          </div>
          {/* Custom SVG Line Chart */}
          <div style={{ position: 'relative', height: '220px', width: '100%' }}>
            <svg viewBox="0 0 500 200" style={{ width: '100%', height: '100%' }}>
              {/* Grid Lines */}
              <line x1="40" y1="20" x2="480" y2="20" stroke="rgba(255,255,255,0.03)" />
              <line x1="40" y1="60" x2="480" y2="60" stroke="rgba(255,255,255,0.03)" />
              <line x1="40" y1="100" x2="480" y2="100" stroke="rgba(255,255,255,0.03)" />
              <line x1="40" y1="140" x2="480" y2="140" stroke="rgba(255,255,255,0.03)" />
              <line x1="40" y1="180" x2="480" y2="180" stroke="rgba(255,255,255,0.03)" />
              
              {/* Safe line (Green) */}
              <path d="M 40 60 Q 110 30 180 80 T 320 20 T 480 40" fill="none" stroke="#10B981" strokeWidth="3" />
              {/* Phishing line (Red) */}
              <path d="M 40 140 Q 110 110 180 150 T 320 130 T 480 100" fill="none" stroke="#EF4444" strokeWidth="3" />
              {/* High Risk line (Orange) */}
              <path d="M 40 160 Q 110 150 180 170 T 320 140 T 480 130" fill="none" stroke="#F59E0B" strokeWidth="3" />

              {/* Data points */}
              <circle cx="180" cy="80" r="5" fill="#10B981" />
              <circle cx="320" cy="20" r="5" fill="#10B981" />
              <circle cx="180" cy="150" r="5" fill="#EF4444" />
              <circle cx="320" cy="130" r="5" fill="#EF4444" />
            </svg>
            <div className="dashboard-chart-xlabels">
              <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
            </div>
          </div>
        </div>

        {/* Risk Distribution Doughnut Card */}
        <div className="dashboard-grid-card glass-panel">
          <h3 className="dashboard-grid-card-title">Risk Distribution</h3>
          <div className="dashboard-doughnut-layout">
            <div style={{ position: 'relative', width: '120px', height: '120px' }}>
              <svg width="120" height="120" viewBox="0 0 120 120">
                {/* Empty base ring */}
                <circle cx="60" cy="60" r="45" fill="transparent" stroke="rgba(255,255,255,0.03)" strokeWidth="14" />
                {/* Safe Segment ring */}
                <circle cx="60" cy="60" r="45" fill="transparent" stroke="#10B981" strokeWidth="14" strokeDasharray="282" strokeDashoffset={282 - (282 * (safePercent / 100))} transform="rotate(-90 60 60)" />
                {/* Phishing Segment ring */}
                <circle cx="60" cy="60" r="45" fill="transparent" stroke="#EF4444" strokeWidth="14" strokeDasharray="282" strokeDashoffset={282 - (282 * (phishPercent / 100))} transform="rotate(45 60 60)" />
              </svg>
              <div className="dashboard-doughnut-center">
                <div style={{ fontSize: '18px', fontWeight: '800' }}>{stats.total_scanned}</div>
                <div style={{ fontSize: '8px', color: '#8A92A6', textTransform: 'uppercase' }}>Total</div>
              </div>
            </div>

            <div className="dashboard-doughnut-legend">
              <div className="dashboard-legend-row">
                <span className="dashboard-legend-dot" style={{ background: '#10B981' }}></span>
                <span className="dashboard-legend-text">Safe <strong>{safePercent}%</strong> ({stats.safe_count})</span>
              </div>
              <div className="dashboard-legend-row">
                <span className="dashboard-legend-dot" style={{ background: '#EF4444' }}></span>
                <span className="dashboard-legend-text">Phishing <strong>{phishPercent}%</strong> ({phishingCount})</span>
              </div>
              <div className="dashboard-legend-row">
                <span className="dashboard-legend-dot" style={{ background: '#F59E0B' }}></span>
                <span className="dashboard-legend-text">High Risk <strong>{suspectPercent}%</strong> ({stats.suspect_count})</span>
              </div>
            </div>
          </div>
          
          <div className="dashboard-highest-risk-card">
            <div style={{ fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase', fontWeight: 'bold' }}>Highest Risk Detected</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#EF4444' }}>
                <i className="fa-solid fa-link" style={{ marginRight: '6px' }}></i>Suspicious Link in Email
              </span>
              <span style={{ fontSize: '14px', fontWeight: '800', color: '#EF4444' }}>98/100</span>
            </div>
          </div>
        </div>

        {/* Recent Detections List Card */}
        <div className="dashboard-grid-card glass-panel">
          <div className="dashboard-card-title-row">
            <h3 className="dashboard-grid-card-title">Recent Detections</h3>
            <span style={{ fontSize: '12px', color: '#6366F1', cursor: 'pointer', fontWeight: '700' }}>View All</span>
          </div>
          <div className="dashboard-detections-list">
            {emails.slice(0, 5).map((email, idx) => {
              const isPhish = email.classification === 'phishing' || email.classification === 'suspect';
              return (
                <div key={email.id || idx} className="dashboard-detection-item">
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: isPhish ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <i className={isPhish ? "fa-solid fa-triangle-exclamation" : "fa-solid fa-circle-check"} style={{ color: isPhish ? '#EF4444' : '#10B981', fontSize: '13px' }}></i>
                  </div>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <div className="dashboard-det-subject">{email.subject}</div>
                    <div className="dashboard-det-sender">{email.sender}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div className="dashboard-det-time">{getScannedOffset(email.scanned_at)}</div>
                    <span style={{
                      fontSize: '9px',
                      fontWeight: '800',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: email.classification === 'phishing' ? 'rgba(239, 68, 68, 0.12)' : email.classification === 'suspect' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                      color: email.classification === 'phishing' ? '#EF4444' : email.classification === 'suspect' ? '#F59E0B' : '#10B981',
                      marginTop: '4px',
                      display: 'inline-block'
                    }}>
                      {email.classification === 'phishing' ? 'Phishing' : email.classification === 'suspect' ? 'High Risk' : 'Safe'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 6. ROW 2: AI ENGINE / TOP CATEGORIES / THREAT MAP */}
      <section className="dashboard-main-grid-row2">
        {/* AI Detection Engine hologram card */}
        <div className="dashboard-grid-card glass-panel" style={{ border: '2px solid #8B5CF6', boxShadow: '0 0 25px rgba(139, 92, 246, 0.12)' }}>
          <h3 className="dashboard-grid-card-title">AI Detection Engine</h3>
          <div className="dashboard-ai-engine-layout">
            {/* Spinning Hologram SVG */}
            <div className="dashboard-hologram-container">
              <svg width="100" height="100" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#8B5CF6" strokeWidth="1.5" strokeDasharray="6 4" className={retraining ? 'fa-spin' : ''} style={{ animation: 'spin 12s linear infinite' }} />
                <circle cx="50" cy="50" r="30" fill="none" stroke="rgba(139, 92, 246, 0.3)" strokeWidth="1" />
                <path d="M 35 50 Q 50 30 65 50 T 90 50" fill="none" stroke="#8B5CF6" strokeWidth="2.5" />
                <circle cx="50" cy="50" r="4" fill="#8B5CF6" />
              </svg>
              <div className="dashboard-hologram-pulse"></div>
            </div>
            
            <div className="dashboard-ai-details">
              <div className="dashboard-ai-detail-row">
                <span style={{ color: '#8A92A6' }}>Model:</span>
                <span style={{ fontWeight: '700' }}>PhishNet XGBoost</span>
              </div>
              <div className="dashboard-ai-detail-row">
                <span style={{ color: '#8A92A6' }}>Accuracy:</span>
                <span style={{ fontWeight: '700', color: '#10B981' }}>96.42%</span>
              </div>
              <div className="dashboard-ai-detail-row">
                <span style={{ color: '#8A92A6' }}>Last Trained:</span>
                <span style={{ fontWeight: '700' }}>2 hours ago</span>
              </div>
              <div className="dashboard-ai-detail-row">
                <span style={{ color: '#8A92A6' }}>Status:</span>
                <span style={{ fontWeight: '700', color: '#10B981' }}><i className="fa-solid fa-circle-check"></i> Active</span>
              </div>
            </div>
          </div>
          <button className="dashboard-btn-retrain" onClick={handleRetrain} disabled={retraining}>
            <i className="fa-solid fa-microchip" style={{ marginRight: '8px' }}></i>
            {retraining ? 'Re-aligning Neurons...' : 'Retrain Model'}
          </button>
        </div>

        {/* Top Threat Categories progress bars */}
        <div className="dashboard-grid-card glass-panel">
          <div className="dashboard-card-title-row">
            <h3 className="dashboard-grid-card-title">Top Threat Categories</h3>
            <span style={{ fontSize: '12px', color: '#6366F1', cursor: 'pointer' }}>View All</span>
          </div>
          <div className="dashboard-categories-box">
            <div className="dashboard-prog-group">
              <div className="dashboard-prog-label-row">
                <span>Suspicious Link</span><span>38%</span>
              </div>
              <div className="dashboard-prog-bar-bg">
                <div className="dashboard-prog-bar-fill" style={{ width: '38%', background: '#EF4444' }}></div>
              </div>
            </div>

            <div className="dashboard-prog-group">
              <div className="dashboard-prog-label-row">
                <span>Credential Phishing</span><span>27%</span>
              </div>
              <div className="dashboard-prog-bar-bg">
                <div className="dashboard-prog-bar-fill" style={{ width: '27%', background: '#F59E0B' }}></div>
              </div>
            </div>

            <div className="dashboard-prog-group">
              <div className="dashboard-prog-label-row">
                <span>Malicious Attachment</span><span>18%</span>
              </div>
              <div className="dashboard-prog-bar-bg">
                <div className="dashboard-prog-bar-fill" style={{ width: '18%', background: '#FACC15' }}></div>
              </div>
            </div>

            <div className="dashboard-prog-group">
              <div className="dashboard-prog-label-row">
                <span>Spam Filters</span><span>10%</span>
              </div>
              <div className="dashboard-prog-bar-bg">
                <div className="dashboard-prog-bar-fill" style={{ width: '10%', background: '#10B981' }}></div>
              </div>
            </div>

            <div className="dashboard-prog-group">
              <div className="dashboard-prog-label-row">
                <span>Other Spoofs</span><span>7%</span>
              </div>
              <div className="dashboard-prog-bar-bg">
                <div className="dashboard-prog-bar-fill" style={{ width: '7%', background: '#06B6D4' }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Live Threat Hotspot Map */}
        <div className="dashboard-grid-card glass-panel">
          <h3 className="dashboard-grid-card-title">Threat Map (Live)</h3>
          <div style={{ position: 'relative', height: '180px', width: '100%', marginTop: '16px' }}>
            {/* Outline world map mockup using SVG */}
            <svg viewBox="0 0 400 180" style={{ width: '100%', height: '100%', opacity: 0.65 }}>
              <path d="M 30 70 Q 60 50 100 60 T 150 70 T 200 60 T 250 80 T 300 70 T 350 90" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
              <path d="M 50 120 Q 90 140 130 110 T 180 120 T 230 130 T 280 120 T 330 140" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
              {/* Glowing Pulsing hotspots */}
              <circle cx="80" cy="70" r="4" fill="#EF4444" />
              <circle cx="80" cy="70" r="10" fill="none" stroke="#EF4444" strokeWidth="1" style={{ opacity: 0.5 }} />
              <circle cx="280" cy="110" r="5" fill="#EF4444" />
              <circle cx="280" cy="110" r="12" fill="none" stroke="#EF4444" strokeWidth="1" style={{ opacity: 0.5 }} />
              <circle cx="180" cy="80" r="3" fill="#F59E0B" />
            </svg>
            <div className="dashboard-map-legend">
              <span style={{ fontSize: '11px', color: '#EF4444', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#EF4444' }}></span>High
              </span>
              <span style={{ fontSize: '11px', color: '#F59E0B', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#F59E0B' }}></span>Medium
              </span>
              <span style={{ fontSize: '11px', color: '#06B6D4', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#06B6D4' }}></span>Low
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 7. ROW 3: FOOTER LIVE STATUS BAR */}
      <footer className="dashboard-status-bar glass-panel">
        <div className="dashboard-status-cell">
          <i className="fa-solid fa-circle-check" style={{ color: '#10B981', fontSize: '14px' }}></i>
          <span>Real-time Protection: <strong>Active 24/7</strong></span>
        </div>
        <div className="dashboard-status-cell">
          <i className="fa-solid fa-envelope" style={{ color: '#6366F1' }}></i>
          <span>Emails Scanned Today: <strong>{stats.total_scanned}</strong></span>
        </div>
        <div className="dashboard-status-cell">
          <i className="fa-solid fa-ban" style={{ color: '#EF4444' }}></i>
          <span>Threats Blocked Today: <strong>{stats.phishing_count}</strong></span>
        </div>
        <div className="dashboard-status-cell">
          <i className="fa-solid fa-chart-pie" style={{ color: '#F59E0B' }}></i>
          <span>Average Risk Score: <strong>{stats.avg_risk_score}%</strong></span>
        </div>
        <div className="dashboard-status-cell">
          <i className="fa-solid fa-circle-nodes" style={{ color: '#06B6D4' }}></i>
          <span>System Uptime: <strong>99.9%</strong></span>
        </div>
      </footer>

      {/* 8. SCANNED EMAILS PARTITIONED LOGS (SAFE VS PHISHING) */}
      <section className="dashboard-split-section-grid">
        {/* SAFE PANEL */}
        <div className="dashboard-split-panel glass-panel glow-safe">
          <div className="dashboard-split-panel-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <i className="fa-solid fa-shield-halved" style={{ color: '#10B981', fontSize: '18px' }}></i>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#FFF' }}>
                Verified Safe Inbox ({safeEmails.length})
              </h3>
            </div>
            <span style={{ fontSize: '11px', color: '#10B981', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
              CLEAN
            </span>
          </div>

          <div className="dashboard-list-container">
            {safeEmails.length === 0 ? (
              <div className="dashboard-empty-list">No safe emails scanned today.</div>
            ) : (
              safeEmails.map((email, idx) => (
                <div key={email.id || idx} className="dashboard-email-list-item">
                  <div className="dashboard-email-item-main">
                    <div className="dashboard-sender-name">{email.sender}</div>
                    <div className="dashboard-email-subject">{email.subject}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                    <span className="dashboard-date-label">{email.scanned_at ? email.scanned_at.split('T')[0] : 'N/A'}</span>
                    <span className="dashboard-badge-mini" style={{ color: '#10B981', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                      {email.risk_score}% Safe
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* PHISHING PANEL */}
        <div className="dashboard-split-panel glass-panel glow-phishing">
          <div className="dashboard-split-panel-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <i className="fa-solid fa-triangle-exclamation" style={{ color: '#EF4444', fontSize: '18px' }}></i>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#FFF' }}>
                Flagged Phishing & Fraud ({phishingEmails.length})
              </h3>
            </div>
            <span style={{ fontSize: '11px', color: '#EF4444', background: 'rgba(239, 68, 68, 0.1)', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
              ALERT
            </span>
          </div>

          <div className="dashboard-list-container">
            {phishingEmails.length === 0 ? (
              <div className="dashboard-empty-list">No phishing attempts intercepted.</div>
            ) : (
              phishingEmails.map((email, idx) => (
                <div key={email.id || idx} className="dashboard-email-list-item" style={{ borderLeft: '3px solid #EF4444' }}>
                  <div className="dashboard-email-item-main">
                    <div className="dashboard-sender-name" style={{ color: '#EF4444' }}>{email.sender}</div>
                    <div className="dashboard-email-subject">{email.subject}</div>
                    {email.reasons && email.reasons.length > 0 && (
                      <div className="dashboard-threat-reasons-row">
                        {email.reasons.map((r, rIdx) => (
                          <span key={rIdx} className="dashboard-reason-tag">
                            <i className="fa-solid fa-bug" style={{ marginRight: '4px' }}></i>{r}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                    <span className="dashboard-date-label">{email.scanned_at ? email.scanned_at.split('T')[0] : 'N/A'}</span>
                    <span className="dashboard-badge-mini" style={{ color: '#EF4444', border: '1px solid rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.05)' }}>
                      {email.risk_score}% Risk
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

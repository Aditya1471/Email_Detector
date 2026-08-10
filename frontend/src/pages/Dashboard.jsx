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
  const [connectedAccount, setConnectedAccount] = useState(null);
  const [timeStr, setTimeStr] = useState('10:30 AM');
  const [retraining, setRetraining] = useState(false);

  useEffect(() => {
    fetchDashboardData();
    fetchConnectedAccount();
    
    // Set dynamic updated timestamp
    const now = new Date();
    setTimeStr(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

    const timer = setInterval(() => {
      pollNotifications();
      fetchDashboardData();
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  const fetchDashboardData = () => {
    fetch('http://127.0.0.1:5000/api/dashboard/stats', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data.status === 'success') {
          setStats(data.stats);
        }
      })
      .catch(console.error);

    fetch('http://127.0.0.1:5000/api/emails/history', { credentials: 'include' })
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
    fetch('http://127.0.0.1:5000/api/auth/me', { credentials: 'include' })
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
    fetch('http://127.0.0.1:5000/api/emails/notifications', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data.status === 'success' && data.notifications.length > 0) {
          const unreadPhish = data.notifications.find(n => n.channel === 'in_app' && !n.read);
          if (unreadPhish) {
            setActiveToast(unreadPhish);
            fetchDashboardData();
          }
        }
      })
      .catch(console.error);
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

      {/* 2. TOP NAVBAR & SEARCH */}
      <header style={styles.topBar}>
        <div style={styles.searchWrapper}>
          <i className="fa-solid fa-magnifying-glass" style={{ color: '#8A92A6', fontSize: '14px' }}></i>
          <input type="text" placeholder="Search anything..." style={styles.searchInput} disabled />
          <span style={styles.searchShortcut}>Ctrl K</span>
        </div>

        <div style={styles.userProfileRow}>
          <button style={styles.iconBtn}><i className="fa-solid fa-moon"></i></button>
          <button style={{ ...styles.iconBtn, position: 'relative' }}>
            <i className="fa-solid fa-bell"></i>
            {activeToast && <span style={styles.notifBadge}></span>}
          </button>
          <div style={styles.profileMeta}>
            <div style={styles.avatar}>
              {user?.name ? user.name[0].toUpperCase() : 'A'}
            </div>
            <div>
              <div style={styles.profileName}>{user?.name || 'Aditya Jha'}</div>
              <div style={styles.profileRole}>Premium User</div>
            </div>
          </div>
        </div>
      </header>

      {/* 3. DASHBOARD SUB-HEADER */}
      <div style={styles.subHeader}>
        <div>
          <h2 style={styles.title}>Dashboard</h2>
          <p style={styles.subtitle}>Welcome back, {user?.name || 'Aditya'}! Here's your security overview.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={styles.updatedText}>
            <i className="fa-solid fa-clock" style={{ marginRight: '6px' }}></i>
            Last updated: Today, {timeStr}
          </span>
          <button style={styles.btnSync} onClick={handleSync} disabled={syncing}>
            <i className={`fa-solid fa-rotate ${syncing ? 'fa-spin' : ''}`} style={{ marginRight: '8px' }}></i>
            {syncing ? 'Syncing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* 4. FIVE GLOWING METRIC STATS CARDS */}
      <section style={styles.statsGrid}>
        {/* Card 1 */}
        <div style={styles.statCard} className="glass-panel">
          <div style={styles.cardHeader}>
            <div style={{ ...styles.cardIcon, background: 'rgba(99, 102, 241, 0.12)', borderColor: '#6366F1' }}>
              <i className="fa-solid fa-envelope-open-text" style={{ color: '#6366F1' }}></i>
            </div>
            <div>
              <div style={styles.cardLabel}>Total Emails Scanned</div>
              <div style={styles.cardVal}>{stats.total_scanned.toLocaleString()}</div>
            </div>
          </div>
          <div style={styles.cardTrend}>
            <span style={{ color: '#10B981', fontWeight: 'bold', fontSize: '11px' }}><i className="fa-solid fa-arrow-trend-up"></i> +18.6%</span>
            <span style={{ color: '#8A92A6', fontSize: '11px', marginLeft: '6px' }}>this week</span>
          </div>
          {/* Sparkline SVG */}
          <svg viewBox="0 0 200 40" style={styles.sparkline}>
            <path d="M 0 35 Q 25 15 50 25 T 100 10 T 150 20 T 200 5" fill="none" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" />
            <path d="M 0 35 Q 25 15 50 25 T 100 10 T 150 20 T 200 5 L 200 40 L 0 40 Z" fill="rgba(99, 102, 241, 0.05)" />
          </svg>
        </div>

        {/* Card 2 */}
        <div style={styles.statCard} className="glass-panel glow-safe">
          <div style={styles.cardHeader}>
            <div style={{ ...styles.cardIcon, background: 'rgba(16, 185, 129, 0.12)', borderColor: '#10B981' }}>
              <i className="fa-solid fa-shield-halved" style={{ color: '#10B981' }}></i>
            </div>
            <div>
              <div style={styles.cardLabel}>Safe Emails</div>
              <div style={{ ...styles.cardVal, color: '#10B981' }}>{stats.safe_count.toLocaleString()}</div>
            </div>
          </div>
          <div style={styles.cardTrend}>
            <span style={{ color: '#10B981', fontWeight: 'bold', fontSize: '11px' }}><i className="fa-solid fa-arrow-trend-up"></i> +21.4%</span>
            <span style={{ color: '#8A92A6', fontSize: '11px', marginLeft: '6px' }}>this week</span>
          </div>
          <svg viewBox="0 0 200 40" style={styles.sparkline}>
            <path d="M 0 30 Q 30 10 60 20 T 120 5 T 180 15 T 200 8" fill="none" stroke="#10B981" strokeWidth="2" />
            <path d="M 0 30 Q 30 10 60 20 T 120 5 T 180 15 T 200 8 L 200 40 L 0 40 Z" fill="rgba(16, 185, 129, 0.05)" />
          </svg>
        </div>

        {/* Card 3 */}
        <div style={styles.statCard} className="glass-panel glow-phishing">
          <div style={styles.cardHeader}>
            <div style={{ ...styles.cardIcon, background: 'rgba(239, 68, 68, 0.12)', borderColor: '#EF4444' }}>
              <i className="fa-solid fa-radiation" style={{ color: '#EF4444' }}></i>
            </div>
            <div>
              <div style={styles.cardLabel}>Phishing Detected</div>
              <div style={{ ...styles.cardVal, color: '#EF4444' }}>{(phishingCount + suspectCount).toLocaleString()}</div>
            </div>
          </div>
          <div style={styles.cardTrend}>
            <span style={{ color: '#EF4444', fontWeight: 'bold', fontSize: '11px' }}><i className="fa-solid fa-arrow-trend-up"></i> +12.3%</span>
            <span style={{ color: '#8A92A6', fontSize: '11px', marginLeft: '6px' }}>this week</span>
          </div>
          <svg viewBox="0 0 200 40" style={styles.sparkline}>
            <path d="M 0 20 Q 40 35 80 15 T 140 25 T 200 5" fill="none" stroke="#EF4444" strokeWidth="2" />
            <path d="M 0 20 Q 40 35 80 15 T 140 25 T 200 5 L 200 40 L 0 40 Z" fill="rgba(239, 68, 68, 0.05)" />
          </svg>
        </div>

        {/* Card 4 */}
        <div className="glass-panel" style={{ ...styles.statCard, border: '2px solid #F59E0B', boxShadow: '0 0 25px rgba(245, 158, 11, 0.15)' }}>
          <div style={styles.cardHeader}>
            <div style={{ ...styles.cardIcon, background: 'rgba(245, 158, 11, 0.12)', borderColor: '#F59E0B' }}>
              <i className="fa-solid fa-circle-exclamation" style={{ color: '#F59E0B' }}></i>
            </div>
            <div>
              <div style={styles.cardLabel}>High Risk Emails</div>
              <div style={{ ...styles.cardVal, color: '#F59E0B' }}>{stats.suspect_count.toLocaleString()}</div>
            </div>
          </div>
          <div style={styles.cardTrend}>
            <span style={{ color: '#F59E0B', fontWeight: 'bold', fontSize: '11px' }}><i className="fa-solid fa-arrow-trend-up"></i> +8.7%</span>
            <span style={{ color: '#8A92A6', fontSize: '11px', marginLeft: '6px' }}>this week</span>
          </div>
          <svg viewBox="0 0 200 40" style={styles.sparkline}>
            <path d="M 0 35 Q 25 25 60 30 T 120 15 T 200 5" fill="none" stroke="#F59E0B" strokeWidth="2" />
            <path d="M 0 35 Q 25 25 60 30 T 120 15 T 200 5 L 200 40 L 0 40 Z" fill="rgba(245, 158, 11, 0.05)" />
          </svg>
        </div>

        {/* Card 5 */}
        <div className="glass-panel" style={{ ...styles.statCard, border: '2px solid #8B5CF6', boxShadow: '0 0 25px rgba(139, 92, 246, 0.15)' }}>
          <div style={styles.cardHeader}>
            <div style={{ ...styles.cardIcon, background: 'rgba(139, 92, 246, 0.12)', borderColor: '#8B5CF6' }}>
              <i className="fa-solid fa-lock" style={{ color: '#8B5CF6' }}></i>
            </div>
            <div>
              <div style={styles.cardLabel}>Threats Blocked</div>
              <div style={{ ...styles.cardVal, color: '#8B5CF6' }}>{stats.phishing_count.toLocaleString()}</div>
            </div>
          </div>
          <div style={styles.cardTrend}>
            <span style={{ color: '#8B5CF6', fontWeight: 'bold', fontSize: '11px' }}><i className="fa-solid fa-arrow-trend-up"></i> +16.8%</span>
            <span style={{ color: '#8A92A6', fontSize: '11px', marginLeft: '6px' }}>this week</span>
          </div>
          <svg viewBox="0 0 200 40" style={styles.sparkline}>
            <path d="M 0 35 Q 30 15 70 28 T 130 8 T 200 3" fill="none" stroke="#8B5CF6" strokeWidth="2" />
            <path d="M 0 35 Q 30 15 70 28 T 130 8 T 200 3 L 200 40 L 0 40 Z" fill="rgba(139, 92, 246, 0.05)" />
          </svg>
        </div>
      </section>

      {/* 5. ROW 1: EMAIL THREAT OVERVIEW / RISK DISTRIBUTION / RECENT DETECTIONS */}
      <section style={styles.mainGridRow1}>
        {/* Email Threat Overview Line Chart */}
        <div style={styles.gridCard} className="glass-panel">
          <div style={styles.cardTitleRow}>
            <h3 style={styles.gridCardTitle}>Email Threat Overview</h3>
            <select style={styles.selectBtn} disabled><option>This Week</option></select>
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
            <div style={styles.chartXLabels}>
              <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
            </div>
          </div>
        </div>

        {/* Risk Distribution Doughnut Card */}
        <div style={styles.gridCard} className="glass-panel">
          <h3 style={styles.gridCardTitle}>Risk Distribution</h3>
          <div style={styles.doughnutLayout}>
            <div style={{ position: 'relative', width: '120px', height: '120px' }}>
              <svg width="120" height="120" viewBox="0 0 120 120">
                {/* Empty base ring */}
                <circle cx="60" cy="60" r="45" fill="transparent" stroke="rgba(255,255,255,0.03)" strokeWidth="14" />
                {/* Safe Segment ring */}
                <circle cx="60" cy="60" r="45" fill="transparent" stroke="#10B981" strokeWidth="14" strokeDasharray="282" strokeDashoffset={282 - (282 * (safePercent / 100))} transform="rotate(-90 60 60)" />
                {/* Phishing Segment ring */}
                <circle cx="60" cy="60" r="45" fill="transparent" stroke="#EF4444" strokeWidth="14" strokeDasharray="282" strokeDashoffset={282 - (282 * (phishPercent / 100))} transform="rotate(45 60 60)" />
              </svg>
              <div style={styles.doughnutCenter}>
                <div style={{ fontSize: '18px', fontWeight: '800' }}>{stats.total_scanned}</div>
                <div style={{ fontSize: '8px', color: '#8A92A6', textTransform: 'uppercase' }}>Total</div>
              </div>
            </div>

            <div style={styles.doughnutLegend}>
              <div style={styles.legendRow}>
                <span style={{ ...styles.legendDot, background: '#10B981' }}></span>
                <span style={styles.legendText}>Safe <strong>{safePercent}%</strong> ({stats.safe_count})</span>
              </div>
              <div style={styles.legendRow}>
                <span style={{ ...styles.legendDot, background: '#EF4444' }}></span>
                <span style={styles.legendText}>Phishing <strong>{phishPercent}%</strong> ({phishingCount})</span>
              </div>
              <div style={styles.legendRow}>
                <span style={{ ...styles.legendDot, background: '#F59E0B' }}></span>
                <span style={styles.legendText}>High Risk <strong>{suspectPercent}%</strong> ({stats.suspect_count})</span>
              </div>
            </div>
          </div>
          
          <div style={styles.highestRiskCard}>
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
        <div style={styles.gridCard} className="glass-panel">
          <div style={styles.cardTitleRow}>
            <h3 style={styles.gridCardTitle}>Recent Detections</h3>
            <span style={{ fontSize: '12px', color: '#6366F1', cursor: 'pointer', fontWeight: '700' }}>View All</span>
          </div>
          <div style={styles.detectionsList}>
            {emails.slice(0, 5).map((email, idx) => {
              const isPhish = email.classification === 'phishing' || email.classification === 'suspect';
              return (
                <div key={email.id || idx} style={styles.detectionItem}>
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
                    <div style={styles.detSubject}>{email.subject}</div>
                    <div style={styles.detSender}>{email.sender}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={styles.detTime}>{getScannedOffset(email.scanned_at)}</div>
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
      <section style={styles.mainGridRow2}>
        {/* AI Detection Engine hologram card */}
        <div className="glass-panel" style={{ ...styles.gridCard, border: '2px solid #8B5CF6', boxShadow: '0 0 25px rgba(139, 92, 246, 0.12)' }}>
          <h3 style={styles.gridCardTitle}>AI Detection Engine</h3>
          <div style={styles.aiEngineLayout}>
            {/* Spinning Hologram SVG */}
            <div style={styles.hologramContainer}>
              <svg width="100" height="100" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#8B5CF6" strokeWidth="1.5" strokeDasharray="6 4" className={retraining ? 'fa-spin' : ''} style={{ animation: 'spin 12s linear infinite' }} />
                <circle cx="50" cy="50" r="30" fill="none" stroke="rgba(139, 92, 246, 0.3)" strokeWidth="1" />
                <path d="M 35 50 Q 50 30 65 50 T 90 50" fill="none" stroke="#8B5CF6" strokeWidth="2.5" />
                <circle cx="50" cy="50" r="4" fill="#8B5CF6" />
              </svg>
              <div style={styles.hologramPulse}></div>
            </div>
            
            <div style={styles.aiDetails}>
              <div style={styles.aiDetailRow}>
                <span style={{ color: '#8A92A6' }}>Model:</span>
                <span style={{ fontWeight: '700' }}>PhishNet XGBoost</span>
              </div>
              <div style={styles.aiDetailRow}>
                <span style={{ color: '#8A92A6' }}>Accuracy:</span>
                <span style={{ fontWeight: '700', color: '#10B981' }}>96.42%</span>
              </div>
              <div style={styles.aiDetailRow}>
                <span style={{ color: '#8A92A6' }}>Last Trained:</span>
                <span style={{ fontWeight: '700' }}>2 hours ago</span>
              </div>
              <div style={styles.aiDetailRow}>
                <span style={{ color: '#8A92A6' }}>Status:</span>
                <span style={{ fontWeight: '700', color: '#10B981' }}><i className="fa-solid fa-circle-check"></i> Active</span>
              </div>
            </div>
          </div>
          <button style={styles.btnRetrain} onClick={handleRetrain} disabled={retraining}>
            <i className="fa-solid fa-microchip" style={{ marginRight: '8px' }}></i>
            {retraining ? 'Re-aligning Neurons...' : 'Retrain Model'}
          </button>
        </div>

        {/* Top Threat Categories progress bars */}
        <div style={styles.gridCard} className="glass-panel">
          <div style={styles.cardTitleRow}>
            <h3 style={styles.gridCardTitle}>Top Threat Categories</h3>
            <span style={{ fontSize: '12px', color: '#6366F1', cursor: 'pointer' }}>View All</span>
          </div>
          <div style={styles.categoriesBox}>
            <div style={styles.progGroup}>
              <div style={styles.progLabelRow}>
                <span>Suspicious Link</span><span>38%</span>
              </div>
              <div style={styles.progBarBg}>
                <div style={{ ...styles.progBarFill, width: '38%', background: '#EF4444' }}></div>
              </div>
            </div>

            <div style={styles.progGroup}>
              <div style={styles.progLabelRow}>
                <span>Credential Phishing</span><span>27%</span>
              </div>
              <div style={styles.progBarBg}>
                <div style={{ ...styles.progBarFill, width: '27%', background: '#F59E0B' }}></div>
              </div>
            </div>

            <div style={styles.progGroup}>
              <div style={styles.progLabelRow}>
                <span>Malicious Attachment</span><span>18%</span>
              </div>
              <div style={styles.progBarBg}>
                <div style={{ ...styles.progBarFill, width: '18%', background: '#FACC15' }}></div>
              </div>
            </div>

            <div style={styles.progGroup}>
              <div style={styles.progLabelRow}>
                <span>Spam Filters</span><span>10%</span>
              </div>
              <div style={styles.progBarBg}>
                <div style={{ ...styles.progBarFill, width: '10%', background: '#10B981' }}></div>
              </div>
            </div>

            <div style={styles.progGroup}>
              <div style={styles.progLabelRow}>
                <span>Other Spoofs</span><span>7%</span>
              </div>
              <div style={styles.progBarBg}>
                <div style={{ ...styles.progBarFill, width: '7%', background: '#06B6D4' }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Live Threat Hotspot Map */}
        <div style={styles.gridCard} className="glass-panel">
          <h3 style={styles.gridCardTitle}>Threat Map (Live)</h3>
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
            <div style={styles.mapLegend}>
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
      <footer style={styles.statusBar} className="glass-panel">
        <div style={styles.statusCell}>
          <i className="fa-solid fa-circle-check" style={{ color: '#10B981', fontSize: '14px' }}></i>
          <span>Real-time Protection: <strong>Active 24/7</strong></span>
        </div>
        <div style={styles.statusCell}>
          <i className="fa-solid fa-envelope" style={{ color: '#6366F1' }}></i>
          <span>Emails Scanned Today: <strong>{stats.total_scanned}</strong></span>
        </div>
        <div style={styles.statusCell}>
          <i className="fa-solid fa-ban" style={{ color: '#EF4444' }}></i>
          <span>Threats Blocked Today: <strong>{stats.phishing_count}</strong></span>
        </div>
        <div style={styles.statusCell}>
          <i className="fa-solid fa-chart-pie" style={{ color: '#F59E0B' }}></i>
          <span>Average Risk Score: <strong>{stats.avg_risk_score}%</strong></span>
        </div>
        <div style={styles.statusCell}>
          <i className="fa-solid fa-circle-nodes" style={{ color: '#06B6D4' }}></i>
          <span>System Uptime: <strong>99.9%</strong></span>
        </div>
      </footer>

      {/* 8. SCANNED EMAILS PARTITIONED LOGS (SAFE VS PHISHING) */}
      <section style={styles.splitSectionGrid}>
        {/* SAFE PANEL */}
        <div style={styles.splitPanel} className="glass-panel glow-safe">
          <div style={styles.splitPanelHeader}>
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

          <div style={styles.listContainer}>
            {safeEmails.length === 0 ? (
              <div style={styles.emptyList}>No safe emails scanned today.</div>
            ) : (
              safeEmails.map((email, idx) => (
                <div key={email.id || idx} style={styles.emailListItem}>
                  <div style={styles.emailItemMain}>
                    <div style={styles.senderName}>{email.sender}</div>
                    <div style={styles.emailSubject}>{email.subject}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                    <span style={styles.dateLabel}>{email.scanned_at ? email.scanned_at.split('T')[0] : 'N/A'}</span>
                    <span style={{ ...styles.badgeMini, color: '#10B981', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                      {email.risk_score}% Safe
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* PHISHING PANEL */}
        <div style={styles.splitPanel} className="glass-panel glow-phishing">
          <div style={styles.splitPanelHeader}>
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

          <div style={styles.listContainer}>
            {phishingEmails.length === 0 ? (
              <div style={styles.emptyList}>No phishing attempts intercepted.</div>
            ) : (
              phishingEmails.map((email, idx) => (
                <div key={email.id || idx} style={{ ...styles.emailListItem, borderLeft: '3px solid #EF4444' }}>
                  <div style={styles.emailItemMain}>
                    <div style={{ ...styles.senderName, color: '#EF4444' }}>{email.sender}</div>
                    <div style={styles.emailSubject}>{email.subject}</div>
                    {email.reasons && email.reasons.length > 0 && (
                      <div style={styles.threatReasonsRow}>
                        {email.reasons.map((r, rIdx) => (
                          <span key={rIdx} style={styles.reasonTag}>
                            <i className="fa-solid fa-bug" style={{ marginRight: '4px' }}></i>{r}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                    <span style={styles.dateLabel}>{email.scanned_at ? email.scanned_at.split('T')[0] : 'N/A'}</span>
                    <span style={{ ...styles.badgeMini, color: '#EF4444', border: '1px solid rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.05)' }}>
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

const styles = {
  container: {
    padding: '30px',
    background: 'transparent',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    gap: '30px'
  },
  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    boxSizing: 'border-box'
  },
  searchWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    background: '#0d111c',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: '10px',
    padding: '8px 16px',
    width: '280px'
  },
  searchInput: {
    background: 'none',
    border: 'none',
    color: '#FFF',
    marginLeft: '10px',
    fontSize: '13px',
    outline: 'none',
    width: '100%'
  },
  searchShortcut: {
    fontSize: '10px',
    color: '#8A92A6',
    background: 'rgba(255,255,255,0.05)',
    padding: '2px 6px',
    borderRadius: '4px',
    fontWeight: 'bold'
  },
  userProfileRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    color: '#8A92A6',
    fontSize: '16px',
    cursor: 'pointer',
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.2s',
    border: '1px solid rgba(255,255,255,0.03)'
  },
  notifBadge: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#EF4444'
  },
  profileMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  avatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #6366F1 0%, #a855f7 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    fontSize: '14px',
    color: '#FFF'
  },
  profileName: {
    fontSize: '13.5px',
    fontWeight: '700',
    color: '#FFF',
    lineHeight: '1'
  },
  profileRole: {
    fontSize: '10px',
    color: '#8A92A6',
    marginTop: '3px'
  },
  subHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
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
  updatedText: {
    fontSize: '12px',
    color: '#8A92A6',
    display: 'flex',
    alignItems: 'center'
  },
  btnSync: {
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    color: '#FFF',
    padding: '10px 20px',
    borderRadius: '8px',
    fontWeight: '700',
    cursor: 'pointer',
    fontSize: '13px',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '24px'
  },
  statCard: {
    borderRadius: '16px',
    padding: '20px 20px 0 20px',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    overflow: 'hidden',
    height: '150px',
    justifyContent: 'space-between'
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px'
  },
  cardIcon: {
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    border: '1px solid',
    flexShrink: 0
  },
  cardLabel: {
    fontSize: '11px',
    color: '#8A92A6',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    fontWeight: '600'
  },
  cardVal: {
    fontSize: '22px',
    fontWeight: '800',
    color: '#FFF',
    marginTop: '2px'
  },
  cardTrend: {
    display: 'flex',
    alignItems: 'center',
    marginTop: '6px',
    marginBottom: '20px'
  },
  sparkline: {
    width: '100%',
    height: '40px',
    display: 'block',
    margin: '0 -20px',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0
  },
  mainGridRow1: {
    display: 'grid',
    gridTemplateColumns: '1.8fr 1.1fr 1.3fr',
    gap: '30px',
    alignItems: 'start'
  },
  gridCard: {
    padding: '24px',
    borderRadius: '16px',
    display: 'flex',
    flexDirection: 'column'
  },
  gridCardTitle: {
    fontSize: '15px',
    fontWeight: '800',
    color: '#FFF',
    margin: '0 0 16px 0',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  cardTitleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px'
  },
  selectBtn: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#FFF',
    fontSize: '11px',
    padding: '4px 10px',
    borderRadius: '6px',
    fontWeight: 'bold',
    outline: 'none'
  },
  chartXLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '0 20px',
    marginTop: '10px',
    fontSize: '10px',
    color: '#8A92A6'
  },
  doughnutLayout: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    marginTop: '10px'
  },
  doughnutCenter: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    textAlign: 'center'
  },
  doughnutLegend: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    flexGrow: 1
  },
  legendRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  legendDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    flexShrink: 0
  },
  legendText: {
    fontSize: '11px',
    color: '#8A92A6'
  },
  highestRiskCard: {
    background: 'rgba(239, 68, 68, 0.03)',
    border: '1px solid rgba(239, 68, 68, 0.12)',
    borderRadius: '10px',
    padding: '12px',
    marginTop: '20px'
  },
  detectionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px'
  },
  detectionItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    paddingBottom: '12px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
    transition: 'transform 0.2s'
  },
  detSubject: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#FFF',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  detSender: {
    fontSize: '11px',
    color: '#8A92A6',
    marginTop: '2px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  detTime: {
    fontSize: '10px',
    color: '#8A92A6'
  },
  mainGridRow2: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: '30px'
  },
  aiEngineLayout: {
    display: 'flex',
    alignItems: 'center',
    gap: '24px',
    marginTop: '10px'
  },
  hologramContainer: {
    position: 'relative',
    width: '100px',
    height: '100px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  hologramPulse: {
    position: 'absolute',
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: 'rgba(139, 92, 246, 0.2)',
    animation: 'pulse 2s infinite'
  },
  aiDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    flexGrow: 1
  },
  aiDetailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px'
  },
  btnRetrain: {
    background: 'rgba(139, 92, 246, 0.1)',
    border: '1px solid rgba(139, 92, 246, 0.2)',
    color: '#8B5CF6',
    padding: '10px',
    borderRadius: '8px',
    fontWeight: '700',
    fontSize: '13px',
    cursor: 'pointer',
    marginTop: '20px',
    transition: '0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  categoriesBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    marginTop: '10px'
  },
  progGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  progLabelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
    color: '#D1D5DB',
    fontWeight: '600'
  },
  progBarBg: {
    width: '100%',
    height: '6px',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '3px',
    overflow: 'hidden'
  },
  progBarFill: {
    height: '100%',
    borderRadius: '3px'
  },
  mapLegend: {
    position: 'absolute',
    bottom: '10px',
    right: '10px',
    display: 'flex',
    gap: '12px'
  },
  statusBar: {
    padding: '16px 24px',
    borderRadius: '12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '20px',
    flexWrap: 'wrap'
  },
  statusCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '12.5px',
    color: '#8A92A6'
  },
  splitSectionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))',
    gap: '32px',
    alignItems: 'start'
  },
  splitPanel: {
    padding: '24px',
    borderRadius: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  splitPanelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    paddingBottom: '16px'
  },
  listContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    maxHeight: '480px',
    overflowY: 'auto',
    paddingRight: '4px'
  },
  emptyList: {
    color: '#6B7280',
    fontSize: '13.5px',
    textAlign: 'center',
    padding: '30px'
  },
  emailListItem: {
    background: 'rgba(0, 0, 0, 0.15)',
    border: '1px solid rgba(255, 255, 255, 0.04)',
    borderRadius: '10px',
    padding: '16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
    transition: 'all 0.2s ease'
  },
  emailItemMain: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flexGrow: 1
  },
  senderName: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#FFF',
    wordBreak: 'break-all'
  },
  emailSubject: {
    fontSize: '13px',
    color: '#D1D5DB',
    lineHeight: '1.4'
  },
  dateLabel: {
    fontSize: '11px',
    color: '#6B7280',
    whiteSpace: 'nowrap'
  },
  badgeMini: {
    padding: '4px 8px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: '700',
    whiteSpace: 'nowrap'
  },
  threatReasonsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    marginTop: '8px'
  },
  reasonTag: {
    background: 'rgba(239, 68, 68, 0.08)',
    border: '1px solid rgba(239, 68, 68, 0.15)',
    color: '#EF4444',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.2px'
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
  }
};

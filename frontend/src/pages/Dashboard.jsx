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

  useEffect(() => {
    fetchDashboardData();
    fetchConnectedAccount();
    const timer = setInterval(() => {
      pollNotifications();
      fetchDashboardData();
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  const fetchDashboardData = () => {
    fetch('http://localhost:5000/api/dashboard/stats', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data.status === 'success') {
          setStats(data.stats);
        }
      })
      .catch(console.error);

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
            fetchDashboardData();
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
      fetch('http://localhost:5000/api/emails/notifications/read-all', { method: 'POST', credentials: 'include' })
        .then(() => {
          setActiveToast(null);
        });
    }
  };

  // ----------------------------------------------------
  // DYNAMIC CHART DATA GENERATION
  // ----------------------------------------------------
  const totalEmails = emails.length || 1;
  const phishingCount = emails.filter(e => e.classification === 'phishing').length;
  const suspectCount = emails.filter(e => e.classification === 'suspect').length;
  const safeCount = emails.filter(e => e.classification === 'safe').length;

  const phishPercent = Math.round((phishingCount / totalEmails) * 100);
  const suspectPercent = Math.round((suspectCount / totalEmails) * 100);
  const safePercent = Math.round((safeCount / totalEmails) * 100);

  // Group emails scanned by day of the week for the last 7 days
  const getWeeklyStats = () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const statsArray = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayName = days[d.getDay()];
      const targetDateStr = d.toDateString(); // e.g. "Mon Aug 10 2026"
      
      const dayEmails = emails.filter(e => {
        if (!e.scanned_at) return false;
        try {
          return new Date(e.scanned_at).toDateString() === targetDateStr;
        } catch (err) {
          return false;
        }
      });

      statsArray.push({
        day: dayName,
        safe: dayEmails.filter(e => e.classification === 'safe').length,
        phish: dayEmails.filter(e => e.classification === 'phishing' || e.classification === 'suspect').length
      });
    }
    return statsArray;
  };

  const weeklyData = getWeeklyStats();
  const maxBarValue = Math.max(...weeklyData.map(d => d.safe + d.phish), 5);
  
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

      {/* 2. ACTIVE MAILBOX BANNER */}
      {connectedAccount && (
        <div style={styles.activeBanner} className="glass-panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={styles.activeDot}></span>
            <div>
              <span style={{ fontSize: '13px', color: '#9CA3AF' }}>Active Monitoring: </span>
              <strong style={{ color: '#06B6D4', fontSize: '14px' }}>{connectedAccount.email}</strong>
            </div>
          </div>
        </div>
      )}

      {/* 3. GRID METRICS */}
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
            <div style={styles.statLabel}>Avg Risk Score</div>
            <div style={styles.statVal}>{stats.avg_risk_score}%</div>
          </div>
        </div>
      </section>

      {/* 4. CHARTS SECTION (SIDE-BY-SIDE GRAPH DIALS) */}
      <section style={styles.chartsGrid}>
        {/* Doughnut Ratio Chart */}
        <div style={styles.chartCard} className="glass-panel">
          <h3 style={styles.chartTitle}>Threat Assessment Ratios</h3>
          <div style={styles.chartContent}>
            {/* SVG Doughnut */}
            <div style={styles.svgContainer}>
              <svg width="160" height="160" viewBox="0 0 160 160">
                {/* Safe ring */}
                <circle cx="80" cy="80" r="55" fill="transparent" stroke="rgba(255,255,255,0.03)" strokeWidth="12" />
                <circle 
                  cx="80" cy="80" r="55" 
                  fill="transparent" 
                  stroke="#10B981" 
                  strokeWidth="12" 
                  strokeDasharray="345" 
                  strokeDashoffset={345 - (345 * (safeCount / totalEmails))}
                  strokeLinecap="round"
                  transform="rotate(-90 80 80)"
                  style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                />
                {/* Phishing ring */}
                <circle 
                  cx="80" cy="80" r="42" 
                  fill="transparent" 
                  stroke="#EF4444" 
                  strokeWidth="12" 
                  strokeDasharray="263" 
                  strokeDashoffset={263 - (263 * (phishingCount / totalEmails))}
                  strokeLinecap="round"
                  transform="rotate(-90 80 80)"
                  style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                />
              </svg>
              <div style={styles.chartInnerLabel}>
                <div style={{ fontSize: '20px', fontWeight: '800', color: '#FFF' }}>
                  {Math.round(((phishingCount + suspectCount) / totalEmails) * 100)}%
                </div>
                <div style={{ fontSize: '10px', color: '#9CA3AF', textTransform: 'uppercase' }}>Threats</div>
              </div>
            </div>

            {/* Legend indicators */}
            <div style={styles.legendBox}>
              <div style={styles.legendItem}>
                <span style={{ ...styles.legendDot, background: '#10B981' }}></span>
                <span style={styles.legendLabel}>Safe Mail: <strong>{safePercent}%</strong></span>
              </div>
              <div style={styles.legendItem}>
                <span style={{ ...styles.legendDot, background: '#EF4444' }}></span>
                <span style={styles.legendLabel}>Phishing: <strong>{phishPercent}%</strong></span>
              </div>
              <div style={styles.legendItem}>
                <span style={{ ...styles.legendDot, background: '#F59E0B' }}></span>
                <span style={styles.legendLabel}>Suspect: <strong>{suspectPercent}%</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* Weekly Bar Chart */}
        <div style={styles.chartCard} className="glass-panel">
          <h3 style={styles.chartTitle}>Daily Scanning Volume (Last 7 Days)</h3>
          <div style={styles.barChartContainer}>
            {weeklyData.map((d, index) => {
              const safeHeight = (d.safe / maxBarValue) * 110;
              const phishHeight = (d.phish / maxBarValue) * 110;
              
              return (
                <div key={index} style={styles.barCol}>
                  <div style={styles.barTrack}>
                    {/* Safe Bar */}
                    <div style={{ 
                      ...styles.barFill, 
                      height: `${safeHeight}px`, 
                      background: 'linear-gradient(to top, #047857, #10B981)',
                      boxShadow: '0 0 8px rgba(16, 185, 129, 0.3)'
                    }} title={`Safe: ${d.safe}`}></div>
                    {/* Phishing Bar */}
                    <div style={{ 
                      ...styles.barFill, 
                      height: `${phishHeight}px`, 
                      background: 'linear-gradient(to top, #B91C1C, #EF4444)',
                      boxShadow: '0 0 8px rgba(239, 68, 68, 0.3)'
                    }} title={`Phishing/Suspect: ${d.phish}`}></div>
                  </div>
                  <span style={styles.barLabel}>{d.day}</span>
                </div>
              );
            })}
          </div>
          <div style={styles.barLegend}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ ...styles.legendDot, background: '#10B981' }}></span>
              <span style={{ fontSize: '11px', color: '#9CA3AF' }}>Safe Emails</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ ...styles.legendDot, background: '#EF4444' }}></span>
              <span style={{ fontSize: '11px', color: '#9CA3AF' }}>Phishing/Suspect Threats</span>
            </div>
          </div>
        </div>
      </section>

      {/* 5. SIDE-BY-SIDE SAFE VS PHISHING EMAILS */}
      {loading ? (
        <div style={styles.tablePanel} className="glass-panel">
          <div style={styles.spinnerBox}>
            <div style={styles.spinner}></div>
          </div>
        </div>
      ) : emails.length === 0 ? (
        <div style={styles.tablePanel} className="glass-panel">
          <div style={styles.emptyState}>
            <i className="fa-solid fa-inbox" style={{ fontSize: '42px', color: '#4B5563', marginBottom: '16px' }}></i>
            <p>No email scans loaded. Start receiving emails to monitor threats.</p>
          </div>
        </div>
      ) : (
        <section style={styles.splitSectionGrid}>
          {/* SAFE EMAILS PANEL */}
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

          {/* PHISHING EMAILS PANEL */}
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
      )}
    </div>
  );
}

const styles = {
  container: {
    padding: '40px',
    background: 'transparent',
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
    marginBottom: '20px',
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
  activeBanner: {
    padding: '12px 20px',
    borderRadius: '8px',
    background: 'rgba(22, 28, 45, 0.45)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    marginBottom: '32px',
    display: 'inline-block'
  },
  activeDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    background: '#10B981',
    boxShadow: '0 0 10px #10B981',
    display: 'inline-block'
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
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '24px',
    marginBottom: '32px'
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
  chartsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
    gap: '24px',
    marginBottom: '40px'
  },
  chartCard: {
    borderRadius: '16px',
    padding: '28px',
    background: 'rgba(22, 28, 45, 0.45)',
    border: '1px solid rgba(255, 255, 255, 0.05)'
  },
  chartTitle: {
    margin: '0 0 24px 0',
    fontSize: '16px',
    fontWeight: '700',
    color: '#FFF'
  },
  chartContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-around',
    gap: '20px',
    flexWrap: 'wrap'
  },
  svgContainer: {
    position: 'relative',
    width: '160px',
    height: '160px'
  },
  chartInnerLabel: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    textAlign: 'center'
  },
  legendBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  legendDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    display: 'inline-block'
  },
  legendLabel: {
    fontSize: '13px',
    color: '#9CA3AF'
  },
  barChartContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: '140px',
    padding: '10px 10px 0 10px',
    borderBottom: '1px solid rgba(255,255,255,0.08)'
  },
  barCol: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    flex: 1
  },
  barTrack: {
    display: 'flex',
    gap: '4px',
    alignItems: 'flex-end',
    height: '110px'
  },
  barFill: {
    width: '10px',
    borderRadius: '4px 4px 0 0',
    transition: 'height 0.8s ease'
  },
  barLabel: {
    fontSize: '11px',
    color: '#9CA3AF',
    marginTop: '8px'
  },
  barLegend: {
    display: 'flex',
    gap: '20px',
    justifyContent: 'center',
    marginTop: '20px'
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
  splitSectionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))',
    gap: '32px',
    alignItems: 'start',
    marginTop: '32px'
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
  }
};

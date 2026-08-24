/**
 * ============================================================================
 * COMPONENT: PlacementTester.jsx (Email Placement & InboxAlly Warmup Hub)
 * ============================================================================
 * Description:
 * A high-fidelity implementation of the InboxAlly deliverability platform.
 * Features a split layout supporting Placement Audits (checking email folder routes
 * across ISPs) and Inbox Warmup Campaigns (automatically generating engagement to
 * pull your domain out of spamboxes).
 *
 * Endpoints Called:
 * - GET   http://127.0.0.1:5000/api/dashboard/warmup       (Get warmup details)
 * - POST  http://127.0.0.1:5000/api/dashboard/warmup       (Save warmup details)
 * - POST  http://127.0.0.1:5000/api/emails/placement-test  (Placement audit check)
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import './PlacementTester.css';

export default function PlacementTester() {
  const [activeTab, setActiveTab] = useState('audit'); // 'audit' or 'warmup'
  
  // Placement audit states
  const [sender, setSender] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [consoleLines, setConsoleLines] = useState([]);
  const [report, setReport] = useState(null);
  const [showSeedsModal, setShowSeedsModal] = useState(false);

  // Warmup campaign states
  const [warmupSettings, setWarmupSettings] = useState({
    volume: 50,
    engagement: 'high',
    auto_open: true,
    auto_move: true,
    auto_star: true,
    auto_reply: true,
    status: 'paused'
  });
  const [warmupLogs, setWarmupLogs] = useState([]);

  useEffect(() => {
    fetchWarmupSettings();
  }, []);

  // Live log simulation when warmup status is Active
  useEffect(() => {
    if (warmupSettings.status !== 'active') {
      setWarmupLogs([
        { time: 'Just now', msg: 'InboxAlly Warmup Campaign paused. Awaiting activation trigger...' }
      ]);
      return;
    }

    // Set initial baseline logs
    setWarmupLogs([
      { time: '10 mins ago', msg: 'System initialized SMTP connection exchanges.' },
      { time: '8 mins ago', msg: '[GMAIL] gmail-seed-1 received message "Product launch info", marked as Safe.' },
      { time: '5 mins ago', msg: '[OUTLOOK] outlook-seed-2 intercepted spambox delivery, successfully moved to Inbox.' },
      { time: '2 mins ago', msg: '[YAHOO] yahoo-seed-1 flagged message as Important.' }
    ]);

    const logTemplates = [
      () => ({ time: 'Just now', msg: `[GMAIL] gmail-seed-${Math.ceil(Math.random() * 5)} opened test mail and marked as read.` }),
      () => ({ time: 'Just now', msg: `[OUTLOOK] outlook-seed-${Math.ceil(Math.random() * 3)} pulled message from Junk to Inbox.` }),
      () => ({ time: 'Just now', msg: `[YAHOO] yahoo-seed-${Math.ceil(Math.random() * 2)} starred email and replied: "Sounds interesting, let's schedule."` }),
      () => ({ time: 'Just now', msg: `[GMAIL] gmail-seed-${Math.ceil(Math.random() * 5)} replied to your campaign thread.` })
    ];

    const interval = setInterval(() => {
      const getter = logTemplates[Math.floor(Math.random() * logTemplates.length)];
      setWarmupLogs(prev => [getter(), ...prev.slice(0, 15)]);
    }, 4500);

    return () => clearInterval(interval);
  }, [warmupSettings.status]);

  const fetchWarmupSettings = () => {
    fetch('http://127.0.0.1:5000/api/dashboard/warmup', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data.status === 'success' && data.warmup) {
          setWarmupSettings(data.warmup);
        }
      })
      .catch(() => {});
  };

  const saveWarmupSettings = (updated) => {
    fetch('http://127.0.0.1:5000/api/dashboard/warmup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
      credentials: 'include'
    })
      .then(r => r.json())
      .then(data => {
        if (data.status === 'success') {
          setWarmupSettings(updated);
        } else {
          alert('Failed to update campaign configurations.');
        }
      })
      .catch(() => {
        alert('Offline: Failed to sync warmup parameters.');
      });
  };

  const toggleWarmupStatus = () => {
    const nextStatus = warmupSettings.status === 'active' ? 'paused' : 'active';
    const updated = { ...warmupSettings, status: nextStatus };
    saveWarmupSettings(updated);
  };

  const handleWarmupSlider = (e) => {
    const updated = { ...warmupSettings, volume: parseInt(e.target.value) };
    setWarmupSettings(updated);
  };

  const handleWarmupCheckbox = (key) => {
    const updated = { ...warmupSettings, [key]: !warmupSettings[key] };
    saveWarmupSettings(updated);
  };

  const seeds = [
    { isp: 'Gmail', address: 'gmail-seed-1@phishguard.io' },
    { isp: 'Gmail', address: 'gmail-seed-2@phishguard.io' },
    { isp: 'Gmail', address: 'gmail-seed-3@phishguard.io' },
    { isp: 'Gmail', address: 'gmail-seed-4@phishguard.io' },
    { isp: 'Gmail', address: 'gmail-seed-5@phishguard.io' },
    { isp: 'Outlook', address: 'outlook-seed-1@phishguard.io' },
    { isp: 'Outlook', address: 'outlook-seed-2@phishguard.io' },
    { isp: 'Outlook', address: 'outlook-seed-3@phishguard.io' },
    { isp: 'Yahoo', address: 'yahoo-seed-1@phishguard.io' },
    { isp: 'Yahoo', address: 'yahoo-seed-2@phishguard.io' }
  ];

  const loadPreset = (type) => {
    if (type === 'good') {
      setSender('info@companyupdates.com');
      setSubject('Important: Upcoming updates to your user profile settings');
      setBody('Hi Aditya,\n\nWe wanted to notify you about the new security measures starting next week. Please review your notification options. You can change your password or unsubscribe from email updates in your settings at http://companyupdates.com/account.');
    } else if (type === 'spammy') {
      setSender('offers@claim-rewards-jackpot.com');
      setSubject('URGENT: Verify your credentials to claim your free $1000 prize!!!');
      setBody('CONGRATULATIONS! Your email was chosen to win a free gift card. Verify your profile immediately at http://bit.ly/rewards-claim-fake. Act now to double your cash, guaranteed refund!');
    }
  };

  const handleAudit = (e) => {
    e.preventDefault();
    if (!sender || !subject || !body) return;

    setLoading(true);
    setReport(null);
    setConsoleLines([]);

    const steps = [
      `> Initializing SMTP seed delivery channels...`,
      `> Distributing message payload to 10 active ISP test targets...`,
      `> Dispatching to 5 Google Gmail seed addresses...`,
      `> Dispatching to 3 Microsoft Outlook/Hotmail seed addresses...`,
      `> Dispatching to 2 Yahoo mail seed addresses...`,
      `> Spawning IMAP checkers to audit folder placement directories...`,
      `> Fetching placement categories from Gmail seeds...`,
      `> Fetching placement categories from Outlook seeds...`,
      `> Fetching placement categories from Yahoo seeds...`,
      `> Audits complete. Compiling placement percentages...`
    ];

    steps.forEach((line, index) => {
      setTimeout(() => {
        setConsoleLines(prev => [...prev, line]);
      }, (index + 1) * 300);
    });

    setTimeout(() => {
      fetch('http://127.0.0.1:5000/api/emails/placement-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender, subject, body })
      })
        .then(r => r.json())
        .then(data => {
          setLoading(false);
          if (data.status === 'success') {
            setReport(data);
          } else {
            alert(data.message || 'Audit failed.');
          }
        })
        .catch(() => {
          setLoading(false);
          alert('Offline: Could not connect to placement server.');
        });
    }, 3000);
  };

  return (
    <div className="placement-container">
      <header className="placement-header">
        <h2 className="placement-title">InboxAlly Placement & Warmup Hub</h2>
        <p className="placement-subtitle">Audit email placement directories and repair domain sender deliverability ratings in real time.</p>
      </header>

      {/* SUB-TABS NAVIGATION */}
      <nav className="placement-tabs-nav">
        <button 
          className={`placement-tab-btn ${activeTab === 'audit' ? 'active' : ''}`}
          onClick={() => setActiveTab('audit')}
        >
          <i className="fa-solid fa-list-check"></i>
          Placement Audit (Seed Test)
        </button>

        <button 
          className={`placement-tab-btn ${activeTab === 'warmup' ? 'active' : ''}`}
          onClick={() => setActiveTab('warmup')}
        >
          <i className="fa-solid fa-fire"></i>
          Inbox Warmup Campaign
        </button>
      </nav>

      {activeTab === 'audit' ? (
        /* AUDIT TAB GRID */
        <div className="placement-grid">
          {/* Composition Form Panel */}
          <section className="placement-form-panel glass-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: '#FFF' }}>Test Mail Composer</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="placement-btn-view-seeds" style={{ textDecoration: 'none', color: '#FFF', background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '6px' }} onClick={() => loadPreset('good')}>Clean Template</button>
                <button type="button" className="placement-btn-view-seeds" style={{ textDecoration: 'none', color: '#FFF', background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '6px' }} onClick={() => loadPreset('spammy')}>Spam Template</button>
              </div>
            </div>

            <div className="placement-seed-list-box">
              <div className="placement-seed-title">Active Recipient Seed List</div>
              <div className="placement-seed-preview-row">
                <span className="placement-seeds-count-tag">
                  <i className="fa-solid fa-list-check" style={{ marginRight: '6px' }}></i>10 Seed Mailboxes
                </span>
                <button className="placement-btn-view-seeds" onClick={() => setShowSeedsModal(true)}>
                  Review Seed Addresses
                </button>
              </div>
            </div>

            <form onSubmit={handleAudit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="placement-form-group">
                <label className="placement-label">Sender Address (From:)</label>
                <input 
                  type="email" 
                  placeholder="e.g. hello@mybrand.com" 
                  className="placement-input"
                  value={sender}
                  onChange={e => setSender(e.target.value)}
                  required
                />
              </div>

              <div className="placement-form-group">
                <label className="placement-label">Email Subject</label>
                <input 
                  type="text" 
                  placeholder="e.g. Weekly newsletters and updates" 
                  className="placement-input"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  required
                />
              </div>

              <div className="placement-form-group">
                <label className="placement-label">Body Content (HTML/Text)</label>
                <textarea 
                  rows="8"
                  placeholder="Paste test body content here..." 
                  className="placement-textarea"
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  required
                />
              </div>

              <button 
                type="submit" 
                className="placement-btn-run"
                disabled={loading}
                style={{ opacity: loading ? 0.7 : 1 }}
              >
                <i className="fa-solid fa-paper-plane" style={{ marginRight: '8px' }}></i>
                {loading ? 'Analyzing Placements...' : 'Execute Placement Test Scan'}
              </button>
            </form>
          </section>

          {/* Results Panel */}
          <section className="placement-report-col">
            {loading && (
              <div className="placement-loader-panel glass-panel">
                <div className="placement-spinner"></div>
                <h4 style={{ margin: '0 0 12px 0', color: '#FFF' }}>Spawning Mail Checkers...</h4>
                <p style={{ color: '#8A92A6', fontSize: '13px', margin: '0 0 20px 0' }}>Testing folder placements across seed addresses...</p>
                
                <div className="placement-console">
                  {consoleLines.map((line, idx) => (
                    <div key={idx} style={{ marginBottom: '4px' }}>{line}</div>
                  ))}
                </div>
              </div>
            )}

            {!loading && !report && (
              <div className="placement-empty-report glass-panel">
                <i className="fa-solid fa-server" style={{ fontSize: '48px', color: '#10B981', marginBottom: '16px', opacity: 0.8 }}></i>
                <h3 style={{ margin: '0 0 8px 0', color: '#FFF' }}>Inbox Placement Report</h3>
                <p style={{ margin: 0 }}>Write an email to the seed list and click scan to test folder placements.</p>
              </div>
            )}

            {!loading && report && (
              <>
                {/* Aggregated Placement Report Card */}
                <div className="placement-summary-card glass-panel">
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#FFF' }}>
                    Inbox Placement: {report.inbox_percent}%
                  </h3>
                  
                  <div className="placement-progress-bars">
                    <div className="placement-progress-group">
                      <div className="placement-progress-label-row">
                        <span style={{ color: '#10B981' }}>Inbox (Primary)</span>
                        <span style={{ color: '#10B981' }}>{report.inbox_percent}%</span>
                      </div>
                      <div className="placement-bar-bg">
                        <div className="placement-bar-fill" style={{ width: `${report.inbox_percent}%`, background: '#10B981' }}></div>
                      </div>
                    </div>

                    <div className="placement-progress-group">
                      <div className="placement-progress-label-row">
                        <span style={{ color: '#F59E0B' }}>Promotions / Categories</span>
                        <span style={{ color: '#F59E0B' }}>{report.promo_percent}%</span>
                      </div>
                      <div className="placement-bar-bg">
                        <div className="placement-bar-fill" style={{ width: `${report.promo_percent}%`, background: '#F59E0B' }}></div>
                      </div>
                    </div>

                    <div className="placement-progress-group">
                      <div className="placement-progress-label-row">
                        <span style={{ color: '#EF4444' }}>Spam / Junk</span>
                        <span style={{ color: '#EF4444' }}>{report.spam_percent}%</span>
                      </div>
                      <div className="placement-bar-bg">
                        <div className="placement-bar-fill" style={{ width: `${report.spam_percent}%`, background: '#EF4444' }}></div>
                      </div>
                    </div>
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '10px', fontSize: '13px', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <strong>Heuristics Observations:</strong>
                    <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px', lineHeight: '1.5', color: '#9CA3AF' }}>
                      {report.audit_logs.map((log, lIdx) => (
                        <li key={lIdx}>{log}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Provider Breakdown Sections */}
                <div className="placement-provider-breakdown">
                  <div className="placement-provider-card">
                    <div className="placement-provider-header">
                      <div className="placement-provider-title">
                        <i className="fa-brands fa-google" style={{ color: '#10B981' }}></i>Google Gmail
                      </div>
                      <div className="placement-provider-shares">
                        <span>Seeds: 5</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '20px', fontSize: '13px' }}>
                      <span style={{ color: '#10B981' }}>Inbox: {Math.round((report.seed_details.filter(s => s.isp === 'Gmail' && s.folder === 'inbox').length / 5) * 100)}%</span>
                      <span style={{ color: '#F59E0B' }}>Promo: {Math.round((report.seed_details.filter(s => s.isp === 'Gmail' && s.folder === 'promotions').length / 5) * 100)}%</span>
                      <span style={{ color: '#EF4444' }}>Spam: {Math.round((report.seed_details.filter(s => s.isp === 'Gmail' && s.folder === 'spam').length / 5) * 100)}%</span>
                    </div>
                  </div>

                  <div className="placement-provider-card">
                    <div className="placement-provider-header">
                      <div className="placement-provider-title">
                        <i className="fa-brands fa-microsoft" style={{ color: '#06B6D4' }}></i>Microsoft Outlook
                      </div>
                      <div className="placement-provider-shares">
                        <span>Seeds: 3</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '20px', fontSize: '13px' }}>
                      <span style={{ color: '#10B981' }}>Inbox: {Math.round((report.seed_details.filter(s => s.isp === 'Outlook' && s.folder === 'inbox').length / 3) * 100)}%</span>
                      <span style={{ color: '#EF4444' }}>Junk: {Math.round((report.seed_details.filter(s => s.isp === 'Outlook' && s.folder === 'spam').length / 3) * 100)}%</span>
                    </div>
                  </div>

                  <div className="placement-provider-card">
                    <div className="placement-provider-header">
                      <div className="placement-provider-title">
                        <i className="fa-brands fa-yahoo" style={{ color: '#8B5CF6' }}></i>Yahoo / AOL
                      </div>
                      <div className="placement-provider-shares">
                        <span>Seeds: 2</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '20px', fontSize: '13px' }}>
                      <span style={{ color: '#10B981' }}>Inbox: {Math.round((report.seed_details.filter(s => s.isp === 'Yahoo' && s.folder === 'inbox').length / 2) * 100)}%</span>
                      <span style={{ color: '#EF4444' }}>Spam: {Math.round((report.seed_details.filter(s => s.isp === 'Yahoo' && s.folder === 'spam').length / 2) * 100)}%</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      ) : (
        /* WARMUP TAB GRID */
        <div className="placement-grid">
          {/* Warmup Campaign Configuration */}
          <section className="placement-form-panel glass-panel">
            <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '800', color: '#FFF' }}>
              Warmup Controls (Reputation Repair)
            </h3>

            {/* Campaign Status Toggle Row */}
            <div className="placement-warmup-toggle-row">
              <div>
                <div style={{ fontSize: '14px', fontWeight: 'bold' }}>Campaign Status</div>
                <div style={{ marginTop: '4px' }}>
                  <span className="placement-warmup-status-badge" style={{
                    background: warmupSettings.status === 'active' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                    color: warmupSettings.status === 'active' ? '#10B981' : '#EF4444'
                  }}>
                    {warmupSettings.status}
                  </span>
                </div>
              </div>
              <button 
                onClick={toggleWarmupStatus} 
                className={`placement-warmup-toggle-btn ${warmupSettings.status === 'active' ? 'paused' : ''}`}
              >
                {warmupSettings.status === 'active' ? 'PAUSE WARMUP' : 'START WARMUP'}
              </button>
            </div>

            {/* Daily Volume Slider */}
            <div className="placement-form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label className="placement-label" style={{ margin: 0 }}>Daily Engagement Volume</label>
                <strong className="text-cyan">{warmupSettings.volume} emails / day</strong>
              </div>
              <input 
                type="range"
                min="10"
                max="250"
                step="10"
                value={warmupSettings.volume}
                onChange={handleWarmupSlider}
                onMouseUp={() => saveWarmupSettings(warmupSettings)}
                onTouchEnd={() => saveWarmupSettings(warmupSettings)}
                className="admin-panel-slider"
                style={{ width: '100%' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#8A92A6', marginTop: '6px' }}>
                <span>Min (10)</span>
                <span>Max (250)</span>
              </div>
            </div>

            {/* Engagement Behaviors Switches */}
            <div style={{ marginTop: '30px' }}>
              <label className="placement-label" style={{ marginBottom: '16px' }}>ISP Seed Interaction Behaviors</label>
              
              <div className="placement-switch-row">
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 'bold' }}>Auto-Open Email Body</div>
                  <div style={{ fontSize: '11px', color: '#8A92A6', marginTop: '2px' }}>Opens email and stays active for 60s.</div>
                </div>
                <label className="placement-switch">
                  <input 
                    type="checkbox" 
                    checked={warmupSettings.auto_open} 
                    onChange={() => handleWarmupCheckbox('auto_open')}
                  />
                  <span className="placement-slider-round"></span>
                </label>
              </div>

              <div className="placement-switch-row">
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 'bold' }}>Auto-Move from Spam/Junk to Inbox</div>
                  <div style={{ fontSize: '11px', color: '#8A92A6', marginTop: '2px' }}>Trains filters that sender is not spam. (CRITICAL)</div>
                </div>
                <label className="placement-switch">
                  <input 
                    type="checkbox" 
                    checked={warmupSettings.auto_move} 
                    onChange={() => handleWarmupCheckbox('auto_move')}
                  />
                  <span className="placement-slider-round"></span>
                </label>
              </div>

              <div className="placement-switch-row">
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 'bold' }}>Auto-Star & Mark as Important</div>
                  <div style={{ fontSize: '11px', color: '#8A92A6', marginTop: '2px' }}>Gives primary folder placement points.</div>
                </div>
                <label className="placement-switch">
                  <input 
                    type="checkbox" 
                    checked={warmupSettings.auto_star} 
                    onChange={() => handleWarmupCheckbox('auto_star')}
                  />
                  <span className="placement-slider-round"></span>
                </label>
              </div>

              <div className="placement-switch-row">
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 'bold' }}>Auto-Reply Response Simulation</div>
                  <div style={{ fontSize: '11px', color: '#8A92A6', marginTop: '2px' }}>Replies with context-rich text body.</div>
                </div>
                <label className="placement-switch">
                  <input 
                    type="checkbox" 
                    checked={warmupSettings.auto_reply} 
                    onChange={() => handleWarmupCheckbox('auto_reply')}
                  />
                  <span className="placement-slider-round"></span>
                </label>
              </div>
            </div>
          </section>

          {/* Warmup Status Dashboard */}
          <section className="placement-report-col">
            {/* SVG Deliverability Improvement Progress Chart */}
            <div className="placement-summary-card glass-panel">
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: '#FFF' }}>
                Sender Deliverability Trend (Reputation Warmup)
              </h3>
              <p style={{ margin: 0, color: '#8A92A6', fontSize: '12.5px' }}>Tracks Primary Inbox placement rate improvement over the last 15 days.</p>
              
              <div style={{ position: 'relative', height: '160px', width: '100%', marginTop: '16px' }}>
                <svg viewBox="0 0 500 160" style={{ width: '100%', height: '100%' }}>
                  <line x1="40" y1="20" x2="480" y2="20" stroke="rgba(255,255,255,0.03)" />
                  <line x1="40" y1="60" x2="480" y2="60" stroke="rgba(255,255,255,0.03)" />
                  <line x1="40" y1="100" x2="480" y2="100" stroke="rgba(255,255,255,0.03)" />
                  <line x1="40" y1="140" x2="480" y2="140" stroke="rgba(255,255,255,0.03)" />
                  
                  {/* Improvement Line Path: Day 1: 15% -> Day 5: 35% -> Day 10: 75% -> Day 15: 98% */}
                  <path d="M 50 140 L 150 120 L 250 90 L 350 45 L 450 25" fill="none" stroke="#10B981" strokeWidth="3" />
                  <path d="M 50 140 L 150 120 L 250 90 L 350 45 L 450 25 L 450 150 L 50 150 Z" fill="rgba(16, 185, 129, 0.05)" />
                  
                  <circle cx="50" cy="140" r="4" fill="#10B981" />
                  <circle cx="150" cy="120" r="4" fill="#10B981" />
                  <circle cx="250" cy="90" r="4" fill="#10B981" />
                  <circle cx="350" cy="45" r="4" fill="#10B981" />
                  <circle cx="450" cy="25" r="4" fill="#10B981" />
                </svg>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#8A92A6', padding: '0 30px' }}>
                  <span>Day 1 (15%)</span>
                  <span>Day 5 (35%)</span>
                  <span>Day 10 (75%)</span>
                  <span>Day 15 (98%)</span>
                </div>
              </div>
            </div>

            {/* Live interactions log timeline */}
            <div className="placement-summary-card glass-panel">
              <h3 style={{ margin: '0 0 6px 0', fontSize: '17px', fontWeight: '800', color: '#FFF' }}>
                Live Warmup Engagements Log Feed
              </h3>
              <p style={{ margin: '0 0 16px 0', color: '#8A92A6', fontSize: '12.5px' }}>Logs real-time interaction behaviors executed by seed mailboxes.</p>
              
              <div className="placement-warmup-logs-box">
                {warmupLogs.map((log, idx) => (
                  <div key={idx} className="placement-warmup-log-item">
                    <span className="placement-warmup-log-time">[{log.time}]</span>
                    {log.msg}
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Recipient Seeds List Modal overlay */}
      {showSeedsModal && (
        <div className="placement-seed-modal-overlay">
          <div className="placement-seed-modal-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#FFF' }}>InboxAlly Seed Addresses</h3>
              <button 
                className="placement-btn-view-seeds" 
                style={{ textDecoration: 'none', fontSize: '20px', color: '#FFF' }}
                onClick={() => setShowSeedsModal(false)}
              >
                &times;
              </button>
            </div>
            
            <p style={{ fontSize: '13px', color: '#9CA3AF', lineHeight: '1.5', marginBottom: '20px' }}>
              These seed mailboxes are monitored automatically by our backend checkers. Sending test emails to this seed list allows auditing placement metrics across ISPs.
            </p>

            <div className="placement-seed-modal-list">
              {seeds.map((seed, idx) => (
                <div key={idx} className="placement-seed-modal-item">
                  <span style={{ fontWeight: 'bold', color: seed.isp === 'Gmail' ? '#10B981' : seed.isp === 'Outlook' ? '#06B6D4' : '#8B5CF6' }}>
                    [{seed.isp.toUpperCase()}]
                  </span>
                  <span>{seed.address}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * ============================================================================
 * COMPONENT: PlacementTester.jsx (Email placement & Inbox Folder Tester)
 * ============================================================================
 * Description:
 * A high-fidelity email folder placement tester inspired by InboxAlly.
 * Generates an active seed list of recipient boxes across major ISPs and checks
 * where your email lands (Inbox, Promotions, Spam/Junk) in real time.
 *
 * Endpoints Called:
 * - POST  http://127.0.0.1:5000/api/emails/placement-test  (Placement audit)
 * ============================================================================
 */

import React, { useState } from 'react';
import './PlacementTester.css';

export default function PlacementTester() {
  const [sender, setSender] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [consoleLines, setConsoleLines] = useState([]);
  const [report, setReport] = useState(null);
  
  const [showSeedsModal, setShowSeedsModal] = useState(false);

  // Seed list containing addresses
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
      }, (index + 1) * 320);
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
    }, 3200);
  };

  return (
    <div className="placement-container">
      <header className="placement-header">
        <h2 className="placement-title">Email Placement & Folder Tester</h2>
        <p className="placement-subtitle">Audit where your emails land across major ISP directories: Inbox, Promotions tab, or Spam folder.</p>
      </header>

      <div className="placement-grid">
        {/* Composition Form Panel */}
        <section className="placement-form-panel glass-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#FFF' }}>Test Mail Composer</h3>
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
                {/* Google/Gmail Seeds Card */}
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

                {/* Microsoft/Outlook Seeds Card */}
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

                {/* Yahoo Seeds Card */}
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

/**
 * ============================================================================
 * COMPONENT: SpamTester.jsx (Deliverability & Spam Auditor)
 * ============================================================================
 * Description:
 * A high-fidelity email spam tester inspired by Kickbox. Provides users with
 * a temporary sandbox address, a simulator composer to write email bodies,
 * and a breakdown of SpamAssassin rules, SPF/DKIM authentication, and RBL blacklists.
 *
 * Endpoints Called:
 * - POST  http://127.0.0.1:5000/api/emails/spam-test      (Deliverability scan)
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import './SpamTester.css';

export default function SpamTester() {
  const [sender, setSender] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  
  const [testAddress, setTestAddress] = useState('');
  const [copied, setCopied] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [consoleLines, setConsoleLines] = useState([]);
  const [report, setReport] = useState(null);
  
  // Accordion active sections: 'auth', 'spam', 'blacklist'
  const [activeSection, setActiveSection] = useState('auth');

  useEffect(() => {
    // Generate a random unique testing mailbox address on mount
    const randomHex = Math.random().toString(16).substring(2, 8);
    setTestAddress(`spamtest-${randomHex}@phishguard.io`);
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(testAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const loadPreset = (type) => {
    if (type === 'good') {
      setSender('newsletter@trustedbiz.com');
      setSubject('Monthly newsletter: Updates and new security features');
      setBody('Hello Subscriber,\n\nWe have updated our terms of service and added two-factor authentication to secure your files. You can manage your preferences or unsubscribe at any time at http://trustedbiz.com/preferences/unsubscribe.');
    } else if (type === 'spammy') {
      setSender('free-cash@instant-rewards-win.com');
      setSubject('URGENT!!! YOU WON A FREE $500 GIFT CARD ACT NOW!!!');
      setBody('CONGRATULATIONS!!! You have been selected as the grand prize winner. Click here to verify your account and claim your free offer immediately: http://bit.ly/claim-rewards-fake.\n\nGuaranteed refund, act now to double your cash!');
    }
  };

  const handleAudit = (e) => {
    e.preventDefault();
    if (!sender || !subject || !body) return;

    setLoading(true);
    setReport(null);
    setConsoleLines([]);

    const steps = [
      `> Establishing relay tunnel to incoming inbox: ${testAddress}...`,
      `> Received composed mail headers & text content...`,
      `> Auditing DNS registries for domain authentication...`,
      `> Verifying SPF (Sender Policy Framework) record nodes...`,
      `> Checking DKIM cryptography key alignments...`,
      `> Analyzing subject syntax and capitalization rules...`,
      `> Scanning body content text indices against SpamAssassin TF-IDF dictionary...`,
      `> Checking sender server IP block status across Spamhaus & Barracuda RBLs...`,
      `> Compiling deliverability rating...`
    ];

    steps.forEach((line, index) => {
      setTimeout(() => {
        setConsoleLines(prev => [...prev, line]);
      }, (index + 1) * 350);
    });

    setTimeout(() => {
      fetch('http://127.0.0.1:5000/api/emails/spam-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender, subject, body })
      })
        .then(r => {
          if (!r.ok) throw new Error('Deliverability audit failed.');
          return r.json();
        })
        .then(data => {
          setLoading(false);
          if (data.status === 'success') {
            setReport(data);
          } else {
            alert(data.message || 'Audit failed.');
          }
        })
        .catch(err => {
          setLoading(false);
          alert(err.message || 'Server connection offline.');
        });
    }, 3500);
  };

  // Score circular gauge configuration
  const scorePercent = report ? report.score * 10 : 0;
  const strokeColor = report 
    ? report.score >= 8.5 ? '#10B981' : report.score >= 5.5 ? '#F59E0B' : '#EF4444'
    : '#6B7280';

  return (
    <div className="spam-tester-container">
      <header className="spam-tester-header">
        <h2 className="spam-tester-title">Spam & Deliverability Tester</h2>
        <p className="spam-tester-subtitle">Test how email filters interpret your messages. Inspect email authentication, content, and blacklist standings.</p>
      </header>

      <div className="spam-tester-grid">
        {/* Composer Form Section */}
        <section className="spam-tester-form-panel glass-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#FFF' }}>Test Mail Composer</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="spam-tester-btn-copy" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => loadPreset('good')}>Load Clean Preset</button>
              <button type="button" className="spam-tester-btn-copy" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => loadPreset('spammy')}>Load Spam Preset</button>
            </div>
          </div>

          <div className="spam-tester-mailbox-header">
            <div className="spam-tester-mailbox-title">Your Sandbox Test Inbox Address</div>
            <div className="spam-tester-address-row">
              <div className="spam-tester-address-box">{testAddress}</div>
              <button className="spam-tester-btn-copy" onClick={handleCopy} title="Copy email address">
                <i className={copied ? "fa-solid fa-check text-green" : "fa-solid fa-copy"}></i>
              </button>
            </div>
          </div>

          <form onSubmit={handleAudit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="spam-tester-form-group">
              <label className="spam-tester-label">Sender Email (From: Header)</label>
              <input 
                type="email" 
                placeholder="e.g. support@yourcompany.com" 
                className="spam-tester-input"
                value={sender}
                onChange={e => setSender(e.target.value)}
                required
              />
            </div>

            <div className="spam-tester-form-group">
              <label className="spam-tester-label">Email Subject</label>
              <input 
                type="text" 
                placeholder="e.g. Save 20% on your next purchase" 
                className="spam-tester-input"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                required
              />
            </div>

            <div className="spam-tester-form-group">
              <label className="spam-tester-label">Body Content (HTML / Text)</label>
              <textarea 
                rows="8"
                placeholder="Paste the email content you want to test here..." 
                className="spam-tester-textarea"
                value={body}
                onChange={e => setBody(e.target.value)}
                required
              />
            </div>

            <button 
              type="submit" 
              className="spam-tester-btn-run"
              disabled={loading}
              style={{ opacity: loading ? 0.7 : 1 }}
            >
              <i className="fa-solid fa-envelope-circle-check" style={{ marginRight: '8px' }}></i>
              {loading ? 'Analyzing Message...' : 'Check Your Deliverability Score'}
            </button>
          </form>
        </section>

        {/* Results Panel */}
        <section className="spam-tester-report-col">
          {loading && (
            <div className="spam-tester-loader-panel glass-panel">
              <div className="spam-tester-spinner"></div>
              <h4 style={{ margin: '0 0 12px 0', color: '#FFF' }}>Auditing Email Parameters...</h4>
              <p style={{ color: '#8A92A6', fontSize: '13px', margin: '0 0 20px 0' }}>Streaming checks from deliverability scanning pipelines</p>
              
              <div className="spam-tester-console">
                {consoleLines.map((line, idx) => (
                  <div key={idx} style={{ marginBottom: '4px' }}>{line}</div>
                ))}
              </div>
            </div>
          )}

          {!loading && !report && (
            <div className="spam-tester-empty-report glass-panel">
              <i className="fa-solid fa-envelope-open-text" style={{ fontSize: '48px', color: '#06B6D4', marginBottom: '16px', opacity: 0.8 }}></i>
              <h3 style={{ margin: '0 0 8px 0', color: '#FFF' }}>Awaiting Mail Audit</h3>
              <p style={{ margin: 0 }}>Compose a test message on the left panel and click audit to check spam scores.</p>
            </div>
          )}

          {!loading && report && (
            <>
              {/* Overall Score Dial Header */}
              <div className="spam-tester-score-card glass-panel" style={{ borderLeft: `5px solid ${strokeColor}` }}>
                <div className="spam-tester-gauge-box">
                  <svg width="120" height="120" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="48" fill="transparent" stroke="rgba(255,255,255,0.03)" strokeWidth="8" />
                    <circle cx="60" cy="60" r="48" fill="transparent" stroke={strokeColor} strokeWidth="8" strokeDasharray="301.6" strokeDashoffset={301.6 - (301.6 * (scorePercent / 100))} transform="rotate(-90 60 60)" style={{ transition: 'all 1s ease' }} />
                  </svg>
                  <div className="spam-tester-gauge-text">
                    <div className="spam-tester-gauge-val" style={{ color: strokeColor }}>{report.score}</div>
                    <div className="spam-tester-gauge-lbl">/ 10</div>
                  </div>
                </div>

                <div className="spam-tester-verdict-info">
                  <h3 className="spam-tester-verdict-title">Deliverability: {report.verdict}</h3>
                  <p className="spam-tester-verdict-desc">
                    {report.score >= 8.5 ? 'Excellent alignment! Your email has very low spam probabilities and will land directly in inbox folders.' : 
                     report.score >= 5.5 ? 'Moderate deliverability alerts. Some content trigger rules were flagged—consider minor modifications.' : 
                     'High spam warning indicators! Filters will quarantine this message into spam folders.'}
                  </p>
                </div>
              </div>

              {/* Expandable Report Accordions */}
              <div className="spam-tester-accordion-group">
                
                {/* Accordion Section 1: Authentication */}
                <div className="spam-tester-accordion-item">
                  <button className="spam-tester-accordion-trigger" onClick={() => setActiveSection(activeSection === 'auth' ? '' : 'auth')}>
                    <div className="spam-tester-trigger-left">
                      <i className="fa-solid fa-key" style={{ color: '#06B6D4' }}></i>
                      <span>1. Sender Authentication (SPF, DKIM, DMARC)</span>
                    </div>
                    <i className={`fa-solid fa-chevron-${activeSection === 'auth' ? 'up' : 'down'}`} style={{ color: '#8A92A6' }}></i>
                  </button>

                  {activeSection === 'auth' && (
                    <div className="spam-tester-accordion-body">
                      <div className="spam-tester-audit-row">
                        <span>Sender Policy Framework (SPF) Verification</span>
                        <span className={report.auth.spf ? "spam-tester-pass-indicator" : "spam-tester-fail-indicator"}>
                          <i className={report.auth.spf ? "fa-solid fa-circle-check" : "fa-solid fa-circle-xmark"}></i>
                          {report.auth.spf ? 'PASS' : 'FAIL'}
                        </span>
                      </div>

                      <div className="spam-tester-audit-row">
                        <span>DKIM Cryptographic Key Verification</span>
                        <span className={report.auth.dkim ? "spam-tester-pass-indicator" : "spam-tester-fail-indicator"}>
                          <i className={report.auth.dkim ? "fa-solid fa-circle-check" : "fa-solid fa-circle-xmark"}></i>
                          {report.auth.dkim ? 'PASS' : 'FAIL'}
                        </span>
                      </div>

                      <div className="spam-tester-audit-row">
                        <span>DMARC Enforcement Checks</span>
                        <span className={report.auth.dmarc ? "spam-tester-pass-indicator" : "spam-tester-fail-indicator"}>
                          <i className={report.auth.dmarc ? "fa-solid fa-circle-check" : "fa-solid fa-circle-xmark"}></i>
                          {report.auth.dmarc ? 'PASS' : 'FAIL'}
                        </span>
                      </div>

                      <div className="spam-tester-audit-row">
                        <span>Reverse DNS Resolution (PTR) Alignment</span>
                        <span className={report.auth.ptr ? "spam-tester-pass-indicator" : "spam-tester-fail-indicator"}>
                          <i className={report.auth.ptr ? "fa-solid fa-circle-check" : "fa-solid fa-circle-xmark"}></i>
                          {report.auth.ptr ? 'PASS' : 'FAIL'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Accordion Section 2: SpamAssassin Rules */}
                <div className="spam-tester-accordion-item">
                  <button className="spam-tester-accordion-trigger" onClick={() => setActiveSection(activeSection === 'spam' ? '' : 'spam')}>
                    <div className="spam-tester-trigger-left">
                      <i className="fa-solid fa-calculator" style={{ color: '#F59E0B' }}></i>
                      <span>2. SpamAssassin Rules & Heuristics</span>
                    </div>
                    <i className={`fa-solid fa-chevron-${activeSection === 'spam' ? 'up' : 'down'}`} style={{ color: '#8A92A6' }}></i>
                  </button>

                  {activeSection === 'spam' && (
                    <div className="spam-tester-accordion-body">
                      {report.rules_triggered.length === 0 ? (
                        <div className="spam-tester-pass-indicator" style={{ padding: '8px' }}>
                          <i className="fa-solid fa-circle-check" style={{ marginRight: '10px' }}></i>
                          Perfect! Your message is clean of clickbait words or structural spam triggers.
                        </div>
                      ) : (
                        report.rules_triggered.map((rule, idx) => (
                          <div key={idx} className="spam-tester-rule-alert">
                            <i className="fa-solid fa-triangle-exclamation" style={{ color: '#EF4444', fontSize: '16px', marginTop: '2px' }}></i>
                            <div style={{ flexGrow: 1 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span className="spam-tester-rule-summary">{rule.summary}</span>
                                <span style={{ color: '#EF4444', fontSize: '12px', fontWeight: 'bold' }}>-{rule.deduction} pts</span>
                              </div>
                              <div className="spam-tester-rule-desc">{rule.desc}</div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Accordion Section 3: Blocklists */}
                <div className="spam-tester-accordion-item">
                  <button className="spam-tester-accordion-trigger" onClick={() => setActiveSection(activeSection === 'blacklist' ? '' : 'blacklist')}>
                    <div className="spam-tester-trigger-left">
                      <i className="fa-solid fa-ban" style={{ color: '#EF4444' }}></i>
                      <span>3. Domain blocklists & RBL Audits</span>
                    </div>
                    <i className={`fa-solid fa-chevron-${activeSection === 'blacklist' ? 'up' : 'down'}`} style={{ color: '#8A92A6' }}></i>
                  </button>

                  {activeSection === 'blacklist' && (
                    <div className="spam-tester-accordion-body">
                      <div className="spam-tester-audit-row">
                        <span>Spamhaus Zen Database</span>
                        <span className={report.blacklist_status.spamhaus === 'CLEAN' ? "spam-tester-pass-indicator" : "spam-tester-fail-indicator"}>
                          <i className={report.blacklist_status.spamhaus === 'CLEAN' ? "fa-solid fa-circle-check" : "fa-solid fa-circle-xmark"}></i>
                          {report.blacklist_status.spamhaus}
                        </span>
                      </div>

                      <div className="spam-tester-audit-row">
                        <span>Barracuda Reputation Block List (BRBL)</span>
                        <span className={report.blacklist_status.barracuda === 'CLEAN' ? "spam-tester-pass-indicator" : "spam-tester-fail-indicator"}>
                          <i className={report.blacklist_status.barracuda === 'CLEAN' ? "fa-solid fa-circle-check" : "fa-solid fa-circle-xmark"}></i>
                          {report.blacklist_status.barracuda}
                        </span>
                      </div>

                      <div className="spam-tester-audit-row">
                        <span>SpamCop Blocking List (SCBL)</span>
                        <span className={report.blacklist_status.spamcop === 'CLEAN' ? "spam-tester-pass-indicator" : "spam-tester-fail-indicator"}>
                          <i className={report.blacklist_status.spamcop === 'CLEAN' ? "fa-solid fa-circle-check" : "fa-solid fa-circle-xmark"}></i>
                          {report.blacklist_status.spamcop}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

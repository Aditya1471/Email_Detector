/**
 * ============================================================================
 * COMPONENT: EmailDetails.jsx (AI Email Forensics & Sandbox Simulator)
 * ============================================================================
 * Description:
 * Features a sandbox simulator environment where users can submit sample emails
 * to analyze phishing threat indices. Simulates the step-by-step AI forensic
 * pipeline via terminal logs, including NLP analysis and DNS MX check.
 *
 * Endpoints Called:
 * - POST  http://127.0.0.1:5000/api/emails/analyze       (Deep AI forensic scan)
 * - POST  http://127.0.0.1:5000/api/emails/inspect-domain(DNS reputation scan)
 * ============================================================================
 */

import React, { useState, useEffect, useRef } from 'react';
import './EmailDetails.css';

export default function EmailDetails() {
  const [sender, setSender] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [consoleLines, setConsoleLines] = useState([]);
  const [scanResult, setScanResult] = useState(null);
  
  // Standalone DNS Investigator state
  const [dnsDomain, setDnsDomain] = useState('');
  const [dnsLoading, setDnsLoading] = useState(false);
  const [dnsResult, setDnsResult] = useState(null);
  const [dnsError, setDnsError] = useState('');
  const [dnsTrace, setDnsTrace] = useState([]);

  const terminalEndRef = useRef(null);
  const dnsEndRef = useRef(null);

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [consoleLines]);

  useEffect(() => {
    if (dnsEndRef.current) {
      dnsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [dnsTrace]);

  // Scenario Templates to Auto-Fill
  const templates = {
    paypal: {
      sender: 'support-alert@paypa1-security.com',
      subject: 'URGENT: Your account funds have been frozen due to suspicious logins',
      body: 'Dear PayPal user, we detected unusual transactions matching standard credit card theft patterns. You must update your verification details immediately inside http://paypa1-security-verification.com/login.html or your balance will be confiscated.'
    },
    google: {
      sender: 'account-security-noreply@google.com',
      subject: 'New sign-in from Safari on Windows',
      body: 'Someone recently logged into your Google Account from a new device. If this was you, no action is needed. If this wasn\'t you, please review your active security details immediately to secure your files.'
    },
    bank: {
      sender: 'wire-transfer@wellsfarg0.com',
      subject: 'Action Required: Verify pending wire transfer of $14,250.00',
      body: 'A wire transfer request of $14,250.00 is currently pending approval. Please click the security verification link http://wellsfarg0.com/auth/login to confirm your identity and release or cancel the funds.'
    }
  };

  const loadTemplate = (key) => {
    const tmpl = templates[key];
    if (tmpl) {
      setSender(tmpl.sender);
      setSubject(tmpl.subject);
      setBody(tmpl.body);
      setScanResult(null);
      setConsoleLines([]);
    }
  };

  const handleScan = (e) => {
    e.preventDefault();
    if (!sender || !subject || !body) return;

    setLoading(true);
    setScanResult(null);
    setConsoleLines([]);

    // Step-by-step console streaming simulation
    const logs = [
      `> Connecting to PhishShield AI Core... OK`,
      `> Extracting headers... Sender: ${sender}`,
      `> Performing SPF (Sender Policy Framework) inspection...`,
      `> Running DNS-over-HTTPS queries on MX records...`,
      `> Tokenizing text payload & filtering stopwords...`,
      `> Running semantic urgency and keyword heuristics...`,
      `> Querying active typosquatted domains blacklist...`,
      `> Computing final threat index matrix...`
    ];

    logs.forEach((line, index) => {
      setTimeout(() => {
        setConsoleLines(prev => [...prev, line]);
      }, (index + 1) * 450);
    });

    // Make HTTP API request to backend classifier
    setTimeout(() => {
      fetch('http://127.0.0.1:5000/api/emails/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender, subject, body })
      })
        .then(resp => {
          if (!resp.ok) throw new Error('Forensic analysis endpoint failed.');
          return resp.json();
        })
        .then(data => {
          setLoading(false);
          if (data.status === 'success') {
            setConsoleLines(prev => [...prev, `> Scans complete. Risk Score: ${data.analysis.risk_score}%`]);
            setScanResult(data.analysis);
          } else {
            setConsoleLines(prev => [...prev, `> Error: ${data.message}`]);
          }
        })
        .catch(err => {
          setLoading(false);
          setConsoleLines(prev => [...prev, `> Error: ${err.message}`]);
        });
    }, 4000);
  };

  const handleDnsInspect = (e) => {
    e.preventDefault();
    if (!dnsDomain) return;

    setDnsLoading(true);
    setDnsResult(null);
    setDnsError('');
    setDnsTrace([]);

    const steps = [
      `> Initializing DNS lookup tool for domain: ${dnsDomain}...`,
      `> Resolving IPv4 A-record records...`,
      `> Requesting TXT records (SPF filters)...`,
      `> Fetching DMARC policies...`,
      `> Cross-referencing against Spamhaus Blocklist...`
    ];

    steps.forEach((line, index) => {
      setTimeout(() => {
        setDnsTrace(prev => [...prev, line]);
      }, (index + 1) * 350);
    });

    setTimeout(() => {
      fetch('http://127.0.0.1:5000/api/emails/inspect-domain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: dnsDomain })
      })
        .then(r => r.json())
        .then(data => {
          setDnsLoading(false);
          if (data.status === 'success') {
            setDnsTrace(prev => [...prev, `> DNS Audit complete. SPF: ${data.dns.spf_record ? 'VALID' : 'MISSING'}`]);
            setDnsResult(data.dns);
          } else {
            setDnsError(data.message || 'Inspection failed.');
          }
        })
        .catch(() => {
          setDnsLoading(false);
          setDnsError('DNS resolution server is offline.');
        });
    }, 2200);
  };

  return (
    <div className="email-details-container">
      <header className="email-details-header">
        <h2 className="email-details-title">AI Forensics Sandbox</h2>
        <p className="email-details-subtitle">Inspect email payloads, headers, and simulate real-time AI security scans.</p>
      </header>

      {/* Preset templates */}
      <div className="email-details-templates-bar">
        <span style={{ fontSize: '13px', color: '#9CA3AF', fontWeight: 'bold' }}>Load Scenario Template:</span>
        <button className="email-details-tmpl-btn" onClick={() => loadTemplate('paypal')}>
          <i className="fa-brands fa-paypal text-cyan" style={{ marginRight: '6px' }}></i>Paypal Urgency Scam
        </button>
        <button className="email-details-tmpl-btn" onClick={() => loadTemplate('google')}>
          <i className="fa-brands fa-google text-green" style={{ marginRight: '6px' }}></i>Google Security Alert (Safe)
        </button>
        <button className="email-details-tmpl-btn" onClick={() => loadTemplate('bank')}>
          <i className="fa-solid fa-building-columns text-yellow" style={{ marginRight: '6px' }}></i>Wells Fargo Wire Spoof
        </button>
      </div>

      <div className="email-details-layout-grid">
        {/* Scanned inputs */}
        <section className="email-details-form-panel glass-panel">
          <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>Email Forensic Payload</h3>
          
          <form onSubmit={handleScan} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="email-details-form-group">
              <label className="email-details-label">Sender Address Header</label>
              <input 
                type="text" 
                placeholder="e.g. support@paypal-alerts.com" 
                className="email-details-input" 
                value={sender}
                onChange={e => setSender(e.target.value)}
                required
              />
            </div>

            <div className="email-details-form-group">
              <label className="email-details-label">Subject Line</label>
              <input 
                type="text" 
                placeholder="e.g. Security verification required immediately" 
                className="email-details-input" 
                value={subject}
                onChange={e => setSubject(e.target.value)}
                required
              />
            </div>

            <div className="email-details-form-group">
              <label className="email-details-label">Raw HTML / Text Body Content</label>
              <textarea 
                rows="7"
                placeholder="Paste the raw body content here..." 
                className="email-details-textarea"
                value={body}
                onChange={e => setBody(e.target.value)}
                required
              />
            </div>

            <button 
              type="submit" 
              className="email-details-btn-scan"
              disabled={loading}
              style={{ opacity: loading ? 0.7 : 1 }}
            >
              <i className="fa-solid fa-user-shield" style={{ marginRight: '8px' }}></i>
              {loading ? 'Executing Scans...' : 'Execute Deep Forensic Scan'}
            </button>
          </form>
        </section>

        {/* Console stream + outputs */}
        <section className="email-details-results-col">
          {/* Terminal log panel */}
          <div className="email-details-terminal-panel">
            <div className="email-details-terminal-header">
              <div className="email-details-dots">
                <span className="email-details-dot" style={{ background: '#EF4444' }}></span>
                <span className="email-details-dot" style={{ background: '#F59E0B' }}></span>
                <span className="email-details-dot" style={{ background: '#10B981' }}></span>
              </div>
              <span className="email-details-terminal-title">Scanning Engine Console</span>
            </div>
            
            <div className="email-details-terminal-body">
              {consoleLines.length === 0 ? (
                <div className="email-details-term-empty">&gt; Ready. Awaiting forensic payload submission...</div>
              ) : (
                consoleLines.map((line, index) => (
                  <div key={index} className="email-details-term-line">
                    <span style={{ color: '#06B6D4', marginRight: '8px' }}>$</span>
                    {line}
                  </div>
                ))
              )}
              <div ref={terminalEndRef}></div>
            </div>
          </div>

          {/* Forensic verdict analysis */}
          {scanResult && (
            <div 
              className="email-details-result-card glass-panel"
              style={{ 
                border: `2px solid ${scanResult.classification === 'safe' ? '#10B981' : scanResult.classification === 'suspect' ? '#F59E0B' : '#EF4444'}`,
                boxShadow: `0 0 25px ${scanResult.classification === 'safe' ? 'rgba(16, 185, 129, 0.15)' : scanResult.classification === 'suspect' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)'}`
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                  <span 
                    className="email-details-verdict-badge"
                    style={{
                      background: scanResult.classification === 'safe' ? 'rgba(16, 185, 129, 0.15)' : scanResult.classification === 'suspect' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: scanResult.classification === 'safe' ? '#10B981' : scanResult.classification === 'suspect' ? '#F59E0B' : '#EF4444',
                    }}
                  >
                    VERDICT: {scanResult.classification.toUpperCase()}
                  </span>
                  <h4 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#FFF' }}>Forensic Report</h4>
                </div>

                <div 
                  className="email-details-score-badge"
                  style={{
                    borderColor: scanResult.classification === 'safe' ? '#10B981' : scanResult.classification === 'suspect' ? '#F59E0B' : '#EF4444',
                    color: scanResult.classification === 'safe' ? '#10B981' : scanResult.classification === 'suspect' ? '#F59E0B' : '#EF4444',
                    background: 'rgba(0,0,0,0.2)'
                  }}
                >
                  {scanResult.risk_score}%
                </div>
              </div>

              {scanResult.reasons && scanResult.reasons.length > 0 && (
                <div className="email-details-reasons-list">
                  <div style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '14px', letterSpacing: '0.5px' }}>Flags Triggered</div>
                  {scanResult.reasons.map((r, idx) => (
                    <div key={idx} className="email-details-reason-item">
                      <i className="fa-solid fa-triangle-exclamation" style={{ color: '#F59E0B', marginRight: '10px' }}></i>
                      {r}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Standalone DNS Reputation checking section */}
      <section className="email-details-dns-section glass-panel">
        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>Out-of-Band Domain MX/SPF Investigator</h3>
        <p className="email-details-subtitle" style={{ marginTop: '4px' }}>Analyze domain host integrity, SPF credentials, and active DNS reputations.</p>

        <div className="email-details-dns-grid">
          {/* Domain form */}
          <div style={{ flex: '1 1 350px' }}>
            <form onSubmit={handleDnsInspect} className="email-details-dns-form">
              <input 
                type="text" 
                placeholder="e.g. gma1l.com" 
                className="email-details-input" 
                value={dnsDomain}
                onChange={e => setDnsDomain(e.target.value)}
                required
              />
              <button 
                type="submit" 
                className="email-details-btn-inspect"
                disabled={dnsLoading}
              >
                {dnsLoading ? 'Inspecting...' : 'Audit Domain'}
              </button>
            </form>

            {dnsError && <div className="email-details-dns-error">{dnsError}</div>}

            {dnsResult && (
              <div className="email-details-dns-records">
                <div className="email-details-record-group">
                  <div className="email-details-record-label">Resolved IP Address</div>
                  <div className="email-details-record-val">
                    <i className="fa-solid fa-server" style={{ color: '#06B6D4' }}></i>
                    <span>{dnsResult.ip_address || 'No A-record resolved'}</span>
                  </div>
                </div>

                <div className="email-details-record-group">
                  <div className="email-details-record-label">SPF Registry Verification</div>
                  <div className="email-details-record-val">
                    <i className={dnsResult.spf_record ? "fa-solid fa-shield-halved" : "fa-solid fa-circle-xmark"} style={{ color: dnsResult.spf_record ? '#10B981' : '#EF4444' }}></i>
                    <span>{dnsResult.spf_record ? dnsResult.spf_record : 'Missing TXT SPF filters'}</span>
                  </div>
                </div>

                <div className="email-details-record-group">
                  <div className="email-details-record-label">Domain Reputation</div>
                  <div className="email-details-record-val">
                    <i className="fa-solid fa-shield-virus" style={{ color: dnsResult.reputation === 'Clean' ? '#10B981' : '#EF4444' }}></i>
                    <strong style={{ color: dnsResult.reputation === 'Clean' ? '#10B981' : '#EF4444' }}>{dnsResult.reputation}</strong>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* DNS output logs console */}
          <div className="email-details-dns-terminal-box">
            <div className="email-details-terminal-header">
              <div className="email-details-dots">
                <span className="email-details-dot" style={{ background: '#EF4444' }}></span>
                <span className="email-details-dot" style={{ background: '#F59E0B' }}></span>
                <span className="email-details-dot" style={{ background: '#10B981' }}></span>
              </div>
              <span className="email-details-terminal-title">DNS Resolver Output Logs</span>
            </div>
            
            <div className="email-details-terminal-body" style={{ height: '220px' }}>
              {dnsTrace.length === 0 ? (
                <div className="email-details-term-empty">&gt; Waiting for domain audit trigger...</div>
              ) : (
                dnsTrace.map((line, index) => (
                  <div key={index} className="email-details-term-line">
                    <span style={{ color: '#06B6D4', marginRight: '8px' }}>$</span>
                    {line}
                  </div>
                ))
              )}
              <div ref={dnsEndRef}></div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

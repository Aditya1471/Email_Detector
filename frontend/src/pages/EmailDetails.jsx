import React, { useState, useEffect, useRef } from 'react';

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
      subject: 'URGENT: Your account funds have been frozen due to suspicious billing logins',
      body: 'Dear PayPal user, we detected unusual transactions matching standard credit card theft patterns. You must update your verification details immediately inside http://paypa1-security-verification.com/login.html or your balance will be confiscated.'
    },
    netflix: {
      sender: 'noreply@netflix-invoice-verification.com',
      subject: 'Action Required: Your Netflix subscription fee payment was declined',
      body: 'Your Netflix account is currently suspended. Please visit http://netflix-billing-update.net to re-verify your credit card payment details immediately.'
    },
    safe: {
      sender: 'professor-advisor@university.edu',
      subject: 'Schedule guidelines for Q4 thesis reviews presentation files',
      body: 'Hello Class, please find attached the revised guidelines and timeline calendar documents for the upcoming final defense sessions. Let me know if you have questions.'
    }
  };

  const applyTemplate = (key) => {
    const t = templates[key];
    setSender(t.sender);
    setSubject(t.subject);
    setBody(t.body);
    setScanResult(null);
    setConsoleLines([]);
  };

  // Generate a random mock phishing scenario
  const handleRandomTemplate = () => {
    const banks = ['Chase Bank', 'Bank of America', 'Wells Fargo', 'Capital One'];
    const selectedBank = banks[Math.floor(Math.random() * banks.length)];
    const spoofDomain = `${selectedBank.toLowerCase().replace(/ /g, '')}-verification-portal.net`;
    
    setSender(`security-desk@${spoofDomain}`);
    setSubject(`URGENT NOTICE: Suspicious transactions flagged on your ${selectedBank} account`);
    setBody(`Dear customer, we detected access from an unrecognized IP address in Lagos, Nigeria. We blocked the request. To confirm your identity and prevent card locks, go to http://${spoofDomain}/verification/verify.html immediately.`);
    setScanResult(null);
    setConsoleLines([]);
  };

  const triggerScan = (e) => {
    e.preventDefault();
    if (!sender || !subject || !body) return;

    setLoading(true);
    setScanResult(null);
    setConsoleLines(["[SYSTEM] Initiating deep threat forensic auditor..."]);

    fetch('http://127.0.0.1:5000/api/emails/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender, subject, body }),
      credentials: 'include'
    })
      .then(r => {
        if (!r.ok) throw new Error('Analysis service is currently offline.');
        return r.json();
      })
      .then(data => {
        if (data.status === 'success') {
          animateTerminal(data.result);
        } else {
          throw new Error(data.message || 'Verification failed.');
        }
      })
      .catch(err => {
        setLoading(false);
        setConsoleLines(prev => [...prev, `[CRITICAL ERROR] ${err.message}`]);
      });
  };

  const animateTerminal = (result) => {
    const trace = result.forensic_trace || [];
    let idx = 0;
    
    const interval = setInterval(() => {
      if (idx < trace.length) {
        setConsoleLines(prev => [...prev, `[SCANNER] ${trace[idx]}`]);
        idx++;
      } else {
        clearInterval(interval);
        setConsoleLines(prev => [...prev, "[SYSTEM] Analysis complete. Rendering threat metrics dial."]);
        setScanResult(result);
        setLoading(false);
      }
    }, 280);
  };

  // Inspect domain via cloudflare DoH API
  const handleDomainInspect = (e) => {
    e.preventDefault();
    if (!dnsDomain) return;

    setDnsLoading(true);
    setDnsError('');
    setDnsResult(null);
    setDnsTrace(["[SYSTEM] Connecting Cloudflare DoH security gateway..."]);

    fetch('http://127.0.0.1:5000/api/emails/inspect-domain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: dnsDomain }),
      credentials: 'include'
    })
      .then(r => r.json())
      .then(data => {
        setDnsLoading(false);
        if (data.status === 'success') {
          setDnsResult(data);
          animateDnsTrace(data.trace);
        } else {
          setDnsError(data.message || 'Failed to resolve DNS records.');
        }
      })
      .catch(() => {
        setDnsLoading(false);
        setDnsError('Forensic domain audit failed.');
      });
  };

  const animateDnsTrace = (trace) => {
    let idx = 0;
    const interval = setInterval(() => {
      if (idx < trace.length) {
        setDnsTrace(prev => [...prev, `[RESOLVER] ${trace[idx]}`]);
        idx++;
      } else {
        clearInterval(interval);
        setDnsTrace(prev => [...prev, "[SYSTEM] Domain inspection resolved successfully."]);
      }
    }, 250);
  };

  const getRiskColor = (cls) => {
    if (cls === 'phishing') return '#EF4444';
    if (cls === 'suspect') return '#F59E0B';
    return '#10B981';
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h2 style={styles.title}>AI Forensic Threat Analyzer</h2>
        <p style={styles.subtitle}>Audit incoming mail payloads or inspect registry MX/SPF variables</p>
      </header>

      {/* Preset simulation template controls */}
      <div style={styles.templatesBar}>
        <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#9CA3AF' }}>Load Scenarios:</span>
        <button style={styles.tmplBtn} onClick={() => applyTemplate('paypal')}>
          <i className="fa-brands fa-paypal" style={{ marginRight: '6px', color: '#0070BA' }}></i>PayPal Spoof
        </button>
        <button style={styles.tmplBtn} onClick={() => applyTemplate('netflix')}>
          <i className="fa-solid fa-ticket" style={{ marginRight: '6px', color: '#E50914' }}></i>Netflix Hold
        </button>
        <button style={styles.tmplBtn} onClick={() => applyTemplate('safe')}>
          <i className="fa-solid fa-graduation-cap" style={{ marginRight: '6px', color: '#10B981' }}></i>Safe Advisory
        </button>
        <button style={{ ...styles.tmplBtn, background: 'rgba(6, 182, 212, 0.08)', borderColor: '#06B6D4' }} onClick={handleRandomTemplate}>
          <i className="fa-solid fa-shuffle" style={{ marginRight: '6px', color: '#06B6D4' }}></i>Generate Random Phish
        </button>
      </div>

      <div style={styles.layoutGrid}>
        {/* Email Threat Scan Form */}
        <section style={styles.formPanel} className="glass-panel">
          <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>Evaluate Raw Email Payload</h3>
          
          <form onSubmit={triggerScan}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Sender Field Header</label>
              <input 
                type="text" 
                style={styles.input} 
                placeholder="Sender email (e.g. security@paypal.com)"
                value={sender}
                onChange={e => setSender(e.target.value)}
                required
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Email Subject Title</label>
              <input 
                type="text" 
                style={styles.input} 
                placeholder="Message subject line"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                required
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Message Body Text</label>
              <textarea 
                style={styles.textarea} 
                placeholder="Paste the full email contents here..."
                rows="6"
                value={body}
                onChange={e => setBody(e.target.value)}
                required
              ></textarea>
            </div>

            <button 
              type="submit" 
              style={{ ...styles.btnScan, opacity: loading ? 0.7 : 1 }}
              disabled={loading}
            >
              <i className="fa-solid fa-user-shield" style={{ marginRight: '8px' }}></i>
              {loading ? 'Forensics Active...' : 'Trigger Threat Scan'}
            </button>
          </form>
        </section>

        {/* Diagnostic Console Panel */}
        <div style={styles.resultsCol}>
          <section style={styles.terminalPanel}>
            <div style={styles.terminalHeader}>
              <div style={styles.dots}>
                <span style={{ ...styles.dot, background: '#EF4444' }}></span>
                <span style={{ ...styles.dot, background: '#F59E0B' }}></span>
                <span style={{ ...styles.dot, background: '#10B981' }}></span>
              </div>
              <span style={styles.terminalTitle}>Forensic Analyzer Console Logs</span>
            </div>
            
            <div style={styles.terminalBody}>
              {consoleLines.length === 0 ? (
                <div style={styles.termEmpty}>
                  &gt; Waiting for scanner trigger...
                </div>
              ) : (
                consoleLines.map((line, index) => (
                  <div key={index} style={styles.termLine}>
                    <span style={{ color: '#06B6D4', marginRight: '8px' }}>$</span>
                    {line}
                  </div>
                ))
              )}
              <div ref={terminalEndRef}></div>
            </div>
          </section>

          {/* Glowing Verdict Results Card */}
          {scanResult && (
            <section 
              style={styles.resultCard} 
              className={`glass-panel glow-${scanResult.classification}`}
            >
              <div style={{ display: 'flex', justify: 'space-between', alignItems: 'center', marginBottom: '20px', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: '800' }}>Verification Score</h3>
                  <span style={{ fontSize: '12px', color: '#9CA3AF' }}>Interpreted Risk Verdict</span>
                </div>
                
                <div style={{
                  ...styles.scoreBadge,
                  borderColor: getRiskColor(scanResult.classification),
                  color: getRiskColor(scanResult.classification)
                }}>
                  {scanResult.risk_score}%
                </div>
              </div>

              <div style={{ 
                ...styles.verdictBadge,
                background: scanResult.classification === 'phishing' ? 'rgba(239, 68, 68, 0.12)' : scanResult.classification === 'suspect' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                color: getRiskColor(scanResult.classification)
              }}>
                VERDICT: {scanResult.classification.toUpperCase()}
              </div>

              {scanResult.reasons && scanResult.reasons.length > 0 && (
                <div style={styles.reasonsList}>
                  <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#FFF', marginBottom: '8px' }}>Security Threat Vectors:</div>
                  {scanResult.reasons.map((r, idx) => (
                    <div key={idx} style={styles.reasonItem}>
                      <i className="fa-solid fa-triangle-exclamation" style={{ color: getRiskColor(scanResult.classification), marginRight: '8px' }}></i>
                      {r}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      </div>

      {/* 5. INTERACTIVE DNS DOMAIN INSPECTOR */}
      <section style={styles.dnsSection} className="glass-panel">
        <h3 style={{ margin: '0 0 10px 0', fontSize: '18px', fontWeight: '700' }}>Forensic Domain DNS Investigator</h3>
        <p style={{ margin: '0 0 20px 0', color: '#9CA3AF', fontSize: '13.5px' }}>
          Directly audit live registry records (MX mail servers, SPF rules, and DMARC verification tags) for any domain name.
        </p>

        <div style={styles.dnsGrid}>
          {/* DNS Lookup Form */}
          <div style={{ flex: '1 1 300px' }}>
            <form onSubmit={handleDomainInspect} style={styles.dnsForm}>
              <input 
                type="text" 
                placeholder="Inspect domain (e.g. paypal.com, paypa1.com)" 
                style={styles.input}
                value={dnsDomain}
                onChange={e => setDnsDomain(e.target.value)}
                required
              />
              <button type="submit" style={styles.btnInspect} disabled={dnsLoading}>
                {dnsLoading ? 'Investigating...' : 'Audit Domain Records'}
              </button>
            </form>

            {dnsError && <div style={styles.dnsError}><i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '6px' }}></i>{dnsError}</div>}

            {dnsResult && (
              <div style={styles.dnsRecords}>
                <div style={styles.recordGroup}>
                  <div style={styles.recordLabel}>MX Mail Exchangers</div>
                  {dnsResult.mx_records.length === 0 ? (
                    <div style={{ color: '#EF4444', fontSize: '13px' }}><i className="fa-solid fa-ban"></i> No MX mail servers detected! Emails cannot be received.</div>
                  ) : (
                    dnsResult.mx_records.map((mx, i) => (
                      <div key={i} style={styles.recordVal}><i className="fa-solid fa-server text-cyan"></i> {mx}</div>
                    ))
                  )}
                </div>

                <div style={styles.recordGroup}>
                  <div style={styles.recordLabel}>SPF Registry Text Policy</div>
                  <div style={{ ...styles.recordVal, fontFamily: 'Share Tech Mono', fontSize: '12.5px', color: '#F59E0B' }}>
                    <i className="fa-solid fa-shield-halved"></i> {dnsResult.spf_record}
                  </div>
                </div>

                <div style={styles.recordGroup}>
                  <div style={styles.recordLabel}>DMARC Verification Target</div>
                  <div style={{ ...styles.recordVal, fontFamily: 'Share Tech Mono', fontSize: '12.5px', color: '#10B981' }}>
                    <i className="fa-solid fa-key"></i> {dnsResult.dmarc_record}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* DNS Resolver Trace Console */}
          <div style={styles.dnsTerminalBox}>
            <div style={styles.terminalHeader}>
              <div style={styles.dots}>
                <span style={{ ...styles.dot, background: '#EF4444' }}></span>
                <span style={{ ...styles.dot, background: '#F59E0B' }}></span>
                <span style={{ ...styles.dot, background: '#10B981' }}></span>
              </div>
              <span style={styles.terminalTitle}>DNS Resolver Output Logs</span>
            </div>
            
            <div style={{ ...styles.terminalBody, height: '220px' }}>
              {dnsTrace.length === 0 ? (
                <div style={styles.termEmpty}>
                  &gt; Waiting for domain audit trigger...
                </div>
              ) : (
                dnsTrace.map((line, index) => (
                  <div key={index} style={styles.termLine}>
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

const styles = {
  container: {
    padding: '40px',
    background: 'transparent',
    minHeight: '100vh'
  },
  header: {
    marginBottom: '24px'
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
  templatesBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    background: 'rgba(15, 23, 42, 0.45)',
    border: '1px solid rgba(255,255,255,0.06)',
    padding: '12px 20px',
    borderRadius: '12px',
    marginBottom: '32px',
    flexWrap: 'wrap'
  },
  tmplBtn: {
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    color: '#E5E7EB',
    padding: '8px 14px',
    borderRadius: '8px',
    fontWeight: '600',
    cursor: 'pointer',
    fontSize: '12.5px',
    transition: '0.2s',
    display: 'flex',
    alignItems: 'center'
  },
  layoutGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
    gap: '32px',
    alignItems: 'start',
    marginBottom: '32px'
  },
  formPanel: {
    padding: '32px',
    borderRadius: '16px'
  },
  formGroup: {
    marginBottom: '20px'
  },
  label: {
    display: 'block',
    fontSize: '12px',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    fontWeight: '700',
    marginBottom: '8px'
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    background: 'rgba(0, 0, 0, 0.25)',
    color: '#FFF',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.2s'
  },
  textarea: {
    width: '100%',
    padding: '14px 16px',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    background: 'rgba(0, 0, 0, 0.25)',
    color: '#FFF',
    fontSize: '14px',
    outline: 'none',
    fontFamily: 'inherit',
    lineHeight: '1.5',
    resize: 'none',
    transition: 'border-color 0.2s'
  },
  btnScan: {
    background: '#10B981',
    color: '#FFF',
    border: 'none',
    padding: '14px 28px',
    borderRadius: '8px',
    fontWeight: '800',
    cursor: 'pointer',
    fontSize: '14px',
    boxShadow: '0 0 15px rgba(16, 185, 129, 0.3)'
  },
  resultsCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '32px'
  },
  terminalPanel: {
    background: '#0B0D19',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    overflow: 'hidden'
  },
  terminalHeader: {
    background: 'rgba(255,255,255,0.02)',
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid rgba(255,255,255,0.05)'
  },
  dots: {
    display: 'flex',
    gap: '6px'
  },
  dot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%'
  },
  terminalTitle: {
    fontSize: '11px',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    fontWeight: '700',
    letterSpacing: '1px'
  },
  terminalBody: {
    padding: '20px',
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: '13px',
    color: '#10B981',
    height: '240px',
    overflowY: 'auto',
    lineHeight: '1.6'
  },
  termEmpty: {
    color: '#4B5563'
  },
  termLine: {
    marginBottom: '8px'
  },
  resultCard: {
    borderRadius: '16px',
    padding: '32px'
  },
  scoreBadge: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    border: '3px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '800',
    fontSize: '20px'
  },
  verdictBadge: {
    padding: '6px 14px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '800',
    letterSpacing: '1px',
    display: 'inline-block',
    marginBottom: '20px'
  },
  reasonsList: {
    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
    paddingTop: '20px'
  },
  reasonItem: {
    fontSize: '13.5px',
    color: '#D1D5DB',
    marginBottom: '10px',
    display: 'flex',
    alignItems: 'center'
  },
  dnsSection: {
    padding: '32px',
    borderRadius: '16px',
    marginTop: '10px'
  },
  dnsGrid: {
    display: 'flex',
    gap: '32px',
    flexWrap: 'wrap',
    marginTop: '20px'
  },
  dnsForm: {
    display: 'flex',
    gap: '12px',
    marginBottom: '24px'
  },
  btnInspect: {
    background: 'linear-gradient(135deg, #06B6D4 0%, #6366F1 100%)',
    color: '#FFF',
    border: 'none',
    padding: '12px 20px',
    borderRadius: '8px',
    fontWeight: '700',
    cursor: 'pointer',
    fontSize: '13.5px',
    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
    flexShrink: 0
  },
  dnsError: {
    background: 'rgba(239, 68, 68, 0.08)',
    border: '1px solid rgba(239, 68, 68, 0.15)',
    color: '#EF4444',
    padding: '12px',
    borderRadius: '8px',
    fontSize: '13.5px',
    marginBottom: '20px'
  },
  dnsRecords: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px'
  },
  recordGroup: {
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    paddingBottom: '14px'
  },
  recordLabel: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '6px'
  },
  recordVal: {
    fontSize: '14px',
    color: '#E5E7EB',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  dnsTerminalBox: {
    flex: '1 1 400px',
    background: '#0B0D19',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    overflow: 'hidden'
  }
};

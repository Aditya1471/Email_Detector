import React, { useState, useEffect, useRef } from 'react';

export default function EmailDetails() {
  const [sender, setSender] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [consoleLines, setConsoleLines] = useState([]);
  const [scanResult, setScanResult] = useState(null);
  
  const terminalEndRef = useRef(null);

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [consoleLines]);

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

  const triggerScan = (e) => {
    e.preventDefault();
    if (!sender || !subject || !body) return;

    setLoading(true);
    setScanResult(null);
    setConsoleLines(["[SYSTEM] Initiating deep threat forensic auditor..."]);

    fetch('http://localhost:5000/api/emails/analyze', {
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
    }, 280); // Typing animation delay
  };

  const getRiskColor = (cls) => {
    if (cls === 'phishing') return '#EF4444';
    if (cls === 'suspect') return '#F59E0B';
    return '#10B981';
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h2 style={styles.title}>Forensic Threat Scanner</h2>
        <p style={styles.subtitle}>Paste headers, subjects, and message bodies to run homoglyph and DNS scans</p>
      </header>

      {/* Preset templates selector */}
      <section style={styles.templatesBar}>
        <span style={{ fontSize: '13px', color: '#9CA3AF', fontWeight: 'bold' }}>Simulation Templates:</span>
        <button style={styles.tmplBtn} onClick={() => applyTemplate('paypal')}>
          <i className="fa-brands fa-paypal text-cyan" style={{ marginRight: '6px' }}></i>PayPal Spoof
        </button>
        <button style={styles.tmplBtn} onClick={() => applyTemplate('netflix')}>
          <i className="fa-solid fa-film text-warning" style={{ marginRight: '6px' }}></i>Netflix Billing
        </button>
        <button style={styles.tmplBtn} onClick={() => applyTemplate('safe')}>
          <i className="fa-solid fa-graduation-cap text-safe" style={{ marginRight: '6px' }}></i>Academic Safe
        </button>
      </section>

      <div style={styles.layoutGrid}>
        {/* Scanner Form Panel */}
        <section style={styles.formPanel} className="glass-panel">
          <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>Email Lexical Details</h3>
          
          <form onSubmit={triggerScan}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Sender Address</label>
              <input 
                type="text" 
                style={styles.input} 
                placeholder="e.g. billing-support@paypal.com"
                value={sender}
                onChange={e => setSender(e.target.value)}
                required
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Subject Line</label>
              <input 
                type="text" 
                style={styles.input} 
                placeholder="e.g. Account suspended immediately"
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

        {/* Console / Results display column */}
        <div style={styles.resultsCol}>
          {/* Diagnostic Console Panel */}
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

          {/* Glowing Result Card */}
          {scanResult && (
            <section 
              style={styles.resultCard} 
              className={`glass-panel glow-${scanResult.classification}`}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
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
    </div>
  );
}

const styles = {
  container: {
    padding: '40px',
    background: '#080A10',
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
    background: '#0F1322',
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
    alignItems: 'start'
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
    background: 'linear-gradient(135deg, #06B6D4 0%, #6366F1 100%)',
    color: '#FFF',
    border: 'none',
    padding: '14px 28px',
    borderRadius: '8px',
    fontWeight: '700',
    cursor: 'pointer',
    width: '100%',
    boxShadow: '0 4px 15px rgba(99, 102, 241, 0.35)',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '12px'
  },
  resultsCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px'
  },
  terminalPanel: {
    background: '#04070D',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '12px',
    overflow: 'hidden'
  },
  terminalHeader: {
    background: '#0F121C',
    padding: '10px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
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
    fontFamily: 'monospace',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  terminalBody: {
    padding: '20px',
    height: '240px',
    overflowY: 'auto',
    fontFamily: 'monospace',
    fontSize: '12px',
    color: '#34D399',
    lineHeight: '1.6',
    textAlign: 'left'
  },
  termEmpty: {
    color: '#4B5563'
  },
  termLine: {
    marginBottom: '6px',
    wordBreak: 'break-all'
  },
  resultCard: {
    borderRadius: '16px',
    padding: '28px'
  },
  scoreBadge: {
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    border: '3px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    fontWeight: '800'
  },
  verdictBadge: {
    padding: '8px 16px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: '800',
    letterSpacing: '1px',
    textAlign: 'center',
    marginBottom: '20px',
    border: '1px solid rgba(255,255,255,0.04)'
  },
  reasonsList: {
    background: 'rgba(0, 0, 0, 0.2)',
    border: '1px solid rgba(255,255,255,0.04)',
    padding: '16px',
    borderRadius: '8px'
  },
  reasonItem: {
    fontSize: '12.5px',
    color: '#D1D5DB',
    display: 'flex',
    alignItems: 'center',
    marginTop: '8px',
    lineHeight: '1.4'
  }
};

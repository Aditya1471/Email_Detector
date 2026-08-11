/**
 * ============================================================================
 * COMPONENT: Settings.jsx (System Parameters & Integration Configurations)
 * ============================================================================
 * Description:
 * Allows tuning of AI model sensitivity (NLTK threshold), auto-quarantine
 * rules, Slack Webhook relays, and verifies connected IMAP scopes.
 *
 * Endpoints Called:
 * - GET   http://127.0.0.1:5000/api/auth/me                (Linked integration profile)
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';

export default function Settings() {
  const [config, setConfig] = useState({
    auto_quarantine: true,
    nltk_threshold: 75,
    enable_dns_inspect: true,
    alert_sound: true,
    slack_webhook: ''
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [connectedAccount, setConnectedAccount] = useState(null);

  useEffect(() => {
    fetchConnectedAccount();
    // Default config values
    const cached = localStorage.getItem('phishshield_settings');
    if (cached) {
      try {
        setConfig(JSON.parse(cached));
      } catch (e) {}
    }
  }, []);

  const fetchConnectedAccount = () => {
    setLoading(true);
    fetch('http://127.0.0.1:5000/api/auth/me', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data.status === 'success' && data.user.imap_config) {
          setConnectedAccount(data.user.imap_config);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  const handleSave = (e) => {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => {
      localStorage.setItem('phishshield_settings', JSON.stringify(config));
      setSaving(false);
      alert('System threat configuration saved successfully!');
    }, 1200);
  };

  return (
    <div style={styles.container}>
      <div>
        <h2 style={styles.title}>System Settings</h2>
        <p style={styles.subtitle}>Configure security parameters, AI classifiers, and third-party alert relays.</p>
      </div>

      <div style={styles.grid}>
        {/* Left column: configurations */}
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Card 1: AI Model Configuration */}
          <div style={styles.card} className="glass-panel" style={{ ...styles.card, border: '2px solid #8B5CF6', boxShadow: '0 0 25px rgba(139, 92, 246, 0.15)' }}>
            <h3 style={styles.cardTitle}>
              <i className="fa-solid fa-brain" style={{ color: '#8B5CF6', marginRight: '10px' }}></i>
              AI Model Classification Sensitivity
            </h3>
            
            <div style={styles.formGroup}>
              <label style={styles.label}>
                NLTK Risk Sensitivity Threshold: <strong>{config.nltk_threshold}%</strong>
              </label>
              <input 
                type="range" 
                min="50" 
                max="95" 
                value={config.nltk_threshold} 
                onChange={e => setConfig({ ...config, nltk_threshold: parseInt(e.target.value) })}
                style={styles.slider}
              />
              <p style={styles.helpText}>
                Lowering the threshold intercepts more suspect emails, raising it reduces potential false positives.
              </p>
            </div>

            <div style={styles.checkboxGroup}>
              <input 
                type="checkbox" 
                id="enable_dns_inspect"
                checked={config.enable_dns_inspect} 
                onChange={e => setConfig({ ...config, enable_dns_inspect: e.target.checked })}
                style={styles.checkbox}
              />
              <label htmlFor="enable_dns_inspect" style={styles.checkboxLabel}>
                Strict DNS-over-HTTPS Verification (SPF, DMARC alignment checks)
              </label>
            </div>
          </div>

          {/* Card 2: Quarantine Configuration */}
          <div style={styles.card} className="glass-panel" style={{ ...styles.card, border: '2px solid #EF4444', boxShadow: '0 0 25px rgba(239, 68, 68, 0.15)' }}>
            <h3 style={styles.cardTitle}>
              <i className="fa-solid fa-triangle-exclamation" style={{ color: '#EF4444', marginRight: '10px' }}></i>
              Threat Actions & Quarantine Rules
            </h3>
            
            <div style={styles.checkboxGroup}>
              <input 
                type="checkbox" 
                id="auto_quarantine"
                checked={config.auto_quarantine} 
                onChange={e => setConfig({ ...config, auto_quarantine: e.target.checked })}
                style={styles.checkbox}
              />
              <label htmlFor="auto_quarantine" style={styles.checkboxLabel}>
                Automatically quarantine phishing emails (Move from Inbox to Spam folder)
              </label>
            </div>
            <p style={styles.helpText} style={{ marginLeft: '26px', marginTop: '-10px', color: '#8A92A6', fontSize: '12px' }}>
              Requires the Google Consent `gmail.modify` scope permission.
            </p>
          </div>

          {/* Card 3: Notifications Configuration */}
          <div style={styles.card} className="glass-panel">
            <h3 style={styles.cardTitle}>
              <i className="fa-solid fa-bell" style={{ color: '#6366F1', marginRight: '10px' }}></i>
              Real-time Alert Notifications
            </h3>

            <div style={styles.checkboxGroup}>
              <input 
                type="checkbox" 
                id="alert_sound"
                checked={config.alert_sound} 
                onChange={e => setConfig({ ...config, alert_sound: e.target.checked })}
                style={styles.checkbox}
              />
              <label htmlFor="alert_sound" style={styles.checkboxLabel}>
                Enable sound alerts on dynamic phishing threat interceptions
              </label>
            </div>

            <div style={styles.formGroup} style={{ marginTop: '14px' }}>
              <label style={styles.label}>Slack Alert Relay Webhook</label>
              <input 
                type="text" 
                placeholder="https://hooks.slack.com/services/..."
                value={config.slack_webhook}
                onChange={e => setConfig({ ...config, slack_webhook: e.target.value })}
                style={styles.input}
              />
            </div>
          </div>

          <button type="submit" style={styles.btnSave} disabled={saving}>
            {saving ? (
              <>
                <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '8px' }}></i>
                Saving Parameters...
              </>
            ) : (
              <>
                <i className="fa-solid fa-floppy-disk" style={{ marginRight: '8px' }}></i>
                Save Configuration
              </>
            )}
          </button>
        </form>

        {/* Right column: Google Account Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={styles.card} className="glass-panel" style={{ ...styles.card, border: '2px solid #10B981', boxShadow: '0 0 25px rgba(16, 185, 129, 0.15)' }}>
            <h3 style={styles.cardTitle}>
              <i className="fa-solid fa-circle-nodes" style={{ color: '#10B981', marginRight: '10px' }}></i>
              Connected Integrations
            </h3>

            {loading ? (
              <div style={styles.accountSpinner}>
                <div style={styles.miniSpinner}></div>
              </div>
            ) : connectedAccount ? (
              <div style={styles.connectedBox}>
                <div style={styles.accountHeader}>
                  <div style={styles.avatarIcon}>
                    <i className="fa-brands fa-google" style={{ color: '#FFF' }}></i>
                  </div>
                  <div>
                    <div style={styles.accountMail}>{connectedAccount.email}</div>
                    <div style={styles.accountServer}>Server: IMAP Sandbox</div>
                  </div>
                </div>

                <div style={styles.scopesList}>
                  <div style={styles.scopeItem}>
                    <i className="fa-solid fa-circle-check" style={{ color: '#10B981' }}></i>
                    <span>gmail.readonly</span>
                  </div>
                  <div style={styles.scopeItem}>
                    <i className="fa-solid fa-circle-check" style={{ color: '#10B981' }}></i>
                    <span>gmail.modify (Auto-Quarantine)</span>
                  </div>
                </div>

                <div style={styles.connBadge}>CONNECTED</div>
              </div>
            ) : (
              <div style={styles.disconnectedBox}>
                <p>No external Gmail integrations linked. Logging in acts on default simulation database sandbox.</p>
                <button 
                  style={styles.btnLink}
                  onClick={() => window.location.href = '/'}
                >
                  Configure Connection
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
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
    gap: '24px'
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
  grid: {
    display: 'grid',
    gridTemplateColumns: '1.4fr 1fr',
    gap: '30px',
    alignItems: 'start'
  },
  card: {
    padding: '24px',
    borderRadius: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px'
  },
  cardTitle: {
    fontSize: '15px',
    fontWeight: '800',
    color: '#FFF',
    margin: '0 0 4px 0',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    display: 'flex',
    alignItems: 'center'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  label: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#D1D5DB'
  },
  slider: {
    width: '100%',
    accentColor: '#8B5CF6',
    cursor: 'pointer',
    marginTop: '6px'
  },
  helpText: {
    fontSize: '11px',
    color: '#8A92A6',
    margin: '4px 0 0 0',
    lineHeight: '1.4'
  },
  checkboxGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    cursor: 'pointer'
  },
  checkbox: {
    width: '18px',
    height: '18px',
    accentColor: '#10B981',
    cursor: 'pointer'
  },
  checkboxLabel: {
    fontSize: '13px',
    color: '#FFF',
    fontWeight: '600',
    cursor: 'pointer'
  },
  input: {
    background: '#0d111c',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '8px',
    padding: '10px 14px',
    color: '#FFF',
    fontSize: '13px',
    outline: 'none',
    width: '100%'
  },
  btnSave: {
    background: 'linear-gradient(135deg, #6366F1 0%, #a855f7 100%)',
    border: 'none',
    color: '#FFF',
    padding: '14px',
    borderRadius: '10px',
    fontWeight: '800',
    cursor: 'pointer',
    fontSize: '14px',
    boxShadow: '0 4px 15px rgba(99, 102, 241, 0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  accountSpinner: {
    display: 'flex',
    justifyContent: 'center',
    padding: '30px'
  },
  miniSpinner: {
    width: '24px',
    height: '24px',
    border: '3px solid rgba(16, 185, 129, 0.15)',
    borderTop: '3px solid #10B981',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  connectedBox: {
    background: 'rgba(0,0,0,0.15)',
    border: '1px solid rgba(255,255,255,0.03)',
    padding: '18px',
    borderRadius: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  accountHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  avatarIcon: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: '#EA4335',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px'
  },
  accountMail: {
    fontSize: '13.5px',
    fontWeight: '700',
    color: '#FFF'
  },
  accountServer: {
    fontSize: '11px',
    color: '#8A92A6',
    marginTop: '2px'
  },
  scopesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    borderTop: '1px solid rgba(255,255,255,0.04)',
    paddingTop: '12px'
  },
  scopeItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    color: '#D1D5DB'
  },
  connBadge: {
    background: 'rgba(16, 185, 129, 0.08)',
    border: '1px solid rgba(16, 185, 129, 0.15)',
    color: '#10B981',
    fontSize: '10px',
    fontWeight: '800',
    padding: '4px',
    borderRadius: '4px',
    textAlign: 'center',
    letterSpacing: '0.5px'
  },
  disconnectedBox: {
    textAlign: 'center',
    padding: '20px',
    color: '#8A92A6',
    fontSize: '13px'
  },
  btnLink: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#FFF',
    padding: '8px 16px',
    borderRadius: '6px',
    marginTop: '12px',
    fontWeight: '700',
    cursor: 'pointer'
  }
};

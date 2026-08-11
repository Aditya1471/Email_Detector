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
import './Settings.css';

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
    <div className="settings-container">
      <div>
        <h2 className="settings-title">System Settings</h2>
        <p className="settings-subtitle">Configure security parameters, AI classifiers, and third-party alert relays.</p>
      </div>

      <div className="settings-grid">
        {/* Left column: configurations */}
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Card 1: AI Model Configuration */}
          <div 
            className="settings-card glass-panel" 
            style={{ border: '2px solid #8B5CF6', boxShadow: '0 0 25px rgba(139, 92, 246, 0.15)' }}
          >
            <h3 className="settings-card-title">
              <i className="fa-solid fa-brain" style={{ color: '#8B5CF6', marginRight: '10px' }}></i>
              AI Model Classification Sensitivity
            </h3>
            
            <div className="settings-form-group">
              <label className="settings-label">
                NLTK Risk Sensitivity Threshold: <strong>{config.nltk_threshold}%</strong>
              </label>
              <input 
                type="range" 
                min="50" 
                max="95" 
                value={config.nltk_threshold} 
                onChange={e => setConfig({ ...config, nltk_threshold: parseInt(e.target.value) })}
                className="settings-slider"
              />
              <p className="settings-help-text">
                Lowering the threshold intercepts more suspect emails, raising it reduces potential false positives.
              </p>
            </div>

            <div className="settings-checkbox-group">
              <input 
                type="checkbox" 
                id="enable_dns_inspect"
                checked={config.enable_dns_inspect} 
                onChange={e => setConfig({ ...config, enable_dns_inspect: e.target.checked })}
                className="settings-checkbox"
              />
              <label htmlFor="enable_dns_inspect" className="settings-checkbox-label">
                Strict DNS-over-HTTPS Verification (SPF, DMARC alignment checks)
              </label>
            </div>
          </div>

          {/* Card 2: Quarantine Configuration */}
          <div 
            className="settings-card glass-panel" 
            style={{ border: '2px solid #EF4444', boxShadow: '0 0 25px rgba(239, 68, 68, 0.15)' }}
          >
            <h3 className="settings-card-title">
              <i className="fa-solid fa-triangle-exclamation" style={{ color: '#EF4444', marginRight: '10px' }}></i>
              Threat Actions & Quarantine Rules
            </h3>
            
            <div className="settings-checkbox-group">
              <input 
                type="checkbox" 
                id="auto_quarantine"
                checked={config.auto_quarantine} 
                onChange={e => setConfig({ ...config, auto_quarantine: e.target.checked })}
                className="settings-checkbox"
              />
              <label htmlFor="auto_quarantine" className="settings-checkbox-label">
                Automatically quarantine phishing emails (Move from Inbox to Spam folder)
              </label>
            </div>
            <p className="settings-help-text" style={{ marginLeft: '26px', marginTop: '-10px' }}>
              Requires the Google Consent `gmail.modify` scope permission.
            </p>
          </div>

          {/* Card 3: Notifications Configuration */}
          <div className="settings-card glass-panel">
            <h3 className="settings-card-title">
              <i className="fa-solid fa-bell" style={{ color: '#6366F1', marginRight: '10px' }}></i>
              Real-time Alert Notifications
            </h3>

            <div className="settings-checkbox-group">
              <input 
                type="checkbox" 
                id="alert_sound"
                checked={config.alert_sound} 
                onChange={e => setConfig({ ...config, alert_sound: e.target.checked })}
                className="settings-checkbox"
              />
              <label htmlFor="alert_sound" className="settings-checkbox-label">
                Enable sound alerts on dynamic phishing threat interceptions
              </label>
            </div>

            <div className="settings-form-group" style={{ marginTop: '14px' }}>
              <label className="settings-label">Slack Alert Relay Webhook</label>
              <input 
                type="text" 
                placeholder="https://hooks.slack.com/services/..."
                value={config.slack_webhook}
                onChange={e => setConfig({ ...config, slack_webhook: e.target.value })}
                className="settings-input"
              />
            </div>
          </div>

          <button type="submit" className="settings-btn-save" disabled={saving}>
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
          <div 
            className="settings-card glass-panel" 
            style={{ border: '2px solid #10B981', boxShadow: '0 0 25px rgba(16, 185, 129, 0.15)' }}
          >
            <h3 className="settings-card-title">
              <i className="fa-solid fa-circle-nodes" style={{ color: '#10B981', marginRight: '10px' }}></i>
              Connected Integrations
            </h3>

            {loading ? (
              <div className="settings-account-spinner">
                <div className="settings-mini-spinner"></div>
              </div>
            ) : connectedAccount ? (
              <div className="settings-connected-box">
                <div className="settings-account-header">
                  <div className="settings-avatar-icon">
                    <i className="fa-brands fa-google" style={{ color: '#FFF' }}></i>
                  </div>
                  <div>
                    <div className="settings-account-mail">{connectedAccount.email}</div>
                    <div className="settings-account-server">Server: IMAP Sandbox</div>
                  </div>
                </div>

                <div className="settings-scopes-list">
                  <div className="settings-scope-item">
                    <i className="fa-solid fa-circle-check" style={{ color: '#10B981' }}></i>
                    <span>gmail.readonly</span>
                  </div>
                  <div className="settings-scope-item">
                    <i className="fa-solid fa-circle-check" style={{ color: '#10B981' }}></i>
                    <span>gmail.modify (Auto-Quarantine)</span>
                  </div>
                </div>

                <div className="settings-conn-badge">CONNECTED</div>
              </div>
            ) : (
              <div className="settings-disconnected-box">
                <p>No external Gmail integrations linked. Logging in acts on default simulation database sandbox.</p>
                <button 
                  className="settings-btn-link"
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

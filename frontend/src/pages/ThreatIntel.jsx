/**
 * ============================================================================
 * COMPONENT: ThreatIntel.jsx (Live Threat Intelligence Feeds)
 * ============================================================================
 * Description:
 * Displays active typosquatted brand targets, monitored NLP keywords,
 * and current reputations of IP reputation relays.
 * ============================================================================
 */

import React from 'react';
import './ThreatIntel.css';

export default function ThreatIntel() {
  const trendingThreats = [
    { domain: 'gma1l.com', target: 'gmail.com', type: 'Typosquatting', severity: 'Critical' },
    { domain: 'paypa1.support-secure.com', target: 'paypal.com', type: 'Phishing Landing', severity: 'Critical' },
    { domain: 'wellsfarg0.com', target: 'wellsfargo.com', type: 'Credential Harvesting', severity: 'High' },
    { domain: 'micr0s0ft-security.net', target: 'microsoft.com', type: 'Brand Spoof', severity: 'High' },
    { domain: 'netflix-update-billing.org', target: 'netflix.com', type: 'Billing Scam', severity: 'Medium' }
  ];

  const forensicKeywords = [
    'urgent payment', 'verify bank details', 'unauthorized access', 
    'action required immediately', 'suspended account', 'reset security credentials',
    'security alert login', 'package delivery failure', 'inheritance fund'
  ];

  return (
    <div className="threat-intel-container">
      <div className="threat-intel-header">
        <div>
          <h2 className="threat-intel-title">Threat Intelligence</h2>
          <p className="threat-intel-subtitle">Real-time cyber threat feeds, monitored brands, and blacklisted heuristics.</p>
        </div>
      </div>

      <div className="threat-intel-grid">
        {/* Left column: domain monitoring */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Card 1: Domain Typosquatting Watch */}
          <div 
            className="threat-intel-card glass-panel" 
            style={{ border: '2px solid #EF4444', boxShadow: '0 0 25px rgba(239, 68, 68, 0.15)' }}
          >
            <h3 className="threat-intel-card-title">
              <i className="fa-solid fa-skull-crossbones" style={{ color: '#EF4444', marginRight: '10px' }}></i>
              Active Typosquatted Domains Watchlist
            </h3>
            
            <div className="threat-intel-list">
              {trendingThreats.map((t, idx) => (
                <div key={idx} className="threat-intel-item">
                  <div>
                    <div className="threat-intel-domain">{t.domain}</div>
                    <div className="threat-intel-details">
                      <span>Target: <strong>{t.target}</strong></span>
                      <span style={{ margin: '0 6px' }}>•</span>
                      <span>Type: <strong>{t.type}</strong></span>
                    </div>
                  </div>
                  <span 
                    className="threat-intel-badge"
                    style={{
                      background: t.severity === 'Critical' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                      color: t.severity === 'Critical' ? '#EF4444' : '#F59E0B',
                      border: `1px solid ${t.severity === 'Critical' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`
                    }}
                  >
                    {t.severity}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column: NLP & blacklists */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Card 2: NLP Heuristics Monitored */}
          <div 
            className="threat-intel-card glass-panel" 
            style={{ border: '2px solid #8B5CF6', boxShadow: '0 0 25px rgba(139, 92, 246, 0.15)' }}
          >
            <h3 className="threat-intel-card-title">
              <i className="fa-solid fa-language" style={{ color: '#8B5CF6', marginRight: '10px' }}></i>
              AI Monitored Speech Vectors
            </h3>
            <p className="threat-intel-description">
              NLP key phrases that trigger confidence weight increases in the classification model:
            </p>

            <div className="threat-intel-keywords-grid">
              {forensicKeywords.map((k, idx) => (
                <span key={idx} className="threat-intel-keyword-tag">
                  <i className="fa-solid fa-magnifying-glass" style={{ color: '#8B5CF6', marginRight: '6px', fontSize: '10px' }}></i>
                  {k}
                </span>
              ))}
            </div>
          </div>

          {/* Card 3: Reputation Servers */}
          <div className="threat-intel-card glass-panel">
            <h3 className="threat-intel-card-title">
              <i className="fa-solid fa-server" style={{ color: '#6366F1', marginRight: '10px' }}></i>
              Active IP Reputation Realays
            </h3>
            <div className="threat-intel-server-item">
              <div className="threat-intel-server-meta">
                <span className="threat-intel-server-dot"></span>
                <span>Cloudflare DNS DoH Resolver</span>
              </div>
              <span className="threat-intel-server-status">ONLINE</span>
            </div>
            <div className="threat-intel-server-item">
              <div className="threat-intel-server-meta">
                <span className="threat-intel-server-dot"></span>
                <span>Spamhaus IP Blacklist API</span>
              </div>
              <span className="threat-intel-server-status">ONLINE</span>
            </div>
            <div className="threat-intel-server-item">
              <div className="threat-intel-server-meta">
                <span className="threat-intel-server-dot"></span>
                <span>Barracuda Reputation Blocklist</span>
              </div>
              <span className="threat-intel-server-status">ONLINE</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

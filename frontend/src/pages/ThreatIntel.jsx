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
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Threat Intelligence</h2>
          <p style={styles.subtitle}>Real-time cyber threat feeds, monitored brands, and blacklisted heuristics.</p>
        </div>
      </div>

      <div style={styles.grid}>
        {/* Left column: domain monitoring */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Card 1: Domain Typosquatting Watch */}
          <div style={styles.card} className="glass-panel" style={{ ...styles.card, border: '2px solid #EF4444', boxShadow: '0 0 25px rgba(239, 68, 68, 0.15)' }}>
            <h3 style={styles.cardTitle}>
              <i className="fa-solid fa-skull-crossbones" style={{ color: '#EF4444', marginRight: '10px' }}></i>
              Active Typosquatted Domains Watchlist
            </h3>
            
            <div style={styles.threatList}>
              {trendingThreats.map((t, idx) => (
                <div key={idx} style={styles.threatItem}>
                  <div>
                    <div style={styles.threatDomain}>{t.domain}</div>
                    <div style={styles.threatDetails}>
                      <span>Target: <strong>{t.target}</strong></span>
                      <span style={{ margin: '0 6px' }}>•</span>
                      <span>Type: <strong>{t.type}</strong></span>
                    </div>
                  </div>
                  <span style={{
                    ...styles.badge,
                    background: t.severity === 'Critical' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                    color: t.severity === 'Critical' ? '#EF4444' : '#F59E0B',
                    border: `1px solid ${t.severity === 'Critical' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`
                  }}>
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
          <div style={styles.card} className="glass-panel" style={{ ...styles.card, border: '2px solid #8B5CF6', boxShadow: '0 0 25px rgba(139, 92, 246, 0.15)' }}>
            <h3 style={styles.cardTitle}>
              <i className="fa-solid fa-language" style={{ color: '#8B5CF6', marginRight: '10px' }}></i>
              AI Monitored Speech Vectors
            </h3>
            <p style={styles.description}>
              NLP key phrases that trigger confidence weight increases in the classification model:
            </p>

            <div style={styles.keywordsGrid}>
              {forensicKeywords.map((k, idx) => (
                <span key={idx} style={styles.keywordTag}>
                  <i className="fa-solid fa-magnifying-glass" style={{ color: '#8B5CF6', marginRight: '6px', fontSize: '10px' }}></i>
                  {k}
                </span>
              ))}
            </div>
          </div>

          {/* Card 3: Reputation Servers */}
          <div style={styles.card} className="glass-panel">
            <h3 style={styles.cardTitle}>
              <i className="fa-solid fa-server" style={{ color: '#6366F1', marginRight: '10px' }}></i>
              Active IP Reputation Realays
            </h3>
            <div style={styles.serverItem}>
              <div style={styles.serverMeta}>
                <span style={styles.serverDot}></span>
                <span>Cloudflare DNS DoH Resolver</span>
              </div>
              <span style={styles.serverStatus}>ONLINE</span>
            </div>
            <div style={styles.serverItem}>
              <div style={styles.serverMeta}>
                <span style={styles.serverDot}></span>
                <span>Spamhaus IP Blacklist API</span>
              </div>
              <span style={styles.serverStatus}>ONLINE</span>
            </div>
            <div style={styles.serverItem}>
              <div style={styles.serverMeta}>
                <span style={styles.serverDot}></span>
                <span>Barracuda Reputation Blocklist</span>
              </div>
              <span style={styles.serverStatus}>ONLINE</span>
            </div>
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
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
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
    gridTemplateColumns: '1.2fr 1fr',
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
  description: {
    fontSize: '13px',
    color: '#8A92A6',
    margin: '0',
    lineHeight: '1.4'
  },
  threatList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px'
  },
  threatItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'rgba(0,0,0,0.15)',
    border: '1px solid rgba(255,255,255,0.03)',
    borderRadius: '10px',
    padding: '14px 16px'
  },
  threatDomain: {
    fontSize: '13.5px',
    fontWeight: '700',
    color: '#FFF'
  },
  threatDetails: {
    fontSize: '11px',
    color: '#8A92A6',
    marginTop: '4px'
  },
  badge: {
    padding: '4px 8px',
    borderRadius: '6px',
    fontSize: '10.5px',
    fontWeight: '800',
    letterSpacing: '0.3px',
    textTransform: 'uppercase'
  },
  keywordsGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginTop: '8px'
  },
  keywordTag: {
    background: 'rgba(139, 92, 246, 0.08)',
    border: '1px solid rgba(139, 92, 246, 0.15)',
    color: '#D1D5DB',
    padding: '6px 12px',
    borderRadius: '6px',
    fontSize: '11.5px',
    fontWeight: '600',
    display: 'inline-flex',
    alignItems: 'center'
  },
  serverItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid rgba(255,255,255,0.03)',
    paddingBottom: '12px'
  },
  serverMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '13px',
    color: '#FFF'
  },
  serverDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#10B981',
    boxShadow: '0 0 8px #10B981'
  },
  serverStatus: {
    fontSize: '10.5px',
    fontWeight: '800',
    color: '#10B981',
    letterSpacing: '0.3px'
  }
};

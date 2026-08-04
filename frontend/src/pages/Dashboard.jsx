import React from 'react';

export default function Dashboard() {
  return (
    <div style={styles.container}>
      <h2 style={styles.title}>AI Phishing Detection Center</h2>
      <p style={styles.subtitle}>Real-time email scanning, verification, and fake sender protection dashboard</p>
      
      <div style={styles.grid}>
        <div style={styles.card}>
          <div style={styles.label}>Emails Checked</div>
          <div style={styles.value}>0</div>
        </div>
        <div style={styles.card}>
          <div style={styles.label}>Phishing Threats</div>
          <div style={{ ...styles.value, color: '#EF4444' }}>0</div>
        </div>
        <div style={styles.card}>
          <div style={styles.label}>Safe Emails</div>
          <div style={{ ...styles.value, color: '#10B981' }}>0</div>
        </div>
      </div>
      
      <div style={styles.panel}>
        <h3>Recent Scan Results</h3>
        <p style={{ color: '#9CA3AF', fontSize: '13px' }}>No emails scanned yet. Connect your Gmail mailbox to start background sync.</p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: '40px',
    background: '#0A0D14',
    minHeight: '100vh',
    fontFamily: 'sans-serif',
    color: '#FFF'
  },
  title: {
    fontSize: '28px',
    fontWeight: '700',
    marginBottom: '8px',
    color: '#06B6D4'
  },
  subtitle: {
    color: '#9CA3AF',
    fontSize: '14px',
    marginBottom: '32px'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '20px',
    marginBottom: '32px'
  },
  card: {
    padding: '24px',
    background: 'rgba(22, 28, 45, 0.85)',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.08)'
  },
  label: {
    fontSize: '13px',
    color: '#9CA3AF',
    marginBottom: '8px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  value: {
    fontSize: '32px',
    fontWeight: '700'
  },
  panel: {
    padding: '24px',
    background: 'rgba(22, 28, 45, 0.85)',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.08)'
  }
};

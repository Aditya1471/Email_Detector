import React from 'react';

export default function Reports() {
  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Threat Reports Exporter</h2>
      <p style={styles.subtitle}>Download formatted PDF and Excel logs for a specific audit duration</p>
      
      <div style={styles.panel}>
        <h3>Configure Date Range</h3>
        <p style={{ color: '#9CA3AF', fontSize: '13px' }}>Select report parameters to export threat databases (placeholder).</p>
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
  panel: {
    padding: '24px',
    background: 'rgba(22, 28, 45, 0.85)',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.08)'
  }
};

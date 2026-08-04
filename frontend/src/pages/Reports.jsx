import React, { useState } from 'react';

export default function Reports() {
  const [format, setFormat] = useState('csv');
  const [downloading, setDownloading] = useState(false);
  const [startDate, setStartDate] = useState(new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const handleExport = (e) => {
    e.preventDefault();
    setDownloading(true);

    fetch('http://localhost:5000/api/reports/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format, start_date: startDate, end_date: endDate }),
      credentials: 'include'
    })
      .then(resp => {
        if (!resp.ok) throw new Error('Failed to generate export file.');
        return resp.blob();
      })
      .then(blob => {
        setDownloading(false);
        // Create browser trigger to download blob spreadsheet file
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `phishguard_audit_report_${new Date().toISOString().split('T')[0]}.${format === 'csv' ? 'csv' : 'json'}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      })
      .catch(err => {
        setDownloading(false);
        alert(err.message || 'Export failed.');
      });
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h2 style={styles.title}>Threat Reports Exporter</h2>
        <p style={styles.subtitle}>Configure audit parameters to download threat database verification records</p>
      </header>

      <div style={styles.layoutGrid}>
        {/* Export configurations */}
        <section style={styles.exportPanel} className="glass-panel">
          <h3 style={{ margin: '0 0 24px 0', fontSize: '18px', fontWeight: '600' }}>Configure Export Parameters</h3>
          
          <form onSubmit={handleExport}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Export Format</label>
              <select 
                style={styles.select} 
                value={format} 
                onChange={e => setFormat(e.target.value)}
              >
                <option value="csv">Excel Spreadsheet (CSV)</option>
                <option value="json">Structured JSON Log Registry</option>
              </select>
            </div>

            <div style={styles.dateRow}>
              <div style={{ ...styles.formGroup, flex: 1 }}>
                <label style={styles.label}>Start Date</label>
                <input 
                  type="date" 
                  style={styles.input} 
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                />
              </div>

              <div style={{ ...styles.formGroup, flex: 1 }}>
                <label style={styles.label}>End Date</label>
                <input 
                  type="date" 
                  style={styles.input} 
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <button 
              type="submit" 
              style={{ ...styles.btnExport, opacity: downloading ? 0.7 : 1 }}
              disabled={downloading}
            >
              <i className="fa-solid fa-cloud-arrow-down" style={{ marginRight: '8px' }}></i>
              {downloading ? 'Formatting File...' : 'Generate & Download'}
            </button>
          </form>
        </section>

        {/* Informative helper sidebar */}
        <section style={styles.infoPanel} className="glass-panel">
          <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '600' }}>Audit Standard Compliance</h3>
          <p style={styles.infoText}>
            Exported data sheets contain complete forensic check records, compiled risk index scores, typosquatting domain validations, and NLTK vector outputs.
          </p>
          <div style={styles.bulletItem}>
            <i className="fa-solid fa-circle-check text-cyan" style={{ marginRight: '10px' }}></i>
            <strong>CSV:</strong> Pinned columns for direct import to Excel.
          </div>
          <div style={styles.bulletItem}>
            <i className="fa-solid fa-circle-check text-cyan" style={{ marginRight: '10px' }}></i>
            <strong>JSON:</strong> Pinned schema matching Mongoose-style MongoDB models.
          </div>
        </section>
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
    marginBottom: '32px'
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
  layoutGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
    gap: '32px',
    alignItems: 'start'
  },
  exportPanel: {
    padding: '32px',
    borderRadius: '16px'
  },
  formGroup: {
    marginBottom: '24px'
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
  select: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    background: '#0F1322',
    color: '#FFF',
    fontSize: '14px',
    outline: 'none',
    cursor: 'pointer'
  },
  dateRow: {
    display: 'flex',
    gap: '16px',
    marginBottom: '16px'
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    background: 'rgba(0, 0, 0, 0.25)',
    color: '#FFF',
    fontSize: '14px',
    outline: 'none'
  },
  btnExport: {
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
    justifyContent: 'center'
  },
  infoPanel: {
    padding: '32px',
    borderRadius: '16px'
  },
  infoText: {
    fontSize: '14px',
    color: '#9CA3AF',
    lineHeight: '1.6',
    marginBottom: '24px'
  },
  bulletItem: {
    fontSize: '13px',
    color: '#D1D5DB',
    display: 'flex',
    alignItems: 'center',
    marginBottom: '14px'
  }
};

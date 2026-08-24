/**
 * ============================================================================
 * COMPONENT: Reports.jsx (Threat Audit Exporter)
 * ============================================================================
 * Description:
 * Allows security investigators to filter threat archives and download
 * forensic spreadsheets in CSV or JSON formats.
 *
 * Endpoints Called:
 * - POST  http://127.0.0.1:5000/api/reports/export        (Spreadsheet blob downloader)
 * ============================================================================
 */

import React, { useState } from 'react';
import './Reports.css';

export default function Reports() {
  const [format, setFormat] = useState('csv');
  const [downloading, setDownloading] = useState(false);
  const [startDate, setStartDate] = useState(new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const handleExport = (e) => {
    e.preventDefault();
    setDownloading(true);

    fetch('http://127.0.0.1:5000/api/reports/export', {
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
    <div className="reports-container">
      <header className="reports-header">
        <h2 className="reports-title">Threat Reports Exporter</h2>
        <p className="reports-subtitle">Configure audit parameters to download threat database verification records</p>
      </header>

      <div className="reports-layout-grid">
        {/* Export configurations */}
        <section className="reports-export-panel glass-panel">
          <h3 style={{ margin: '0 0 24px 0', fontSize: '18px', fontWeight: '600' }}>Configure Export Parameters</h3>
          
          <form onSubmit={handleExport}>
            <div className="reports-form-group">
              <label className="reports-label">Export Format</label>
              <select 
                className="reports-select" 
                value={format} 
                onChange={e => setFormat(e.target.value)}
              >
                <option value="csv">Excel Spreadsheet (CSV)</option>
                <option value="json">Structured JSON Log Registry</option>
              </select>
            </div>

            <div className="reports-date-row">
              <div className="reports-form-group" style={{ flex: 1 }}>
                <label className="reports-label">Start Date</label>
                <input 
                  type="date" 
                  className="reports-input" 
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                />
              </div>

              <div className="reports-form-group" style={{ flex: 1 }}>
                <label className="reports-label">End Date</label>
                <input 
                  type="date" 
                  className="reports-input" 
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <button 
              type="submit" 
              className="reports-btn-export"
              style={{ opacity: downloading ? 0.7 : 1 }}
              disabled={downloading}
            >
              <i className="fa-solid fa-cloud-arrow-down" style={{ marginRight: '8px' }}></i>
              {downloading ? 'Formatting File...' : 'Generate & Download'}
            </button>
          </form>
        </section>

        {/* Informative helper sidebar */}
        <section className="reports-info-panel glass-panel">
          <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '600' }}>Audit Standard Compliance</h3>
          <p className="reports-info-text">
            Exported data sheets contain complete forensic check records, compiled risk index scores, typosquatting domain validations, and NLTK vector outputs.
          </p>
          <div className="reports-bullet-item">
            <i className="fa-solid fa-circle-check text-cyan" style={{ marginRight: '10px' }}></i>
            <strong>CSV:</strong> Pinned columns for direct import to Excel.
          </div>
          <div className="reports-bullet-item">
            <i className="fa-solid fa-circle-check text-cyan" style={{ marginRight: '10px' }}></i>
            <strong>JSON:</strong> Pinned schema matching Mongoose-style MongoDB models.
          </div>
        </section>
      </div>
    </div>
  );
}

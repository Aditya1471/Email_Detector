/**
 * ============================================================================
 * COMPONENT: ScanHistory.jsx (Scan Archives Auditor)
 * ============================================================================
 * Description:
 * Renders the central archive of all security scanning transactions. Supports
 * interactive search queries, sender/subject filtering, and status isolation.
 *
 * Endpoints Called:
 * - GET   http://127.0.0.1:5000/api/emails/history         (Email audit lists)
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import './ScanHistory.css';

export default function ScanHistory() {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, safe, phish

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = () => {
    fetch('http://127.0.0.1:5000/api/emails/history', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data.status === 'success') {
          setEmails(data.emails);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  const filtered = emails.filter(e => {
    const matchSearch = e.subject.toLowerCase().includes(search.toLowerCase()) || 
                        e.sender.toLowerCase().includes(search.toLowerCase());
    
    if (filterType === 'safe') {
      return matchSearch && e.classification === 'safe';
    }
    if (filterType === 'phish') {
      return matchSearch && (e.classification === 'phishing' || e.classification === 'suspect');
    }
    return matchSearch;
  });

  return (
    <div className="scan-history-container">
      <div className="scan-history-header">
        <div>
          <h2 className="scan-history-title">Scan History Logs</h2>
          <p className="scan-history-subtitle">Audit logs of all incoming scans checked by the AI classification core.</p>
        </div>
        <button className="scan-history-btn-refresh" onClick={fetchHistory}>
          <i className="fa-solid fa-rotate"></i> Reload Logs
        </button>
      </div>

      {/* Filters row */}
      <div className="scan-history-filter-row glass-panel">
        <div className="scan-history-search-wrapper">
          <i className="fa-solid fa-magnifying-glass" style={{ color: '#8A92A6' }}></i>
          <input 
            type="text" 
            placeholder="Search by subject or sender..." 
            value={search} 
            onChange={e => setSearch(e.target.value)}
            className="scan-history-search-input" 
          />
        </div>

        <div className="scan-history-tab-group">
          <button 
            className={`scan-history-tab-btn ${filterType === 'all' ? 'scan-history-tab-btn-active' : ''}`}
            onClick={() => setFilterType('all')}
          >
            All Logs ({emails.length})
          </button>
          <button 
            className={`scan-history-tab-btn ${filterType === 'safe' ? 'scan-history-tab-btn-active' : ''}`}
            onClick={() => setFilterType('safe')}
          >
            Safe ({emails.filter(e => e.classification === 'safe').length})
          </button>
          <button 
            className={`scan-history-tab-btn ${filterType === 'phish' ? 'scan-history-tab-btn-active' : ''}`}
            onClick={() => setFilterType('phish')}
          >
            Threats ({emails.filter(e => e.classification === 'phishing' || e.classification === 'suspect').length})
          </button>
        </div>
      </div>

      {/* History table */}
      <div className="scan-history-table-card glass-panel">
        {loading ? (
          <div className="scan-history-loading-box">
            <div className="scan-history-spinner"></div>
            <p style={{ marginTop: '16px', color: '#9CA3AF' }}>Loading scan history audit logs...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="scan-history-empty-box">No history logs matching your filters.</div>
        ) : (
          <table className="scan-history-table">
            <thead>
              <tr className="scan-history-tr-head">
                <th className="scan-history-th" style={{ width: '25%' }}>Sender</th>
                <th className="scan-history-th" style={{ width: '40%' }}>Subject</th>
                <th className="scan-history-th" style={{ width: '15%' }}>Scanned Date</th>
                <th className="scan-history-th" style={{ width: '10%' }}>Risk Rating</th>
                <th className="scan-history-th" style={{ width: '10%', textAlign: 'center' }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, idx) => {
                const isPhish = item.classification === 'phishing' || item.classification === 'suspect';
                return (
                  <tr key={item.id || idx} className="scan-history-tr-row">
                    <td className="scan-history-td" style={{ color: isPhish ? '#EF4444' : '#FFF', fontWeight: '700' }}>
                      {item.sender}
                    </td>
                    <td className="scan-history-td">
                      {item.subject}
                      {item.reasons && item.reasons.length > 0 && (
                        <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                          {item.reasons.map((r, rIdx) => (
                            <span key={rIdx} className="scan-history-reason-tag">
                              <i className="fa-solid fa-bug" style={{ marginRight: '4px' }}></i>{r}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="scan-history-td" style={{ color: '#8A92A6', fontSize: '12px' }}>
                      {item.scanned_at ? new Date(item.scanned_at).toLocaleString() : 'N/A'}
                    </td>
                    <td className="scan-history-td">
                      <span 
                        className="scan-history-badge"
                        style={{
                          background: isPhish ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                          color: isPhish ? '#EF4444' : '#10B981',
                          border: `1px solid ${isPhish ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`
                        }}
                      >
                        {item.risk_score}% {isPhish ? 'Threat' : 'Safe'}
                      </span>
                    </td>
                    <td className="scan-history-td" style={{ textAlign: 'center' }}>
                      <button 
                        className="scan-history-btn-inspect"
                        onClick={() => window.location.href = `#/inspect/${item.id}`}
                      >
                        <i className="fa-solid fa-magnifying-glass-shield"></i>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

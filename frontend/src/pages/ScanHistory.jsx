import React, { useState, useEffect } from 'react';

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
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Scan History Logs</h2>
          <p style={styles.subtitle}>Audit logs of all incoming scans checked by the AI classification core.</p>
        </div>
        <button style={styles.btnRefresh} onClick={fetchHistory}>
          <i className="fa-solid fa-rotate"></i> Reload Logs
        </button>
      </div>

      {/* Filters row */}
      <div style={styles.filterRow} className="glass-panel">
        <div style={styles.searchWrapper}>
          <i className="fa-solid fa-magnifying-glass" style={{ color: '#8A92A6' }}></i>
          <input 
            type="text" 
            placeholder="Search by subject or sender..." 
            value={search} 
            onChange={e => setSearch(e.target.value)}
            style={styles.searchInput} 
          />
        </div>

        <div style={styles.tabGroup}>
          <button 
            style={{ ...styles.tabBtn, ...(filterType === 'all' ? styles.tabBtnActive : {}) }}
            onClick={() => setFilterType('all')}
          >
            All Logs ({emails.length})
          </button>
          <button 
            style={{ ...styles.tabBtn, ...(filterType === 'safe' ? styles.tabBtnActive : {}) }}
            onClick={() => setFilterType('safe')}
          >
            Safe ({emails.filter(e => e.classification === 'safe').length})
          </button>
          <button 
            style={{ ...styles.tabBtn, ...(filterType === 'phish' ? styles.tabBtnActive : {}) }}
            onClick={() => setFilterType('phish')}
          >
            Threats ({emails.filter(e => e.classification === 'phishing' || e.classification === 'suspect').length})
          </button>
        </div>
      </div>

      {/* History table */}
      <div style={styles.tableCard} className="glass-panel">
        {loading ? (
          <div style={styles.loadingBox}>
            <div style={styles.spinner}></div>
            <p style={{ marginTop: '16px', color: '#9CA3AF' }}>Loading scan history audit logs...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={styles.emptyBox}>No history logs matching your filters.</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr style={styles.trHead}>
                <th style={{ ...styles.th, width: '25%' }}>Sender</th>
                <th style={{ ...styles.th, width: '40%' }}>Subject</th>
                <th style={{ ...styles.th, width: '15%' }}>Scanned Date</th>
                <th style={{ ...styles.th, width: '10%' }}>Risk Rating</th>
                <th style={{ ...styles.th, width: '10%', textAlign: 'center' }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, idx) => {
                const isPhish = item.classification === 'phishing' || item.classification === 'suspect';
                return (
                  <tr key={item.id || idx} style={styles.trRow}>
                    <td style={{ ...styles.td, color: isPhish ? '#EF4444' : '#FFF', fontWeight: '700' }}>
                      {item.sender}
                    </td>
                    <td style={styles.td}>
                      {item.subject}
                      {item.reasons && item.reasons.length > 0 && (
                        <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                          {item.reasons.map((r, rIdx) => (
                            <span key={rIdx} style={styles.reasonTag}>
                              <i className="fa-solid fa-bug" style={{ marginRight: '4px' }}></i>{r}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={{ ...styles.td, color: '#8A92A6', fontSize: '12px' }}>
                      {item.scanned_at ? new Date(item.scanned_at).toLocaleString() : 'N/A'}
                    </td>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.badge,
                        background: isPhish ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                        color: isPhish ? '#EF4444' : '#10B981',
                        border: `1px solid ${isPhish ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`
                      }}>
                        {item.risk_score}% {isPhish ? 'Threat' : 'Safe'}
                      </span>
                    </td>
                    <td style={{ ...styles.td, textAlign: 'center' }}>
                      <button 
                        style={styles.btnInspect}
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
  btnRefresh: {
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    color: '#FFF',
    padding: '10px 20px',
    borderRadius: '8px',
    fontWeight: '700',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  filterRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderRadius: '12px',
    flexWrap: 'wrap',
    gap: '16px'
  },
  searchWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    background: '#0d111c',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: '10px',
    padding: '8px 16px',
    width: '320px'
  },
  searchInput: {
    background: 'none',
    border: 'none',
    color: '#FFF',
    marginLeft: '10px',
    fontSize: '13px',
    outline: 'none',
    width: '100%'
  },
  tabGroup: {
    display: 'flex',
    background: '#0d111c',
    border: '1px solid rgba(255,255,255,0.05)',
    padding: '4px',
    borderRadius: '8px'
  },
  tabBtn: {
    background: 'none',
    border: 'none',
    color: '#8A92A6',
    padding: '8px 16px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '700',
    transition: 'all 0.2s'
  },
  tabBtnActive: {
    background: 'rgba(99, 102, 241, 0.15)',
    color: '#FFF',
    border: '1px solid rgba(99, 102, 241, 0.3)'
  },
  tableCard: {
    borderRadius: '16px',
    padding: '24px',
    overflowX: 'auto',
    minHeight: '400px'
  },
  loadingBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '350px'
  },
  spinner: {
    width: '36px',
    height: '36px',
    border: '4px solid rgba(99, 102, 241, 0.15)',
    borderTop: '4px solid #6366F1',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  emptyBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#8A92A6',
    height: '350px',
    fontSize: '14px'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left'
  },
  trHead: {
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
  },
  th: {
    padding: '12px 16px',
    fontSize: '12px',
    color: '#8A92A6',
    textTransform: 'uppercase',
    fontWeight: '700'
  },
  trRow: {
    borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
    transition: 'background 0.2s'
  },
  td: {
    padding: '16px',
    fontSize: '13.5px',
    color: '#D1D5DB'
  },
  badge: {
    padding: '4px 8px',
    borderRadius: '6px',
    fontSize: '11.5px',
    fontWeight: '700'
  },
  btnInspect: {
    background: 'rgba(99, 102, 241, 0.1)',
    border: '1px solid rgba(99, 102, 241, 0.2)',
    color: '#6366F1',
    width: '32px',
    height: '32px',
    borderRadius: '6px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px'
  },
  reasonTag: {
    background: 'rgba(239, 68, 68, 0.08)',
    border: '1px solid rgba(239, 68, 68, 0.15)',
    color: '#EF4444',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.2px'
  }
};

import React, { useState } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import EmailDetails from './pages/EmailDetails';
import Reports from './pages/Reports';
import AdminPanel from './pages/AdminPanel';

export default function App() {
  const [currentPage, setCurrentPage] = useState('login');

  const renderPage = () => {
    switch (currentPage) {
      case 'login':
        return <Login />;
      case 'dashboard':
        return <Dashboard />;
      case 'details':
        return <EmailDetails />;
      case 'reports':
        return <Reports />;
      case 'admin':
        return <AdminPanel />;
      default:
        return <Login />;
    }
  };

  return (
    <div style={styles.app}>
      {currentPage !== 'login' && (
        <aside style={styles.sidebar}>
          <div style={styles.logo}>
            <span style={{ color: '#06B6D4' }}>Phish</span>Guard
          </div>
          <nav style={styles.nav}>
            <button 
              style={{ ...styles.navLink, ...(currentPage === 'dashboard' ? styles.active : {}) }}
              onClick={() => setCurrentPage('dashboard')}
            >
              Dashboard
            </button>
            <button 
              style={{ ...styles.navLink, ...(currentPage === 'details' ? styles.active : {}) }}
              onClick={() => setCurrentPage('details')}
            >
              Email Details
            </button>
            <button 
              style={{ ...styles.navLink, ...(currentPage === 'reports' ? styles.active : {}) }}
              onClick={() => setCurrentPage('reports')}
            >
              Reports
            </button>
            <button 
              style={{ ...styles.navLink, ...(currentPage === 'admin' ? styles.active : {}) }}
              onClick={() => setCurrentPage('admin')}
            >
              Admin Panel
            </button>
          </nav>
          
          <button 
            style={styles.logoutBtn}
            onClick={() => setCurrentPage('login')}
          >
            Logout
          </button>
        </aside>
      )}
      
      <main style={styles.main}>
        {renderPage()}
        
        {currentPage === 'login' && (
          <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 100 }}>
            <button 
              style={styles.bypassBtn}
              onClick={() => setCurrentPage('dashboard')}
            >
              Bypass to Dashboard (Presenter Shortcut)
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

const styles = {
  app: {
    display: 'flex',
    minHeight: '100vh',
    background: '#0A0D14',
    color: '#FFF',
    fontFamily: 'sans-serif'
  },
  sidebar: {
    width: '240px',
    background: '#111522',
    borderRight: '1px solid rgba(255, 255, 255, 0.08)',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0
  },
  logo: {
    fontSize: '22px',
    fontWeight: '700',
    marginBottom: '40px',
    letterSpacing: '0.5px'
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    flexGrow: 1
  },
  navLink: {
    background: 'none',
    border: 'none',
    color: '#9CA3AF',
    textAlign: 'left',
    padding: '12px 16px',
    borderRadius: '8px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  active: {
    background: 'linear-gradient(135deg, #06B6D4 0%, #6366F1 100%)',
    color: '#FFF',
    boxShadow: '0 0 15px rgba(99, 102, 241, 0.25)'
  },
  logoutBtn: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    color: '#FFF',
    padding: '10px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600'
  },
  main: {
    flexGrow: 1,
    display: 'flex',
    flexDirection: 'column'
  },
  bypassBtn: {
    background: '#10B981',
    color: '#FFF',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 4px 10px rgba(16, 185, 129, 0.3)'
  }
};

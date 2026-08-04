import React, { useState, useEffect } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import EmailDetails from './pages/EmailDetails';
import Reports from './pages/Reports';
import AdminPanel from './pages/AdminPanel';

export default function App() {
  const [currentPage, setCurrentPage] = useState('login');
  const [authLoading, setAuthLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);

  // Check session status on startup
  useEffect(() => {
    checkAuthSession();
  }, []);

  const checkAuthSession = () => {
    fetch('http://localhost:5000/api/auth/status', { credentials: 'include' })
      .then(resp => resp.json())
      .then(data => {
        if (data.status === 'success' && data.authenticated) {
          // Fetch complete profile info
          fetchUserProfile();
        } else {
          setCurrentPage('login');
          setAuthLoading(false);
        }
      })
      .catch(() => {
        setCurrentPage('login');
        setAuthLoading(false);
      });
  };

  const fetchUserProfile = () => {
    fetch('http://localhost:5000/api/auth/me', { credentials: 'include' })
      .then(resp => {
        if (!resp.ok) throw new Error();
        return resp.json();
      })
      .then(data => {
        if (data.status === 'success') {
          setUserProfile(data.user);
          setCurrentPage('dashboard');
        }
        setAuthLoading(false);
      })
      .catch(() => {
        setCurrentPage('login');
        setAuthLoading(false);
      });
  };

  const handleLogout = () => {
    fetch('http://localhost:5000/api/auth/logout', { method: 'POST', credentials: 'include' })
      .then(() => {
        setUserProfile(null);
        setCurrentPage('login');
      })
      .catch(() => {
        setUserProfile(null);
        setCurrentPage('login');
      });
  };

  if (authLoading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p style={{ marginTop: '20px', color: '#9CA3AF' }}>Checking credentials authorization...</p>
      </div>
    );
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'login':
        return <Login />;
      case 'dashboard':
        return <Dashboard user={userProfile} />;
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
          
          <div style={styles.userInfo}>
            <div style={styles.avatar}>
              {userProfile?.full_name ? userProfile.full_name[0].toUpperCase() : 'U'}
            </div>
            <div>
              <div style={styles.userName}>{userProfile?.full_name || 'Active User'}</div>
              <div style={styles.userRole}>
                {userProfile?.role === 'admin' ? 'System Admin' : 'Security Analyst'}
              </div>
            </div>
          </div>

          <nav style={styles.nav}>
            <button 
              style={{ ...styles.navLink, ...(currentPage === 'dashboard' ? styles.active : {}) }}
              onClick={() => setCurrentPage('dashboard')}
            >
              <i className="fa-solid fa-chart-pie" style={{ marginRight: '10px' }}></i>
              Dashboard
            </button>
            <button 
              style={{ ...styles.navLink, ...(currentPage === 'details' ? styles.active : {}) }}
              onClick={() => setCurrentPage('details')}
            >
              <i className="fa-solid fa-magnifying-glass-shield" style={{ marginRight: '10px' }}></i>
              Email Details
            </button>
            <button 
              style={{ ...styles.navLink, ...(currentPage === 'reports' ? styles.active : {}) }}
              onClick={() => setCurrentPage('reports')}
            >
              <i className="fa-solid fa-file-invoice" style={{ marginRight: '10px' }}></i>
              Reports
            </button>
            
            {userProfile?.role === 'admin' && (
              <button 
                style={{ ...styles.navLink, ...(currentPage === 'admin' ? styles.active : {}) }}
                onClick={() => setCurrentPage('admin')}
              >
                <i className="fa-solid fa-sliders" style={{ marginRight: '10px' }}></i>
                Admin Panel
              </button>
            )}
          </nav>
          
          <button 
            style={styles.logoutBtn}
            onClick={handleLogout}
          >
            <i className="fa-solid fa-power-off" style={{ marginRight: '8px' }}></i>
            Logout
          </button>
        </aside>
      )}
      
      <main style={styles.main}>
        {renderPage()}
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
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: '#0A0D14',
    fontFamily: 'sans-serif'
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid rgba(6, 182, 212, 0.15)',
    borderTop: '4px solid #06B6D4',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  sidebar: {
    width: '250px',
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
    marginBottom: '28px',
    letterSpacing: '0.5px'
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    paddingBottom: '20px',
    marginBottom: '24px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
  },
  avatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #06B6D4 0%, #6366F1 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    fontSize: '14px'
  },
  userName: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#F3F4F6'
  },
  userRole: {
    fontSize: '11px',
    color: '#9CA3AF',
    marginTop: '2px'
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
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center'
  },
  active: {
    background: 'linear-gradient(135deg, #06B6D4 0%, #6366F1 100%)',
    color: '#FFF',
    boxShadow: '0 0 15px rgba(99, 102, 241, 0.25)'
  },
  logoutBtn: {
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    color: '#FFF',
    padding: '12px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '20px'
  },
  main: {
    flexGrow: 1,
    display: 'flex',
    flexDirection: 'column'
  }
};

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
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: '#07090e',
      color: '#FFF'
    }}>
      {currentPage !== 'login' && (
        <aside style={{
          width: '260px',
          background: 'rgba(15, 23, 42, 0.8)',
          borderRight: '1px solid var(--border-color)',
          padding: '28px 24px',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '32px' }}>
            <svg width="22" height="26" viewBox="0 0 24 28" fill="none">
              <path d="M12 2L2 6v8c0 5.52 4.48 10 10 10s10-4.48 10-10V6L12 2z" stroke="#10B981" strokeWidth="2.5" fill="rgba(16, 185, 129, 0.1)"/>
              <path d="M12 7v10M9 12h6" stroke="#10B981" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <div>
              <div style={{ fontSize: '18px', fontWeight: '900', letterSpacing: '0.5px', color: '#FFF', lineHeight: '1' }}>PHISHGUARD</div>
              <div style={{ fontSize: '7.5px', color: '#10B981', fontWeight: '800', letterSpacing: '0.2px', marginTop: '3.5px' }}>AI PHISHING EMAIL DETECTION</div>
            </div>
          </div>
          
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            paddingBottom: '24px',
            marginBottom: '28px',
            borderBottom: '1px solid var(--border-color)'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--color-cyan) 0%, var(--color-indigo) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: '15px',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)'
            }}>
              {userProfile?.name ? userProfile.name[0].toUpperCase() : 'U'}
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#FFF' }}>
                {userProfile?.name || (userProfile?.email ? userProfile.email.split('@')[0].toUpperCase() : 'Security Analyst')}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {userProfile?.role === 'admin' ? 'System Administrator' : 'Security Analyst'}
              </div>
            </div>
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexGrow: 1 }}>
            <button 
              className={`sidebar-link ${currentPage === 'dashboard' ? 'active' : ''}`}
              onClick={() => setCurrentPage('dashboard')}
              style={{ background: 'none', border: 'none', width: '100%', cursor: 'pointer', textAlign: 'left' }}
            >
              <i className="fa-solid fa-chart-pie" style={{ fontSize: '16px' }}></i>
              Dashboard
            </button>
            <button 
              className={`sidebar-link ${currentPage === 'details' ? 'active' : ''}`}
              onClick={() => setCurrentPage('details')}
              style={{ background: 'none', border: 'none', width: '100%', cursor: 'pointer', textAlign: 'left' }}
            >
              <i className="fa-solid fa-magnifying-glass-shield" style={{ fontSize: '16px' }}></i>
              Email Details
            </button>
            <button 
              className={`sidebar-link ${currentPage === 'reports' ? 'active' : ''}`}
              onClick={() => setCurrentPage('reports')}
              style={{ background: 'none', border: 'none', width: '100%', cursor: 'pointer', textAlign: 'left' }}
            >
              <i className="fa-solid fa-file-invoice" style={{ fontSize: '16px' }}></i>
              Reports
            </button>
            
            {userProfile?.role === 'admin' && (
              <button 
                className={`sidebar-link ${currentPage === 'admin' ? 'active' : ''}`}
                onClick={() => setCurrentPage('admin')}
                style={{ background: 'none', border: 'none', width: '100%', cursor: 'pointer', textAlign: 'left' }}
              >
                <i className="fa-solid fa-sliders" style={{ fontSize: '16px' }}></i>
                Admin Panel
              </button>
            )}
          </nav>
          
          <button 
            style={{
              background: 'rgba(239, 68, 68, 0.05)',
              border: '1px solid rgba(239, 68, 68, 0.1)',
              color: '#EF4444',
              padding: '12px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontSize: '13px',
              marginTop: '20px'
            }}
            onClick={handleLogout}
          >
            <i className="fa-solid fa-power-off"></i>
            Logout
          </button>
        </aside>
      )}
      
      <main style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
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

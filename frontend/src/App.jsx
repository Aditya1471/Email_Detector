import React, { useState, useEffect } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import EmailDetails from './pages/EmailDetails';
import Reports from './pages/Reports';
import AdminPanel from './pages/AdminPanel';
import ScanHistory from './pages/ScanHistory';
import Settings from './pages/Settings';
import ThreatIntel from './pages/ThreatIntel';
import Notifications from './pages/Notifications';

export default function App() {
  const [currentPage, setCurrentPage] = useState('login');
  const [authLoading, setAuthLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (userProfile) {
      const fetchUnread = () => {
        fetch('http://localhost:5000/api/emails/notifications', { credentials: 'include' })
          .then(r => r.json())
          .then(data => {
            if (data.status === 'success') {
              const count = data.notifications.filter(n => n.channel === 'in_app' && !n.read).length;
              setUnreadCount(count);
            }
          })
          .catch(console.error);
      };
      fetchUnread();
      const interval = setInterval(fetchUnread, 8000);
      return () => clearInterval(interval);
    }
  }, [userProfile]);

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
      case 'inbox':
        return <Dashboard user={userProfile} />;
      case 'notifications':
        return <Notifications />;
      case 'history':
        return <ScanHistory />;
      case 'details':
        return <EmailDetails />;
      case 'reports':
        return <Reports />;
      case 'threat_intel':
        return <ThreatIntel />;
      case 'settings':
        return <Settings />;
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
      color: '#FFF',
      fontFamily: "'Outfit', sans-serif"
    }}>
      {currentPage !== 'login' && (
        <aside style={{
          width: '280px',
          background: '#0a0d17',
          borderRight: '1px solid rgba(255, 255, 255, 0.05)',
          padding: '24px 20px',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          overflowY: 'auto'
        }}>
          {/* Logo Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'rgba(99, 102, 241, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 15px rgba(99, 102, 241, 0.25)',
              border: '1px solid rgba(99, 102, 241, 0.3)'
            }}>
              <i className="fa-solid fa-shield-halved" style={{ color: '#6366F1', fontSize: '20px' }}></i>
            </div>
            <div>
              <div style={{ fontSize: '19px', fontWeight: '800', letterSpacing: '0.5px', color: '#FFF', lineHeight: '1' }}>PhishShield AI</div>
              <div style={{ fontSize: '7.5px', color: 'rgba(255, 255, 255, 0.4)', fontWeight: '600', letterSpacing: '0.2px', marginTop: '4px' }}>
                AI-POWERED PHISHING email detection
              </div>
            </div>
          </div>
          
          {/* Navigation Links matching Mockup */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexGrow: 1 }}>
            <button 
              className={`sidebar-link ${currentPage === 'dashboard' ? 'active' : ''}`}
              onClick={() => setCurrentPage('dashboard')}
            >
              <i className="fa-solid fa-gauge"></i>
              Dashboard
            </button>
            
            <button 
              className={`sidebar-link ${currentPage === 'inbox' ? 'active' : ''}`}
              onClick={() => setCurrentPage('inbox')}
            >
              <i className="fa-solid fa-desktop"></i>
              Inbox Monitor
            </button>

            <button 
              className={`sidebar-link ${currentPage === 'details' ? 'active' : ''}`}
              onClick={() => setCurrentPage('details')}
            >
              <i className="fa-solid fa-magnifying-glass-shield"></i>
              Scan Email
            </button>

            <button 
              className={`sidebar-link ${currentPage === 'history' ? 'active' : ''}`}
              onClick={() => setCurrentPage('history')}
            >
              <i className="fa-solid fa-clock-rotate-left"></i>
              Scan History
            </button>

            <button 
              className={`sidebar-link ${currentPage === 'reports' ? 'active' : ''}`}
              onClick={() => setCurrentPage('reports')}
            >
              <i className="fa-solid fa-chart-line"></i>
              Reports & Analytics
            </button>

            <button 
              className={`sidebar-link ${currentPage === 'threat_intel' ? 'active' : ''}`}
              onClick={() => setCurrentPage('threat_intel')}
            >
              <i className="fa-solid fa-skull-crossbones"></i>
              Threat Intelligence
            </button>

            <button 
              className={`sidebar-link ${currentPage === 'notifications' ? 'active' : ''}`}
              onClick={() => setCurrentPage('notifications')}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <i className="fa-solid fa-bell"></i>
                Notifications
              </span>
              {unreadCount > 0 && (
                <span style={{ background: '#EF4444', color: '#FFF', fontSize: '10px', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>
                  {unreadCount}
                </span>
              )}
            </button>

            <button 
              className={`sidebar-link ${currentPage === 'settings' ? 'active' : ''}`}
              onClick={() => setCurrentPage('settings')}
            >
              <i className="fa-solid fa-gear"></i>
              Settings
            </button>

            {userProfile?.role === 'admin' && (
              <button 
                className={`sidebar-link ${currentPage === 'admin' ? 'active' : ''}`}
                onClick={() => setCurrentPage('admin')}
              >
                <i className="fa-solid fa-sliders"></i>
                Admin Panel
              </button>
            )}
          </nav>

          {/* Protection Status Box */}
          <div style={{
            background: 'rgba(16, 185, 129, 0.03)',
            border: '1px solid rgba(16, 185, 129, 0.12)',
            borderRadius: '12px',
            padding: '16px',
            marginTop: '16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: '8px'
          }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 15px rgba(16, 185, 129, 0.25)',
              border: '1px solid rgba(16, 185, 129, 0.3)'
            }}>
              <i className="fa-solid fa-check" style={{ color: '#10B981', fontSize: '18px' }}></i>
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#10B981' }}>You are Protected</div>
              <div style={{ fontSize: '10px', color: '#9CA3AF', marginTop: '2px' }}>Real-time monitoring is active</div>
            </div>
          </div>

          {/* AI Model Status Box */}
          <div style={{
            background: 'rgba(139, 92, 246, 0.03)',
            border: '1px solid rgba(139, 92, 246, 0.12)',
            borderRadius: '12px',
            padding: '16px',
            marginTop: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(139, 92, 246, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <i className="fa-solid fa-brain" style={{ color: '#8B5CF6', fontSize: '14px' }}></i>
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#FFF' }}>AI Model Status</div>
                <div style={{ fontSize: '9px', color: '#8B5CF6', marginTop: '1px' }}>Active Core</div>
              </div>
            </div>
            <div style={{ fontSize: '11px', color: '#D1D5DB', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#9CA3AF' }}>Model:</span>
                <span style={{ fontWeight: '600' }}>PhishNet XGBoost</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#9CA3AF' }}>Accuracy:</span>
                <span style={{ fontWeight: '600', color: '#10B981' }}>96.42%</span>
              </div>
            </div>
          </div>
          
          <button 
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
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
              marginTop: '16px'
            }}
            onClick={handleLogout}
          >
            <i className="fa-solid fa-power-off"></i>
            Logout
          </button>
        </aside>
      )}
      
      <main style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
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

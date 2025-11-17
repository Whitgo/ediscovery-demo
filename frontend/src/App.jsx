import React, { useState, useEffect, useMemo } from "react";
import { UserContext } from "./context/UserContext";
import LandingPage from "./components/LandingPage";
import LoginForm from "./components/LoginForm";
import Dashboard from "./components/Dashboard";
import CaseDetail from "./components/CaseDetail";
import UserManagement from "./components/UserManagement";
import NotificationsPanel from "./components/NotificationsPanel";
import NotificationPreferences from "./components/NotificationPreferences";
import IncidentDashboard from "./components/IncidentDashboard";
import NotFound from "./components/NotFound";
import { getToken, apiGet } from "./utils/api";
import { hasRole, canAccess, ROLES } from "./utils/rbac";

function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("landing");
  const [caseId, setCaseId] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    async function fetchUser() {
      try {
        if (getToken()) {
          setUser(JSON.parse(localStorage.getItem("user")) || null);
          setView("dashboard");
        }
      } catch {}
    }
    fetchUser();
  }, []);

  // Poll for unread notifications count
  useEffect(() => {
    if (!user || !canAccess(user.role, 'read', 'notification')) return;

    const fetchUnreadCount = async () => {
      try {
        const data = await apiGet("/notifications/unread/count");
        setUnreadCount(data.count || 0);
      } catch (e) {
        console.error("Failed to fetch unread count:", e);
      }
    };

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000); // Poll every 30 seconds

    return () => clearInterval(interval);
  }, [user]);

  function handleLogin(u) {
    setUser(u);
    localStorage.setItem("user", JSON.stringify(u));
    setView("dashboard");
  }
  function handleLogout() {
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setView("landing");
  }
  function openCase(caseId) {
    setCaseId(caseId);
    setView("case");
  }
  function backToDashboard() {
    setCaseId(null);
    setView("dashboard");
  }
  function openUserManagement() {
    setView("users");
  }
  function toggleNotifications() {
    setShowNotifications(!showNotifications);
  }
  function handleNotificationNavigate(caseId) {
    openCase(caseId);
    setShowNotifications(false);
  }
  function openNotificationSettings() {
    setView("notification-settings");
    setShowNotifications(false);
  }
  const providerValue = useMemo(() => user || {}, [user]);

  if (view === "landing") {
    return <LandingPage onGetStarted={() => setView("login")} />;
  }

  if (view === "login") {
    return <LoginForm onLogin={handleLogin} />;
  }

  if (!user) {
    return <LoginForm onLogin={handleLogin} />;
  }
  return (
    <UserContext.Provider value={providerValue}>
      <div style={{maxWidth: '1400px', margin: '0 auto', fontFamily: 'sans-serif'}}>
        <header style={{
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          padding: '16px 24px',
          background: '#fff',
          borderBottom: '1px solid #e2e8f0',
          marginBottom: 24
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <h2 style={{ margin: 0, color: '#2d3748', cursor: 'pointer' }} onClick={backToDashboard}>
              eDiscovery Demo
            </h2>
            <nav style={{ display: 'flex', gap: '16px' }}>
              <button
                onClick={backToDashboard}
                style={{
                  padding: '8px 16px',
                  background: view === 'dashboard' ? '#edf2f7' : 'transparent',
                  color: view === 'dashboard' ? '#2166e8' : '#4a5568',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '0.9em'
                }}
              >
                Dashboard
              </button>
              {hasRole(user.role, ROLES.ADMIN, ROLES.MANAGER) && (
                <button
                  onClick={openUserManagement}
                  style={{
                    padding: '8px 16px',
                    background: view === 'users' ? '#edf2f7' : 'transparent',
                    color: view === 'users' ? '#2166e8' : '#4a5568',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '0.9em'
                  }}
                >
                  👥 Users
                </button>
              )}
              {canAccess(user.role, 'read', 'incident') && (
                <button
                  onClick={() => setView('incidents')}
                  style={{
                    padding: '8px 16px',
                    background: view === 'incidents' ? '#edf2f7' : 'transparent',
                    color: view === 'incidents' ? '#2166e8' : '#4a5568',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '0.9em'
                  }}
                >
                  🚨 Incidents
                </button>
              )}
              {canAccess(user.role, 'read', 'notification') && (
                <button
                  onClick={openNotificationSettings}
                  style={{
                    padding: '8px 16px',
                    background: view === 'notification-settings' ? '#edf2f7' : 'transparent',
                    color: view === 'notification-settings' ? '#2166e8' : '#4a5568',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '0.9em'
                  }}
                >
                  ⚙️ Settings
                </button>
              )}
            </nav>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {canAccess(user.role, 'read', 'notification') && (
              <button
                onClick={toggleNotifications}
                style={{
                  position: 'relative',
                  padding: '8px 12px',
                  background: showNotifications ? '#edf2f7' : 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '1.3em',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                🔔
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    background: '#f56565',
                    color: '#fff',
                    borderRadius: '10px',
                    padding: '2px 6px',
                    fontSize: '0.5em',
                    fontWeight: '700',
                    minWidth: '18px',
                    textAlign: 'center'
                  }}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
            )}
            <span style={{ color: '#4a5568' }}>
              <b>{user.name}</b>{' '}
              <span style={{
                padding: '2px 8px',
                background: '#edf2f7',
                color: '#2166e8',
                borderRadius: '12px',
                fontSize: '0.85em',
                fontWeight: '600',
                textTransform: 'capitalize'
              }}>
                {user.role}
              </span>
            </span>
            <button
              onClick={handleLogout}
              style={{
                padding: '8px 16px',
                background: '#fff',
                color: '#e53e3e',
                border: '1px solid #e53e3e',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.9em'
              }}
            >
              Logout
            </button>
          </div>
        </header>
        <div style={{ padding: '0 24px' }}>
          {view === "dashboard" && (
            <Dashboard onOpenCase={openCase} />
          )}
          {view === "case" && (
            <CaseDetail caseId={caseId} onBack={backToDashboard} />
          )}
          {view === "users" && canAccess(user.role, 'read', 'user') && (
            <UserManagement />
          )}
          {view === "incidents" && canAccess(user.role, 'read', 'incident') && (
            <IncidentDashboard />
          )}
          {view === "notification-settings" && canAccess(user.role, 'read', 'notification') && (
            <NotificationPreferences />
          )}
          {!["dashboard", "case", "users", "incidents", "notification-settings"].includes(view) && (
            <NotFound />
          )}
        </div>

        {/* Notifications Panel */}
        {showNotifications && canAccess(user.role, 'read', 'notification') && (
          <NotificationsPanel
            onClose={() => setShowNotifications(false)}
            onNavigateToCase={handleNotificationNavigate}
            onOpenSettings={openNotificationSettings}
          />
        )}
      </div>
    </UserContext.Provider>
  );
}

export default App;
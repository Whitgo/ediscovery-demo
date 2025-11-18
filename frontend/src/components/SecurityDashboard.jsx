/**
 * Security Dashboard Component
 * Real-time security monitoring for administrators
 */

import React, { useState, useEffect } from 'react';
import { apiGet } from '../utils/api';

const SecurityDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchDashboardData = async () => {
    try {
      const data = await apiGet('/security/dashboard');
      setDashboardData(data);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load security dashboard');
      console.error('Security dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchDashboardData();
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high': return '#e53e3e';
      case 'medium': return '#ed8936';
      case 'low': return '#ecc94b';
      default: return '#718096';
    }
  };

  const getActionBadgeColor = (action) => {
    if (action.includes('fail') || action.includes('denied') || action.includes('unauthorized')) {
      return '#fed7d7';
    }
    if (action.includes('login') || action.includes('success')) {
      return '#c6f6d5';
    }
    if (action.includes('delete') || action.includes('restore')) {
      return '#feebc8';
    }
    return '#e2e8f0';
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '48px' }}>
        <div style={{ fontSize: '1.2em', color: '#4a5568' }}>Loading security dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        padding: '24px', 
        background: '#fed7d7', 
        borderRadius: '8px',
        color: '#742a2a',
        border: '1px solid #fc8181'
      }}>
        <strong>Error:</strong> {error}
      </div>
    );
  }

  const { stats, failedLogins, recentLogins, recentActivity, securityEvents, topUsers, actionBreakdown, suspiciousIPs } = dashboardData;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: '0 0 8px 0', fontSize: '1.8em', color: '#2d3748' }}>
            🔒 Security Dashboard
          </h1>
          <p style={{ margin: 0, color: '#718096' }}>
            Real-time security monitoring and audit logs
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4a5568', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh (30s)
          </label>
          <button
            onClick={fetchDashboardData}
            style={{
              padding: '8px 16px',
              background: '#4299e1',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '16px', 
        marginBottom: '24px' 
      }}>
        <StatCard
          title="Failed Logins (24h)"
          value={stats.failedLoginCount24h}
          color={stats.failedLoginCount24h > 10 ? '#e53e3e' : '#4299e1'}
          icon="🚫"
        />
        <StatCard
          title="Successful Logins (24h)"
          value={stats.successfulLoginCount24h}
          color="#48bb78"
          icon="✅"
        />
        <StatCard
          title="Active Sessions"
          value={stats.activeSessionCount}
          color="#9f7aea"
          icon="👥"
        />
        <StatCard
          title="Security Events (7d)"
          value={stats.securityEventCount7d}
          color={stats.securityEventCount7d > 20 ? '#ed8936' : '#718096'}
          icon="⚠️"
        />
        <StatCard
          title="Suspicious IPs"
          value={stats.suspiciousIPCount}
          color={stats.suspiciousIPCount > 0 ? '#e53e3e' : '#48bb78'}
          icon="🌐"
        />
        <StatCard
          title="Total Activity (24h)"
          value={stats.totalActivityCount24h}
          color="#38b2ac"
          icon="📊"
        />
      </div>

      {/* Alert Banner */}
      {(stats.suspiciousIPCount > 0 || stats.failedLoginCount24h > 20) && (
        <div style={{
          padding: '16px',
          background: '#fed7d7',
          border: '1px solid #fc8181',
          borderRadius: '8px',
          marginBottom: '24px',
          color: '#742a2a'
        }}>
          <strong>⚠️ Security Alert:</strong>{' '}
          {stats.suspiciousIPCount > 0 && `${stats.suspiciousIPCount} suspicious IP(s) detected. `}
          {stats.failedLoginCount24h > 20 && `High number of failed login attempts (${stats.failedLoginCount24h}).`}
        </div>
      )}

      {/* Tabs */}
      <div style={{ borderBottom: '2px solid #e2e8f0', marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          {['overview', 'failed-logins', 'audit-logs', 'security-events', 'analytics'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '12px 24px',
                background: activeTab === tab ? '#fff' : 'transparent',
                color: activeTab === tab ? '#2166e8' : '#718096',
                border: 'none',
                borderBottom: activeTab === tab ? '2px solid #2166e8' : '2px solid transparent',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.95em',
                marginBottom: '-2px'
              }}
            >
              {tab.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewTab
          recentActivity={recentActivity}
          topUsers={topUsers}
          suspiciousIPs={suspiciousIPs}
          formatTimestamp={formatTimestamp}
          getActionBadgeColor={getActionBadgeColor}
        />
      )}

      {activeTab === 'failed-logins' && (
        <FailedLoginsTab
          failedLogins={failedLogins}
          suspiciousIPs={suspiciousIPs}
          formatTimestamp={formatTimestamp}
        />
      )}

      {activeTab === 'audit-logs' && (
        <AuditLogsTab
          recentActivity={recentActivity}
          formatTimestamp={formatTimestamp}
          getActionBadgeColor={getActionBadgeColor}
        />
      )}

      {activeTab === 'security-events' && (
        <SecurityEventsTab
          securityEvents={securityEvents}
          formatTimestamp={formatTimestamp}
          getSeverityColor={getSeverityColor}
        />
      )}

      {activeTab === 'analytics' && (
        <AnalyticsTab
          actionBreakdown={actionBreakdown}
          topUsers={topUsers}
        />
      )}
    </div>
  );
};

// Stat Card Component
const StatCard = ({ title, value, color, icon }) => (
  <div style={{
    padding: '20px',
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
      <div style={{ fontSize: '0.875em', color: '#718096', fontWeight: '600' }}>{title}</div>
      <div style={{ fontSize: '1.5em' }}>{icon}</div>
    </div>
    <div style={{ fontSize: '2em', fontWeight: 'bold', color }}>{value}</div>
  </div>
);

// Overview Tab
const OverviewTab = ({ recentActivity, topUsers, suspiciousIPs, formatTimestamp, getActionBadgeColor }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
    <div>
      <h3 style={{ marginTop: 0 }}>Recent Activity</h3>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f7fafc' }}>
            <tr>
              <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.875em', fontWeight: '600', color: '#4a5568' }}>User</th>
              <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.875em', fontWeight: '600', color: '#4a5568' }}>Action</th>
              <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.875em', fontWeight: '600', color: '#4a5568' }}>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {recentActivity.slice(0, 15).map((log, idx) => (
              <tr key={idx} style={{ borderTop: '1px solid #e2e8f0' }}>
                <td style={{ padding: '12px', fontSize: '0.875em' }}>
                  {log.username || `User ${log.user}`}
                  <div style={{ fontSize: '0.75em', color: '#718096' }}>{log.email}</div>
                </td>
                <td style={{ padding: '12px' }}>
                  <span style={{
                    padding: '4px 8px',
                    background: getActionBadgeColor(log.action),
                    borderRadius: '4px',
                    fontSize: '0.75em',
                    fontWeight: '600'
                  }}>
                    {log.action}
                  </span>
                </td>
                <td style={{ padding: '12px', fontSize: '0.875em', color: '#718096' }}>
                  {formatTimestamp(log.timestamp)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

    <div>
      <h3 style={{ marginTop: 0 }}>Top Active Users (7d)</h3>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
        {topUsers.map((user, idx) => (
          <div key={idx} style={{ 
            padding: '12px 0', 
            borderBottom: idx < topUsers.length - 1 ? '1px solid #e2e8f0' : 'none' 
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <div style={{ fontWeight: '600', fontSize: '0.9em' }}>{user.username}</div>
              <div style={{ color: '#4299e1', fontWeight: 'bold' }}>{user.activity_count}</div>
            </div>
            <div style={{ fontSize: '0.75em', color: '#718096' }}>
              {user.email} · {user.role}
            </div>
          </div>
        ))}
      </div>

      {suspiciousIPs.length > 0 && (
        <>
          <h3 style={{ marginTop: '24px' }}>⚠️ Suspicious IPs</h3>
          <div style={{ background: '#fed7d7', border: '1px solid #fc8181', borderRadius: '8px', padding: '16px' }}>
            {suspiciousIPs.map((ip, idx) => (
              <div key={idx} style={{ 
                padding: '8px 0', 
                borderBottom: idx < suspiciousIPs.length - 1 ? '1px solid #fc8181' : 'none',
                color: '#742a2a'
              }}>
                <div style={{ fontWeight: 'bold' }}>{ip.ip}</div>
                <div style={{ fontSize: '0.875em' }}>{ip.failed_attempts} failed attempts</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  </div>
);

// Failed Logins Tab
const FailedLoginsTab = ({ failedLogins, suspiciousIPs, formatTimestamp }) => (
  <div>
    <h3>Failed Login Attempts (Last 24 Hours)</h3>
    {suspiciousIPs.length > 0 && (
      <div style={{
        padding: '12px 16px',
        background: '#fed7d7',
        border: '1px solid #fc8181',
        borderRadius: '8px',
        marginBottom: '16px',
        color: '#742a2a'
      }}>
        <strong>Warning:</strong> {suspiciousIPs.length} IP(s) with 5+ failed attempts detected
      </div>
    )}
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead style={{ background: '#f7fafc' }}>
          <tr>
            <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.875em', fontWeight: '600', color: '#4a5568' }}>Email</th>
            <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.875em', fontWeight: '600', color: '#4a5568' }}>IP Address</th>
            <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.875em', fontWeight: '600', color: '#4a5568' }}>Timestamp</th>
            <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.875em', fontWeight: '600', color: '#4a5568' }}>Details</th>
          </tr>
        </thead>
        <tbody>
          {failedLogins.map((log, idx) => {
            const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
            return (
              <tr key={idx} style={{ borderTop: '1px solid #e2e8f0' }}>
                <td style={{ padding: '12px', fontSize: '0.875em' }}>{details?.email || 'N/A'}</td>
                <td style={{ padding: '12px', fontSize: '0.875em', fontFamily: 'monospace' }}>{details?.ip || 'N/A'}</td>
                <td style={{ padding: '12px', fontSize: '0.875em', color: '#718096' }}>
                  {formatTimestamp(log.timestamp)}
                </td>
                <td style={{ padding: '12px', fontSize: '0.875em', color: '#718096' }}>
                  {details?.userAgent ? details.userAgent.substring(0, 50) + '...' : 'N/A'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
);

// Audit Logs Tab
const AuditLogsTab = ({ recentActivity, formatTimestamp, getActionBadgeColor }) => (
  <div>
    <h3>Complete Audit Log</h3>
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead style={{ background: '#f7fafc' }}>
          <tr>
            <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.875em', fontWeight: '600', color: '#4a5568' }}>ID</th>
            <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.875em', fontWeight: '600', color: '#4a5568' }}>User</th>
            <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.875em', fontWeight: '600', color: '#4a5568' }}>Action</th>
            <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.875em', fontWeight: '600', color: '#4a5568' }}>Object</th>
            <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.875em', fontWeight: '600', color: '#4a5568' }}>Timestamp</th>
          </tr>
        </thead>
        <tbody>
          {recentActivity.map((log) => (
            <tr key={log.id} style={{ borderTop: '1px solid #e2e8f0' }}>
              <td style={{ padding: '12px', fontSize: '0.875em', fontFamily: 'monospace', color: '#718096' }}>
                {log.id}
              </td>
              <td style={{ padding: '12px', fontSize: '0.875em' }}>
                {log.username || `User ${log.user}`}
                <div style={{ fontSize: '0.75em', color: '#718096' }}>{log.email}</div>
              </td>
              <td style={{ padding: '12px' }}>
                <span style={{
                  padding: '4px 8px',
                  background: getActionBadgeColor(log.action),
                  borderRadius: '4px',
                  fontSize: '0.75em',
                  fontWeight: '600'
                }}>
                  {log.action}
                </span>
              </td>
              <td style={{ padding: '12px', fontSize: '0.875em', color: '#718096' }}>
                {log.object_type && `${log.object_type}: ${log.object_id}`}
              </td>
              <td style={{ padding: '12px', fontSize: '0.875em', color: '#718096' }}>
                {formatTimestamp(log.timestamp)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

// Security Events Tab
const SecurityEventsTab = ({ securityEvents, formatTimestamp, getSeverityColor }) => (
  <div>
    <h3>Security Events (Last 7 Days)</h3>
    {securityEvents.length === 0 ? (
      <div style={{ 
        padding: '48px', 
        textAlign: 'center', 
        background: '#f7fafc', 
        borderRadius: '8px',
        color: '#718096'
      }}>
        No security events detected. All systems normal.
      </div>
    ) : (
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f7fafc' }}>
            <tr>
              <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.875em', fontWeight: '600', color: '#4a5568' }}>Severity</th>
              <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.875em', fontWeight: '600', color: '#4a5568' }}>Event</th>
              <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.875em', fontWeight: '600', color: '#4a5568' }}>User</th>
              <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.875em', fontWeight: '600', color: '#4a5568' }}>Timestamp</th>
              <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.875em', fontWeight: '600', color: '#4a5568' }}>Details</th>
            </tr>
          </thead>
          <tbody>
            {securityEvents.map((event, idx) => {
              const details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
              const severity = event.action.includes('unauthorized') ? 'high' : 
                             event.action.includes('denied') ? 'medium' : 'low';
              return (
                <tr key={idx} style={{ borderTop: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      display: 'inline-block',
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: getSeverityColor(severity)
                    }} />
                  </td>
                  <td style={{ padding: '12px', fontSize: '0.875em', fontWeight: '600' }}>
                    {event.action}
                  </td>
                  <td style={{ padding: '12px', fontSize: '0.875em' }}>
                    User {event.user}
                  </td>
                  <td style={{ padding: '12px', fontSize: '0.875em', color: '#718096' }}>
                    {formatTimestamp(event.timestamp)}
                  </td>
                  <td style={{ padding: '12px', fontSize: '0.75em', color: '#718096', maxWidth: '300px' }}>
                    {JSON.stringify(details).substring(0, 100)}...
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

// Analytics Tab
const AnalyticsTab = ({ actionBreakdown, topUsers }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
    <div>
      <h3>Action Breakdown (Last 24h)</h3>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
        {actionBreakdown.map((item, idx) => (
          <div key={idx} style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            padding: '12px 0',
            borderBottom: idx < actionBreakdown.length - 1 ? '1px solid #e2e8f0' : 'none'
          }}>
            <div style={{ fontSize: '0.9em' }}>{item.action}</div>
            <div style={{ fontWeight: 'bold', color: '#4299e1' }}>{item.count}</div>
          </div>
        ))}
      </div>
    </div>

    <div>
      <h3>User Activity Ranking (7d)</h3>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
        {topUsers.map((user, idx) => {
          const maxCount = topUsers[0]?.activity_count || 1;
          const percentage = (user.activity_count / maxCount) * 100;
          return (
            <div key={idx} style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <div style={{ fontSize: '0.875em', fontWeight: '600' }}>{user.username}</div>
                <div style={{ fontSize: '0.875em', color: '#4299e1', fontWeight: 'bold' }}>
                  {user.activity_count}
                </div>
              </div>
              <div style={{ 
                height: '8px', 
                background: '#e2e8f0', 
                borderRadius: '4px',
                overflow: 'hidden'
              }}>
                <div style={{ 
                  width: `${percentage}%`, 
                  height: '100%', 
                  background: '#4299e1',
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  </div>
);

export default SecurityDashboard;

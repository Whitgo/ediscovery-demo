import React, { useEffect, useState, useContext } from "react";
import { apiGet, apiPost, apiPatch } from "../utils/api";
import { UserContext } from "../context/UserContext";
import { canAccess } from "../utils/rbac";

export default function IncidentDashboard() {
  const user = useContext(UserContext);
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [filter, setFilter] = useState('all'); // all, open, critical, breach
  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    critical: 0,
    breaches: 0,
    resolved: 0
  });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBreachNotificationModal, setShowBreachNotificationModal] = useState(false);

  useEffect(() => {
    loadIncidents();
    const interval = setInterval(loadIncidents, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadIncidents = async () => {
    try {
      const data = await apiGet('/incidents');
      setIncidents(data.incidents || []);
      calculateStats(data.incidents || []);
      setLoading(false);
    } catch (error) {
      console.error('Error loading incidents:', error);
      setLoading(false);
    }
  };

  const calculateStats = (incidentList) => {
    const newStats = {
      total: incidentList.length,
      open: incidentList.filter(i => i.status === 'open' || i.status === 'investigating').length,
      critical: incidentList.filter(i => i.severity === 'critical').length,
      breaches: incidentList.filter(i => i.requires_breach_notification).length,
      resolved: incidentList.filter(i => i.status === 'resolved' || i.status === 'closed').length
    };
    setStats(newStats);
  };

  const getFilteredIncidents = () => {
    switch (filter) {
      case 'open':
        return incidents.filter(i => i.status === 'open' || i.status === 'investigating');
      case 'critical':
        return incidents.filter(i => i.severity === 'critical');
      case 'breach':
        return incidents.filter(i => i.requires_breach_notification);
      default:
        return incidents;
    }
  };

  const getSeverityColor = (severity) => {
    const colors = {
      'low': '#48bb78',
      'medium': '#ed8936',
      'high': '#f56565',
      'critical': '#c53030'
    };
    return colors[severity] || '#718096';
  };

  const getStatusColor = (status) => {
    const colors = {
      'open': '#ed8936',
      'investigating': '#3182ce',
      'contained': '#805ad5',
      'resolved': '#48bb78',
      'closed': '#718096'
    };
    return colors[status] || '#718096';
  };

  const getRemainingTime = (detectedAt, requiresNotification) => {
    if (!requiresNotification) return null;
    
    const detected = new Date(detectedAt);
    const deadline = new Date(detected.getTime() + (72 * 60 * 60 * 1000)); // 72 hours
    const now = new Date();
    const remaining = deadline - now;
    
    if (remaining <= 0) {
      return { expired: true, text: 'OVERDUE', color: '#c53030' };
    }
    
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    
    let color = '#48bb78';
    if (hours < 12) color = '#c53030';
    else if (hours < 24) color = '#f56565';
    else if (hours < 48) color = '#ed8936';
    
    return { expired: false, text: `${hours}h ${minutes}m`, color };
  };

  const handleUpdateStatus = async (incidentId, newStatus) => {
    try {
      await apiPatch(`/incidents/${incidentId}`, { status: newStatus });
      await loadIncidents();
      if (selectedIncident?.id === incidentId) {
        const updated = incidents.find(i => i.id === incidentId);
        setSelectedIncident({ ...updated, status: newStatus });
      }
    } catch (error) {
      console.error('Error updating incident status:', error);
      alert('Failed to update incident status');
    }
  };

  const handleSendBreachNotification = async (incidentId) => {
    setShowBreachNotificationModal(incidentId);
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '2em' }}>⏳</div>
        <p>Loading incidents...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h1 style={{ margin: 0, fontSize: '2em', color: '#2d3748' }}>
            🚨 Incident Response Dashboard
          </h1>
          {canAccess(user.role, 'create', 'incident') && (
            <button
              onClick={() => setShowCreateModal(true)}
              style={{
                padding: '12px 24px',
                background: '#2166e8',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '1em'
              }}
            >
              + Create Incident
            </button>
          )}
        </div>
        <p style={{ color: '#718096', margin: 0 }}>
          Monitor and respond to security incidents in real-time
        </p>
      </div>

      {/* Statistics Cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '16px',
        marginBottom: '24px'
      }}>
        <StatCard
          icon="📊"
          label="Total Incidents"
          value={stats.total}
          color="#2166e8"
          onClick={() => setFilter('all')}
          active={filter === 'all'}
        />
        <StatCard
          icon="🔓"
          label="Open Incidents"
          value={stats.open}
          color="#ed8936"
          onClick={() => setFilter('open')}
          active={filter === 'open'}
        />
        <StatCard
          icon="🚨"
          label="Critical"
          value={stats.critical}
          color="#c53030"
          onClick={() => setFilter('critical')}
          active={filter === 'critical'}
        />
        <StatCard
          icon="⚠️"
          label="Breach Notifications"
          value={stats.breaches}
          color="#f56565"
          onClick={() => setFilter('breach')}
          active={filter === 'breach'}
        />
        <StatCard
          icon="✅"
          label="Resolved"
          value={stats.resolved}
          color="#48bb78"
        />
      </div>

      {/* Main Content Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedIncident ? '1fr 1fr' : '1fr', gap: '24px' }}>
        {/* Incident List */}
        <div style={{
          background: '#fff',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid #e2e8f0',
            background: '#f7fafc',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <h2 style={{ margin: 0, fontSize: '1.2em', color: '#2d3748' }}>
              Incidents ({getFilteredIncidents().length})
            </h2>
            {filter !== 'all' && (
              <button
                onClick={() => setFilter('all')}
                style={{
                  padding: '4px 12px',
                  background: 'transparent',
                  color: '#2166e8',
                  border: '1px solid #2166e8',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.9em'
                }}
              >
                Clear Filter
              </button>
            )}
          </div>
          <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
            {getFilteredIncidents().length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#718096' }}>
                <div style={{ fontSize: '3em', marginBottom: '16px' }}>🎉</div>
                <p>No incidents found</p>
              </div>
            ) : (
              getFilteredIncidents()
                .sort((a, b) => new Date(b.detected_at) - new Date(a.detected_at))
                .map(incident => (
                  <IncidentListItem
                    key={incident.id}
                    incident={incident}
                    selected={selectedIncident?.id === incident.id}
                    onClick={() => setSelectedIncident(incident)}
                    getSeverityColor={getSeverityColor}
                    getStatusColor={getStatusColor}
                    getRemainingTime={getRemainingTime}
                  />
                ))
            )}
          </div>
        </div>

        {/* Incident Detail Panel */}
        {selectedIncident && (
          <IncidentDetailPanel
            incident={selectedIncident}
            onClose={() => setSelectedIncident(null)}
            onUpdateStatus={handleUpdateStatus}
            onSendBreachNotification={handleSendBreachNotification}
            getSeverityColor={getSeverityColor}
            getStatusColor={getStatusColor}
            getRemainingTime={getRemainingTime}
            canUpdate={canAccess(user.role, 'update', 'incident')}
          />
        )}
      </div>

      {/* Create Incident Modal */}
      {showCreateModal && (
        <CreateIncidentModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadIncidents();
          }}
        />
      )}

      {/* Breach Notification Modal */}
      {showBreachNotificationModal && (
        <BreachNotificationModal
          incidentId={showBreachNotificationModal}
          onClose={() => setShowBreachNotificationModal(false)}
          onSuccess={() => {
            setShowBreachNotificationModal(false);
            loadIncidents();
          }}
        />
      )}
    </div>
  );
}

// Statistics Card Component
function StatCard({ icon, label, value, color, onClick, active }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: active ? '#edf2f7' : '#fff',
        border: active ? `2px solid ${color}` : '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '20px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s',
        ':hover': onClick ? { transform: 'translateY(-2px)', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' } : {}
      }}
    >
      <div style={{ fontSize: '2em', marginBottom: '8px' }}>{icon}</div>
      <div style={{ fontSize: '2em', fontWeight: '700', color, marginBottom: '4px' }}>
        {value}
      </div>
      <div style={{ fontSize: '0.9em', color: '#718096' }}>{label}</div>
    </div>
  );
}

// Incident List Item Component
function IncidentListItem({ incident, selected, onClick, getSeverityColor, getStatusColor, getRemainingTime }) {
  const remainingTime = getRemainingTime(incident.detected_at, incident.requires_breach_notification);
  
  return (
    <div
      onClick={onClick}
      style={{
        padding: '16px 20px',
        borderBottom: '1px solid #e2e8f0',
        cursor: 'pointer',
        background: selected ? '#edf2f7' : '#fff',
        transition: 'background 0.2s'
      }}
      onMouseOver={(e) => !selected && (e.currentTarget.style.background = '#f7fafc')}
      onMouseOut={(e) => !selected && (e.currentTarget.style.background = '#fff')}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '0.75em',
                fontWeight: '700',
                color: '#fff',
                background: getSeverityColor(incident.severity),
                textTransform: 'uppercase'
              }}
            >
              {incident.severity}
            </span>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '0.75em',
                fontWeight: '600',
                color: '#fff',
                background: getStatusColor(incident.status),
                textTransform: 'capitalize'
              }}
            >
              {incident.status}
            </span>
            {incident.requires_breach_notification && (
              <span style={{ fontSize: '1.2em' }} title="Requires breach notification">⚠️</span>
            )}
          </div>
          <div style={{ fontWeight: '600', color: '#2d3748', marginBottom: '4px' }}>
            {incident.incident_type.replace(/_/g, ' ').toUpperCase()}
          </div>
          <div style={{ fontSize: '0.9em', color: '#718096' }}>
            {incident.description?.substring(0, 100)}{incident.description?.length > 100 ? '...' : ''}
          </div>
        </div>
        {remainingTime && (
          <div style={{ 
            padding: '4px 12px',
            borderRadius: '4px',
            background: remainingTime.color + '20',
            color: remainingTime.color,
            fontSize: '0.85em',
            fontWeight: '700',
            whiteSpace: 'nowrap',
            marginLeft: '12px'
          }}>
            {remainingTime.expired ? '⏰ OVERDUE' : `⏰ ${remainingTime.text}`}
          </div>
        )}
      </div>
      <div style={{ fontSize: '0.85em', color: '#a0aec0' }}>
        Detected: {new Date(incident.detected_at).toLocaleString()}
      </div>
    </div>
  );
}

// Incident Detail Panel Component
function IncidentDetailPanel({ 
  incident, 
  onClose, 
  onUpdateStatus, 
  onSendBreachNotification,
  getSeverityColor, 
  getStatusColor, 
  getRemainingTime,
  canUpdate 
}) {
  const remainingTime = getRemainingTime(incident.detected_at, incident.requires_breach_notification);
  const [showTimeline, setShowTimeline] = useState(true);
  const [showActions, setShowActions] = useState(true);
  const [newNote, setNewNote] = useState('');

  const statusFlow = {
    'open': ['investigating', 'resolved', 'closed'],
    'investigating': ['contained', 'resolved', 'closed'],
    'contained': ['resolved', 'closed'],
    'resolved': ['closed'],
    'closed': []
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    try {
      await apiPost(`/incidents/${incident.id}/notes`, { note: newNote });
      setNewNote('');
      alert('Note added successfully');
    } catch (error) {
      console.error('Error adding note:', error);
      alert('Failed to add note');
    }
  };

  return (
    <div style={{
      background: '#fff',
      borderRadius: '8px',
      border: '1px solid #e2e8f0',
      overflow: 'hidden',
      maxHeight: '600px',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid #e2e8f0',
        background: '#f7fafc',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h2 style={{ margin: 0, fontSize: '1.2em', color: '#2d3748' }}>
          Incident Details
        </h2>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            fontSize: '1.5em',
            cursor: 'pointer',
            color: '#718096',
            padding: '0',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '4px'
          }}
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {/* Status Badges */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <span
            style={{
              padding: '4px 12px',
              borderRadius: '4px',
              fontSize: '0.85em',
              fontWeight: '700',
              color: '#fff',
              background: getSeverityColor(incident.severity)
            }}
          >
            {incident.severity.toUpperCase()}
          </span>
          <span
            style={{
              padding: '4px 12px',
              borderRadius: '4px',
              fontSize: '0.85em',
              fontWeight: '700',
              color: '#fff',
              background: getStatusColor(incident.status)
            }}
          >
            {incident.status.toUpperCase()}
          </span>
          {incident.requires_breach_notification && (
            <span
              style={{
                padding: '4px 12px',
                borderRadius: '4px',
                fontSize: '0.85em',
                fontWeight: '700',
                color: '#fff',
                background: '#f56565'
              }}
            >
              ⚠️ BREACH NOTIFICATION REQUIRED
            </span>
          )}
        </div>

        {/* GDPR Countdown */}
        {remainingTime && (
          <div style={{
            padding: '16px',
            borderRadius: '8px',
            background: remainingTime.expired ? '#fed7d7' : remainingTime.color + '20',
            border: `2px solid ${remainingTime.color}`,
            marginBottom: '20px'
          }}>
            <div style={{ fontWeight: '700', color: remainingTime.color, marginBottom: '4px' }}>
              {remainingTime.expired ? '⏰ GDPR DEADLINE EXCEEDED' : '⏰ GDPR 72-Hour Deadline'}
            </div>
            <div style={{ fontSize: '1.5em', fontWeight: '700', color: remainingTime.color, marginBottom: '4px' }}>
              {remainingTime.text}
            </div>
            <div style={{ fontSize: '0.85em', color: '#718096' }}>
              Detected: {new Date(incident.detected_at).toLocaleString()}
            </div>
            {canUpdate && !incident.breach_notification_sent_at && (
              <button
                onClick={() => onSendBreachNotification(incident.id)}
                style={{
                  marginTop: '12px',
                  padding: '8px 16px',
                  background: '#2166e8',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '0.9em'
                }}
              >
                📧 Send Breach Notification
              </button>
            )}
            {incident.breach_notification_sent_at && (
              <div style={{
                marginTop: '8px',
                padding: '8px',
                background: '#c6f6d5',
                borderRadius: '4px',
                color: '#22543d',
                fontSize: '0.85em',
                fontWeight: '600'
              }}>
                ✅ Breach notification sent: {new Date(incident.breach_notification_sent_at).toLocaleString()}
              </div>
            )}
          </div>
        )}

        {/* Incident Info */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '1.1em', color: '#2d3748', marginBottom: '12px' }}>
            {incident.incident_type.replace(/_/g, ' ').toUpperCase()}
          </h3>
          <div style={{ color: '#4a5568', marginBottom: '16px', lineHeight: '1.6' }}>
            {incident.description}
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px', fontSize: '0.9em' }}>
            <div style={{ color: '#718096', fontWeight: '600' }}>Incident ID:</div>
            <div style={{ color: '#2d3748' }}>#{incident.id}</div>
            
            <div style={{ color: '#718096', fontWeight: '600' }}>Detected At:</div>
            <div style={{ color: '#2d3748' }}>{new Date(incident.detected_at).toLocaleString()}</div>
            
            {incident.resolved_at && (
              <>
                <div style={{ color: '#718096', fontWeight: '600' }}>Resolved At:</div>
                <div style={{ color: '#2d3748' }}>{new Date(incident.resolved_at).toLocaleString()}</div>
              </>
            )}
            
            {incident.affected_records > 0 && (
              <>
                <div style={{ color: '#718096', fontWeight: '600' }}>Affected Records:</div>
                <div style={{ color: '#2d3748', fontWeight: '700' }}>{incident.affected_records.toLocaleString()}</div>
              </>
            )}
            
            {incident.affected_users > 0 && (
              <>
                <div style={{ color: '#718096', fontWeight: '600' }}>Affected Users:</div>
                <div style={{ color: '#2d3748', fontWeight: '700' }}>{incident.affected_users.toLocaleString()}</div>
              </>
            )}
          </div>
        </div>

        {/* Status Update Actions */}
        {canUpdate && statusFlow[incident.status]?.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <button
              onClick={() => setShowActions(!showActions)}
              style={{
                width: '100%',
                padding: '12px',
                background: '#f7fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600',
                color: '#2d3748',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px'
              }}
            >
              <span>🎯 Quick Actions</span>
              <span>{showActions ? '▼' : '▶'}</span>
            </button>
            {showActions && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {statusFlow[incident.status].map(nextStatus => (
                  <button
                    key={nextStatus}
                    onClick={() => onUpdateStatus(incident.id, nextStatus)}
                    style={{
                      padding: '8px 16px',
                      background: '#fff',
                      color: getStatusColor(nextStatus),
                      border: `2px solid ${getStatusColor(nextStatus)}`,
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '0.9em',
                      textTransform: 'capitalize'
                    }}
                  >
                    → {nextStatus}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Timeline */}
        <div style={{ marginBottom: '24px' }}>
          <button
            onClick={() => setShowTimeline(!showTimeline)}
            style={{
              width: '100%',
              padding: '12px',
              background: '#f7fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600',
              color: '#2d3748',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px'
            }}
          >
            <span>📅 Timeline & Response Actions</span>
            <span>{showTimeline ? '▼' : '▶'}</span>
          </button>
          {showTimeline && (
            <div style={{ paddingLeft: '16px', borderLeft: '3px solid #e2e8f0' }}>
              <TimelineItem
                icon="🔍"
                title="Incident Detected"
                time={incident.detected_at}
                color="#ed8936"
              />
              {incident.status === 'investigating' && (
                <TimelineItem
                  icon="🔎"
                  title="Investigation Started"
                  time={incident.updated_at}
                  color="#3182ce"
                />
              )}
              {incident.status === 'contained' && (
                <TimelineItem
                  icon="🛡️"
                  title="Incident Contained"
                  time={incident.updated_at}
                  color="#805ad5"
                />
              )}
              {incident.breach_notification_sent_at && (
                <TimelineItem
                  icon="📧"
                  title="Breach Notification Sent"
                  time={incident.breach_notification_sent_at}
                  color="#2166e8"
                />
              )}
              {incident.resolved_at && (
                <TimelineItem
                  icon="✅"
                  title="Incident Resolved"
                  time={incident.resolved_at}
                  color="#48bb78"
                />
              )}
              {incident.status === 'closed' && (
                <TimelineItem
                  icon="🔒"
                  title="Incident Closed"
                  time={incident.updated_at}
                  color="#718096"
                />
              )}
            </div>
          )}
        </div>

        {/* Add Note Section */}
        {canUpdate && (
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontWeight: '600', color: '#2d3748', marginBottom: '8px' }}>
              📝 Add Response Note
            </label>
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Document response actions, findings, or updates..."
              style={{
                width: '100%',
                minHeight: '80px',
                padding: '12px',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                fontSize: '0.95em',
                fontFamily: 'inherit',
                resize: 'vertical',
                marginBottom: '8px'
              }}
            />
            <button
              onClick={handleAddNote}
              disabled={!newNote.trim()}
              style={{
                padding: '8px 16px',
                background: newNote.trim() ? '#2166e8' : '#cbd5e0',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: newNote.trim() ? 'pointer' : 'not-allowed',
                fontWeight: '600',
                fontSize: '0.9em'
              }}
            >
              Add Note
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Timeline Item Component
function TimelineItem({ icon, title, time, color }) {
  return (
    <div style={{ 
      paddingLeft: '24px', 
      paddingBottom: '16px',
      position: 'relative'
    }}>
      <div style={{
        position: 'absolute',
        left: '-11px',
        top: '0',
        width: '20px',
        height: '20px',
        borderRadius: '50%',
        background: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.7em'
      }}>
        {icon}
      </div>
      <div style={{ fontWeight: '600', color: '#2d3748', marginBottom: '2px' }}>
        {title}
      </div>
      <div style={{ fontSize: '0.85em', color: '#718096' }}>
        {new Date(time).toLocaleString()}
      </div>
    </div>
  );
}

// Create Incident Modal
function CreateIncidentModal({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    incident_type: 'unauthorized_access',
    severity: 'medium',
    description: '',
    affected_records: 0,
    affected_users: 0
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiPost('/incidents', formData);
      onSuccess();
    } catch (error) {
      console.error('Error creating incident:', error);
      alert('Failed to create incident');
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '8px',
        maxWidth: '600px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto'
      }}>
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{ margin: 0, fontSize: '1.5em', color: '#2d3748' }}>
            Create New Incident
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '1.5em',
              cursor: 'pointer',
              color: '#718096'
            }}
          >
            ✕
          </button>
        </div>
        
        <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', color: '#2d3748' }}>
              Incident Type *
            </label>
            <select
              value={formData.incident_type}
              onChange={(e) => setFormData({ ...formData, incident_type: e.target.value })}
              required
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                fontSize: '1em'
              }}
            >
              <option value="unauthorized_access">Unauthorized Access</option>
              <option value="data_breach">Data Breach</option>
              <option value="malware">Malware</option>
              <option value="phishing">Phishing</option>
              <option value="ddos">DDoS Attack</option>
              <option value="insider_threat">Insider Threat</option>
              <option value="system_compromise">System Compromise</option>
              <option value="data_loss">Data Loss</option>
            </select>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', color: '#2d3748' }}>
              Severity *
            </label>
            <select
              value={formData.severity}
              onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
              required
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                fontSize: '1em'
              }}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', color: '#2d3748' }}>
              Description *
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
              placeholder="Describe the incident in detail..."
              style={{
                width: '100%',
                minHeight: '100px',
                padding: '10px',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                fontSize: '1em',
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', color: '#2d3748' }}>
                Affected Records
              </label>
              <input
                type="number"
                min="0"
                value={formData.affected_records}
                onChange={(e) => setFormData({ ...formData, affected_records: parseInt(e.target.value) || 0 })}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  fontSize: '1em'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', color: '#2d3748' }}>
                Affected Users
              </label>
              <input
                type="number"
                min="0"
                value={formData.affected_users}
                onChange={(e) => setFormData({ ...formData, affected_users: parseInt(e.target.value) || 0 })}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  fontSize: '1em'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 20px',
                background: '#fff',
                color: '#718096',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: '10px 20px',
                background: submitting ? '#cbd5e0' : '#2166e8',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: submitting ? 'not-allowed' : 'pointer',
                fontWeight: '600'
              }}
            >
              {submitting ? 'Creating...' : 'Create Incident'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Breach Notification Modal
function BreachNotificationModal({ incidentId, onClose, onSuccess }) {
  const [recipients, setRecipients] = useState({
    regulatory: true,
    users: true,
    internal: true
  });
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    setSending(true);
    try {
      await apiPost(`/incidents/${incidentId}/notify-breach`, recipients);
      alert('Breach notifications sent successfully');
      onSuccess();
    } catch (error) {
      console.error('Error sending breach notifications:', error);
      alert('Failed to send breach notifications');
      setSending(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '8px',
        maxWidth: '500px',
        width: '100%'
      }}>
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #e2e8f0'
        }}>
          <h2 style={{ margin: 0, fontSize: '1.5em', color: '#2d3748' }}>
            📧 Send Breach Notifications
          </h2>
          <p style={{ margin: '8px 0 0 0', color: '#718096' }}>
            GDPR Article 33 - Breach notification to authorities and affected parties
          </p>
        </div>
        
        <div style={{ padding: '20px' }}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', padding: '12px', background: '#f7fafc', borderRadius: '6px', cursor: 'pointer', marginBottom: '8px' }}>
              <input
                type="checkbox"
                checked={recipients.regulatory}
                onChange={(e) => setRecipients({ ...recipients, regulatory: e.target.checked })}
                style={{ marginRight: '12px', width: '18px', height: '18px' }}
              />
              <div>
                <div style={{ fontWeight: '600', color: '#2d3748' }}>🏛️ Regulatory Authorities</div>
                <div style={{ fontSize: '0.85em', color: '#718096' }}>Data Protection Authority notification</div>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', padding: '12px', background: '#f7fafc', borderRadius: '6px', cursor: 'pointer', marginBottom: '8px' }}>
              <input
                type="checkbox"
                checked={recipients.users}
                onChange={(e) => setRecipients({ ...recipients, users: e.target.checked })}
                style={{ marginRight: '12px', width: '18px', height: '18px' }}
              />
              <div>
                <div style={{ fontWeight: '600', color: '#2d3748' }}>👥 Affected Users</div>
                <div style={{ fontSize: '0.85em', color: '#718096' }}>Individual breach notifications</div>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', padding: '12px', background: '#f7fafc', borderRadius: '6px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={recipients.internal}
                onChange={(e) => setRecipients({ ...recipients, internal: e.target.checked })}
                style={{ marginRight: '12px', width: '18px', height: '18px' }}
              />
              <div>
                <div style={{ fontWeight: '600', color: '#2d3748' }}>🔔 Internal Team</div>
                <div style={{ fontSize: '0.85em', color: '#718096' }}>Incident response team alert</div>
              </div>
            </label>
          </div>

          <div style={{ 
            padding: '16px',
            background: '#fef5e7',
            border: '1px solid #f9e79f',
            borderRadius: '6px',
            marginBottom: '20px'
          }}>
            <div style={{ fontWeight: '600', color: '#6c5ce7', marginBottom: '4px' }}>
              ⚠️ Important
            </div>
            <div style={{ fontSize: '0.9em', color: '#6c5ce7' }}>
              This action will send official breach notifications to the selected recipients.
              Ensure all incident details are accurate before proceeding.
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              onClick={onClose}
              style={{
                padding: '10px 20px',
                background: '#fff',
                color: '#718096',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={sending || (!recipients.regulatory && !recipients.users && !recipients.internal)}
              style={{
                padding: '10px 20px',
                background: (sending || (!recipients.regulatory && !recipients.users && !recipients.internal)) ? '#cbd5e0' : '#2166e8',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: (sending || (!recipients.regulatory && !recipients.users && !recipients.internal)) ? 'not-allowed' : 'pointer',
                fontWeight: '600'
              }}
            >
              {sending ? 'Sending...' : 'Send Notifications'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

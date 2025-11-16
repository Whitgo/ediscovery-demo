import React, { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../utils/api';

export default function PrivacyCenter({ user }) {
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      const data = await apiGet('/privacy/my-requests');
      setRequests(data.requests || []);
    } catch (err) {
      console.error('Failed to load requests:', err);
    }
  };

  const handleExportData = async () => {
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await fetch('https://localhost:4443/api/privacy/export', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Get the filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      const filename = contentDisposition 
        ? contentDisposition.split('filename=')[1].replace(/"/g, '')
        : `data_export_${Date.now()}.json`;

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setMessage({ type: 'success', text: 'Your data has been exported successfully!' });
      await loadRequests(); // Refresh requests list

    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to export data. Please try again.' });
      console.error('Export error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRequest = async () => {
    if (!deleteReason.trim()) {
      setMessage({ type: 'error', text: 'Please provide a reason for deletion.' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const result = await apiPost('/privacy/delete-request', { reason: deleteReason });
      setMessage({ 
        type: 'success', 
        text: `Deletion request submitted successfully. Request ID: ${result.request_id}` 
      });
      setShowDeleteConfirm(false);
      setDeleteReason('');
      await loadRequests();

    } catch (err) {
      setMessage({ 
        type: 'error', 
        text: err.response?.data?.error || 'Failed to submit deletion request.' 
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'pending': '#ed8936',
      'approved': '#48bb78',
      'rejected': '#f56565',
      'completed': '#4299e1'
    };
    return colors[status] || '#a0aec0';
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px' }}>
      <h2 style={{ fontSize: '1.75em', marginBottom: '8px', color: '#2d3748' }}>
        🔒 Privacy Center
      </h2>
      <p style={{ color: '#718096', marginBottom: '32px' }}>
        Manage your personal data and privacy rights (GDPR/CCPA compliant)
      </p>

      {/* Message Alert */}
      {message.text && (
        <div style={{
          padding: '16px',
          marginBottom: '24px',
          borderRadius: '8px',
          background: message.type === 'success' ? '#f0fff4' : '#fff5f5',
          border: `1px solid ${message.type === 'success' ? '#9ae6b4' : '#feb2b2'}`,
          color: message.type === 'success' ? '#22543d' : '#742a2a'
        }}>
          {message.text}
        </div>
      )}

      {/* Data Export Section */}
      <div style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '24px',
        marginBottom: '24px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        <h3 style={{ margin: '0 0 12px 0', color: '#2d3748', display: 'flex', alignItems: 'center', gap: '8px' }}>
          📥 Export Your Data
        </h3>
        <p style={{ color: '#718096', marginBottom: '16px', fontSize: '0.95em' }}>
          Download all your personal information in JSON format. This includes your profile, cases, documents, 
          activity logs, and notifications.
        </p>
        <button
          onClick={handleExportData}
          disabled={loading}
          style={{
            padding: '12px 24px',
            background: loading ? '#a0aec0' : '#2166e8',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: '600',
            fontSize: '0.95em'
          }}
        >
          {loading ? 'Exporting...' : 'Download My Data'}
        </button>
        <p style={{ color: '#a0aec0', fontSize: '0.85em', marginTop: '12px' }}>
          ✓ GDPR Article 15 - Right to Access &nbsp; | &nbsp; ✓ CCPA § 1798.110
        </p>
      </div>

      {/* Account Deletion Section */}
      <div style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '24px',
        marginBottom: '24px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        <h3 style={{ margin: '0 0 12px 0', color: '#2d3748', display: 'flex', alignItems: 'center', gap: '8px' }}>
          🗑️ Delete My Account
        </h3>
        <p style={{ color: '#718096', marginBottom: '16px', fontSize: '0.95em' }}>
          Request permanent deletion of your account and all associated data. This action requires manager approval 
          and cannot be undone.
        </p>

        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            style={{
              padding: '12px 24px',
              background: '#fff',
              color: '#f56565',
              border: '2px solid #f56565',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.95em'
            }}
          >
            Request Account Deletion
          </button>
        ) : (
          <div style={{
            padding: '16px',
            background: '#fff5f5',
            border: '1px solid #feb2b2',
            borderRadius: '8px'
          }}>
            <p style={{ color: '#742a2a', fontWeight: '600', marginBottom: '12px' }}>
              ⚠️ This action requires manager approval
            </p>
            <textarea
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="Please explain why you want to delete your account (required)..."
              style={{
                width: '100%',
                minHeight: '100px',
                padding: '12px',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                fontSize: '0.95em',
                marginBottom: '12px',
                fontFamily: 'inherit'
              }}
            />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handleDeleteRequest}
                disabled={loading || !deleteReason.trim()}
                style={{
                  padding: '10px 20px',
                  background: loading || !deleteReason.trim() ? '#a0aec0' : '#f56565',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: loading || !deleteReason.trim() ? 'not-allowed' : 'pointer',
                  fontWeight: '600'
                }}
              >
                {loading ? 'Submitting...' : 'Submit Request'}
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteReason('');
                }}
                disabled={loading}
                style={{
                  padding: '10px 20px',
                  background: '#fff',
                  color: '#718096',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontWeight: '600'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        <p style={{ color: '#a0aec0', fontSize: '0.85em', marginTop: '12px' }}>
          ✓ GDPR Article 17 - Right to Erasure &nbsp; | &nbsp; ✓ CCPA § 1798.105
        </p>
      </div>

      {/* Request History */}
      {requests.length > 0 && (
        <div style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <h3 style={{ margin: '0 0 16px 0', color: '#2d3748' }}>
            📋 My Privacy Requests
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {requests.map(req => (
              <div
                key={req.id}
                style={{
                  padding: '16px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontWeight: '600', color: '#2d3748', marginBottom: '4px', textTransform: 'capitalize' }}>
                    {req.request_type} Request
                  </div>
                  <div style={{ fontSize: '0.85em', color: '#718096' }}>
                    Requested: {new Date(req.requested_at).toLocaleString()}
                  </div>
                  {req.user_reason && (
                    <div style={{ fontSize: '0.85em', color: '#718096', marginTop: '4px', fontStyle: 'italic' }}>
                      Reason: {req.user_reason}
                    </div>
                  )}
                  {req.admin_notes && (
                    <div style={{ fontSize: '0.85em', color: '#4299e1', marginTop: '4px' }}>
                      Admin Note: {req.admin_notes}
                    </div>
                  )}
                </div>
                <div style={{
                  padding: '6px 16px',
                  background: getStatusColor(req.status) + '20',
                  color: getStatusColor(req.status),
                  borderRadius: '20px',
                  fontWeight: '600',
                  fontSize: '0.85em',
                  textTransform: 'capitalize'
                }}>
                  {req.status}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Privacy Information */}
      <div style={{
        marginTop: '32px',
        padding: '20px',
        background: '#f7fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '8px'
      }}>
        <h4 style={{ margin: '0 0 12px 0', color: '#2d3748', fontSize: '1.1em' }}>
          Your Privacy Rights
        </h4>
        <ul style={{ color: '#718096', fontSize: '0.9em', lineHeight: '1.8', margin: 0, paddingLeft: '20px' }}>
          <li><strong>Right to Access:</strong> Request a copy of all your personal data</li>
          <li><strong>Right to Deletion:</strong> Request permanent deletion of your account and data</li>
          <li><strong>Right to Rectification:</strong> Update incorrect personal information</li>
          <li><strong>Right to Data Portability:</strong> Receive your data in a machine-readable format</li>
          <li><strong>Right to Restrict Processing:</strong> Limit how we process your data</li>
        </ul>
        <p style={{ color: '#a0aec0', fontSize: '0.8em', marginTop: '16px', marginBottom: 0 }}>
          For questions about privacy, contact your system administrator.
        </p>
      </div>
    </div>
  );
}

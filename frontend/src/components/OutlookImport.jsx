import React, { useState, useEffect } from "react";

export default function OutlookImport({ caseId, onClose, onSuccess }) {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState('inbox');
  const [messages, setMessages] = useState([]);
  const [selectedMessages, setSelectedMessages] = useState([]);
  const [importing, setImporting] = useState(false);
  const [includeAttachments, setIncludeAttachments] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    checkConnection();
  }, []);

  async function checkConnection() {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/outlook/status', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Failed to check connection');
      
      const data = await response.json();
      setConnected(data.connected);
      
      if (data.connected) {
        loadFolders();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect() {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/outlook/auth-url', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Failed to get auth URL');
      
      const data = await response.json();
      
      // Open OAuth flow in new window
      const authWindow = window.open(
        data.authUrl,
        'outlook-auth',
        'width=600,height=700'
      );
      
      // Listen for OAuth callback
      window.addEventListener('message', handleOAuthCallback);
      
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleOAuthCallback(event) {
    if (event.data.type === 'outlook-oauth-code') {
      const code = event.data.code;
      
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/outlook/token', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ code })
        });
        
        if (!response.ok) throw new Error('Failed to exchange token');
        
        setConnected(true);
        loadFolders();
        
      } catch (err) {
        setError(err.message);
      }
      
      window.removeEventListener('message', handleOAuthCallback);
    }
  }

  async function loadFolders() {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/outlook/folders', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Failed to load folders');
      
      const data = await response.json();
      setFolders(data.folders);
      
      // Load messages from default folder
      loadMessages('inbox');
      
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadMessages(folderId, search = '') {
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        folderId,
        top: 50
      });
      
      if (search) {
        params.append('search', search);
      }
      
      const response = await fetch(`/api/outlook/messages?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Failed to load messages');
      
      const data = await response.json();
      setMessages(data.messages);
      setSelectedMessages([]);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    if (selectedMessages.length === 0) {
      setError('Please select at least one message to import');
      return;
    }
    
    setImporting(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/outlook/import/${caseId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messageIds: selectedMessages,
          includeAttachments
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Import failed');
      }
      
      const result = await response.json();
      
      if (onSuccess) {
        onSuccess(result);
      }
      
      onClose();
      
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  }

  function toggleMessage(messageId) {
    setSelectedMessages(prev => 
      prev.includes(messageId)
        ? prev.filter(id => id !== messageId)
        : [...prev, messageId]
    );
  }

  function toggleAll() {
    if (selectedMessages.length === messages.length) {
      setSelectedMessages([]);
    } else {
      setSelectedMessages(messages.map(m => m.id));
    }
  }

  function handleSearch() {
    loadMessages(selectedFolder, searchQuery);
  }

  function handleDisconnect() {
    if (window.confirm('Disconnect Outlook account?')) {
      const token = localStorage.getItem('token');
      fetch('/api/outlook/disconnect', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(() => {
        setConnected(false);
        setFolders([]);
        setMessages([]);
        setSelectedMessages([]);
      });
    }
  }

  if (loading && !connected) {
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
        zIndex: 1000
      }}>
        <div style={{
          background: '#fff',
          padding: '40px',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '1.2em', marginBottom: '16px' }}>Loading...</div>
        </div>
      </div>
    );
  }

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
        maxWidth: '900px',
        width: '100%',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '24px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{ margin: 0, fontSize: '1.5em', color: '#2d3748' }}>
            📧 Import from Outlook
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '1.5em',
              cursor: 'pointer',
              color: '#718096',
              padding: '4px'
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '24px'
        }}>
          {!connected ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: '3em', marginBottom: '16px' }}>📧</div>
              <h3 style={{ marginBottom: '12px', color: '#2d3748' }}>
                Connect Your Outlook Account
              </h3>
              <p style={{ color: '#718096', marginBottom: '24px' }}>
                Import emails and attachments directly from Microsoft Outlook into your case.
              </p>
              <button
                onClick={handleConnect}
                style={{
                  padding: '12px 24px',
                  background: '#0078d4',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '1em',
                  fontWeight: '600'
                }}
              >
                Connect Outlook
              </button>
            </div>
          ) : (
            <>
              {/* Folder Selection */}
              <div style={{ marginBottom: '20px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                <label style={{ fontWeight: '600', color: '#2d3748' }}>Folder:</label>
                <select
                  value={selectedFolder}
                  onChange={(e) => {
                    setSelectedFolder(e.target.value);
                    loadMessages(e.target.value, searchQuery);
                  }}
                  style={{
                    padding: '8px',
                    border: '1px solid #cbd5e0',
                    borderRadius: '6px',
                    fontSize: '0.95em',
                    flex: 1
                  }}
                >
                  {folders.map(folder => (
                    <option key={folder.id} value={folder.id}>
                      {folder.displayName} ({folder.totalItemCount})
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleDisconnect}
                  style={{
                    padding: '8px 12px',
                    background: '#e53e3e',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.85em'
                  }}
                >
                  Disconnect
                </button>
              </div>

              {/* Search */}
              <div style={{ marginBottom: '20px', display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Search emails..."
                  style={{
                    flex: 1,
                    padding: '8px',
                    border: '1px solid #cbd5e0',
                    borderRadius: '6px',
                    fontSize: '0.95em'
                  }}
                />
                <button
                  onClick={handleSearch}
                  style={{
                    padding: '8px 16px',
                    background: '#4299e1',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  Search
                </button>
              </div>

              {error && (
                <div style={{
                  padding: '12px',
                  background: '#fff5f5',
                  border: '1px solid #fc8181',
                  borderRadius: '6px',
                  color: '#c53030',
                  marginBottom: '16px'
                }}>
                  {error}
                </div>
              )}

              {/* Selection Controls */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px',
                padding: '12px',
                background: '#f7fafc',
                borderRadius: '6px'
              }}>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={selectedMessages.length === messages.length && messages.length > 0}
                      onChange={toggleAll}
                      style={{ width: '18px', height: '18px' }}
                    />
                    <span style={{ fontWeight: '600', color: '#2d3748' }}>
                      Select All ({selectedMessages.length} selected)
                    </span>
                  </label>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={includeAttachments}
                    onChange={(e) => setIncludeAttachments(e.target.checked)}
                    style={{ width: '18px', height: '18px' }}
                  />
                  <span style={{ fontSize: '0.9em', color: '#4a5568' }}>
                    Include Attachments
                  </span>
                </label>
              </div>

              {/* Messages List */}
              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#718096' }}>
                  Loading messages...
                </div>
              ) : messages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#718096' }}>
                  No messages found
                </div>
              ) : (
                <div style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  maxHeight: '400px',
                  overflow: 'auto'
                }}>
                  {messages.map(message => (
                    <div
                      key={message.id}
                      style={{
                        padding: '12px',
                        borderBottom: '1px solid #e2e8f0',
                        cursor: 'pointer',
                        background: selectedMessages.includes(message.id) ? '#ebf8ff' : '#fff',
                        display: 'flex',
                        gap: '12px',
                        alignItems: 'flex-start'
                      }}
                      onClick={() => toggleMessage(message.id)}
                    >
                      <input
                        type="checkbox"
                        checked={selectedMessages.includes(message.id)}
                        onChange={() => {}}
                        style={{ marginTop: '4px', width: '18px', height: '18px' }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontWeight: message.isRead ? 'normal' : '600',
                          marginBottom: '4px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {message.subject}
                        </div>
                        <div style={{
                          fontSize: '0.85em',
                          color: '#718096',
                          marginBottom: '4px'
                        }}>
                          From: {message.fromName} &lt;{message.from}&gt;
                        </div>
                        <div style={{
                          fontSize: '0.85em',
                          color: '#a0aec0'
                        }}>
                          {new Date(message.receivedDateTime).toLocaleString()}
                          {message.hasAttachments && ' 📎'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {connected && (
          <div style={{
            padding: '16px 24px',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end'
          }}>
            <button
              onClick={onClose}
              style={{
                padding: '10px 20px',
                background: '#fff',
                color: '#4a5568',
                border: '1px solid #cbd5e0',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={importing || selectedMessages.length === 0}
              style={{
                padding: '10px 20px',
                background: selectedMessages.length === 0 ? '#cbd5e0' : '#2166e8',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: selectedMessages.length === 0 ? 'not-allowed' : 'pointer',
                fontWeight: '600',
                opacity: importing ? 0.7 : 1
              }}
            >
              {importing ? 'Importing...' : `Import ${selectedMessages.length} Email(s)`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

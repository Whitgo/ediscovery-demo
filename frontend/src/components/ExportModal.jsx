import React, { useState } from "react";

export default function ExportModal({ caseId, documents, onClose }) {
  const [selectedDocs, setSelectedDocs] = useState([]);
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [selectAll, setSelectAll] = useState(false);

  const toggleDoc = (docId) => {
    setSelectedDocs(prev => 
      prev.includes(docId) 
        ? prev.filter(id => id !== docId)
        : [...prev, docId]
    );
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedDocs([]);
    } else {
      setSelectedDocs(documents.map(doc => doc.id));
    }
    setSelectAll(!selectAll);
  };

  const handlePreview = async () => {
    if (selectedDocs.length === 0) {
      setError('Please select at least one document to export');
      return;
    }

    setError('');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.REACT_APP_API_URL || 'http://localhost:4000'}/api/export/case/${caseId}/preview`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ documentIds: selectedDocs })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate preview');
      }

      const data = await response.json();
      setPreview(data);
    } catch (err) {
      console.error('Preview error:', err);
      setError(err.message || 'Failed to generate export preview');
    }
  };

  const handleExport = async () => {
    if (selectedDocs.length === 0) {
      setError('Please select at least one document to export');
      return;
    }

    setExporting(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.REACT_APP_API_URL || 'http://localhost:4000'}/api/export/case/${caseId}/documents`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            documentIds: selectedDocs,
            format: 'zip',
            includeMetadata
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Export failed');
      }

      // Download the ZIP file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Extract filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `case_export_${Date.now()}.zip`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Success - close modal after short delay
      setTimeout(() => {
        onClose();
      }, 1000);

    } catch (err) {
      console.error('Export error:', err);
      setError(err.message || 'Failed to export documents');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '8px',
        padding: '24px',
        maxWidth: '700px',
        width: '90%',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h3 style={{ margin: 0, color: '#1a202c' }}>📦 Export Documents</h3>
          <button
            onClick={onClose}
            disabled={exporting}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: exporting ? 'not-allowed' : 'pointer',
              color: '#718096',
              padding: '0',
              lineHeight: '1'
            }}
          >
            ×
          </button>
        </div>

        {error && (
          <div style={{
            padding: '12px',
            background: '#fff5f5',
            border: '1px solid #fc8181',
            borderRadius: '6px',
            color: '#c53030',
            marginBottom: '16px',
            fontSize: '0.9em'
          }}>
            ⚠️ {error}
          </div>
        )}

        {preview && (
          <div style={{
            padding: '12px 16px',
            background: '#ebf8ff',
            border: '1px solid #4299e1',
            borderRadius: '6px',
            marginBottom: '16px',
            fontSize: '0.9em'
          }}>
            <div style={{ fontWeight: '600', marginBottom: '8px', color: '#2c5282' }}>
              📊 Export Preview
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', color: '#2d3748' }}>
              <div>Documents: <strong>{preview.document_count}</strong></div>
              <div>Total Size: <strong>{preview.total_size_mb} MB</strong></div>
              {preview.missing_files > 0 && (
                <div style={{ gridColumn: '1 / -1', color: '#c53030' }}>
                  ⚠️ {preview.missing_files} documents have no stored file
                </div>
              )}
            </div>
          </div>
        )}

        <div style={{ marginBottom: '16px' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '12px'
          }}>
            <h4 style={{ margin: 0, color: '#2d3748', fontSize: '1em' }}>
              Select Documents ({selectedDocs.length} selected)
            </h4>
            <button
              onClick={toggleSelectAll}
              disabled={exporting}
              style={{
                padding: '6px 12px',
                background: '#edf2f7',
                border: '1px solid #cbd5e0',
                borderRadius: '4px',
                cursor: exporting ? 'not-allowed' : 'pointer',
                fontSize: '0.85em',
                fontWeight: '600',
                color: '#2d3748'
              }}
            >
              {selectAll ? '☑ Deselect All' : '☐ Select All'}
            </button>
          </div>

          <div style={{
            maxHeight: '300px',
            overflow: 'auto',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            padding: '8px'
          }}>
            {documents.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '32px', 
                color: '#718096' 
              }}>
                No documents available to export
              </div>
            ) : (
              documents.map(doc => (
                <label
                  key={doc.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '10px',
                    borderRadius: '4px',
                    cursor: exporting ? 'not-allowed' : 'pointer',
                    background: selectedDocs.includes(doc.id) ? '#ebf8ff' : 'transparent',
                    border: '1px solid',
                    borderColor: selectedDocs.includes(doc.id) ? '#4299e1' : 'transparent',
                    marginBottom: '6px',
                    transition: 'all 0.2s'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedDocs.includes(doc.id)}
                    onChange={() => toggleDoc(doc.id)}
                    disabled={exporting}
                    style={{
                      marginRight: '10px',
                      cursor: exporting ? 'not-allowed' : 'pointer'
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ 
                      fontWeight: '500', 
                      color: '#1a202c',
                      marginBottom: '2px'
                    }}>
                      {doc.name}
                    </div>
                    <div style={{ 
                      fontSize: '0.8em', 
                      color: '#718096',
                      display: 'flex',
                      gap: '12px'
                    }}>
                      {doc.file_type && (
                        <span>{doc.file_type.split('/').pop().toUpperCase()}</span>
                      )}
                      {doc.size && (
                        <span>{Math.round(doc.size / 1024)} KB</span>
                      )}
                      {doc.legal_category && (
                        <span>📋 {doc.legal_category}</span>
                      )}
                    </div>
                  </div>
                </label>
              ))
            )}
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            padding: '12px',
            background: '#f7fafc',
            borderRadius: '6px',
            cursor: exporting ? 'not-allowed' : 'pointer',
            border: '1px solid #e2e8f0'
          }}>
            <input
              type="checkbox"
              checked={includeMetadata}
              onChange={(e) => setIncludeMetadata(e.target.checked)}
              disabled={exporting}
              style={{ 
                marginRight: '10px',
                cursor: exporting ? 'not-allowed' : 'pointer'
              }}
            />
            <div>
              <div style={{ fontWeight: '600', color: '#2d3748', fontSize: '0.95em' }}>
                Include Metadata
              </div>
              <div style={{ fontSize: '0.8em', color: '#718096', marginTop: '2px' }}>
                Adds a JSON file with document metadata, tags, and timestamps
              </div>
            </div>
          </label>
        </div>

        <div style={{
          background: '#f7fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '6px',
          padding: '12px',
          fontSize: '0.85em',
          color: '#4a5568',
          marginBottom: '20px'
        }}>
          <div style={{ fontWeight: '600', marginBottom: '6px' }}>
            📋 Export includes:
          </div>
          <ul style={{ margin: '0', paddingLeft: '20px' }}>
            <li>Auto-generated audit-ready index page (PDF)</li>
            <li>All selected documents with sequential numbering</li>
            <li>Chain of custody with timestamps and user information</li>
            {includeMetadata && <li>Metadata JSON file with tags and categories</li>}
          </ul>
        </div>

        <div style={{ 
          display: 'flex', 
          gap: '12px', 
          justifyContent: 'flex-end' 
        }}>
          <button
            onClick={handlePreview}
            disabled={exporting || selectedDocs.length === 0}
            style={{
              padding: '10px 20px',
              background: '#edf2f7',
              color: '#2d3748',
              border: '1px solid #cbd5e0',
              borderRadius: '6px',
              cursor: (exporting || selectedDocs.length === 0) ? 'not-allowed' : 'pointer',
              fontSize: '0.95em',
              fontWeight: '600'
            }}
          >
            👁 Preview
          </button>
          <button
            onClick={onClose}
            disabled={exporting}
            style={{
              padding: '10px 20px',
              background: '#fff',
              color: '#4a5568',
              border: '1px solid #cbd5e0',
              borderRadius: '6px',
              cursor: exporting ? 'not-allowed' : 'pointer',
              fontSize: '0.95em',
              fontWeight: '600'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={exporting || selectedDocs.length === 0}
            style={{
              padding: '10px 20px',
              background: (exporting || selectedDocs.length === 0) ? '#cbd5e0' : '#48bb78',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: (exporting || selectedDocs.length === 0) ? 'not-allowed' : 'pointer',
              fontSize: '0.95em',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {exporting && (
              <span style={{ 
                display: 'inline-block',
                width: '12px',
                height: '12px',
                border: '2px solid #fff',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 0.6s linear infinite'
              }} />
            )}
            {exporting ? 'Exporting...' : '📦 Export ZIP'}
          </button>
        </div>
      </div>
    </div>
  );
}

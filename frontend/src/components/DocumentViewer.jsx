import React, { useState, useEffect } from "react";

export default function DocumentViewer({ caseId, documentId, documentName, onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fileUrl, setFileUrl] = useState(null);
  const [fileType, setFileType] = useState("");
  const [metadata, setMetadata] = useState(null);

  useEffect(() => {
    loadDocument();
    logDocumentView();

    // Cleanup: revoke object URL when component unmounts
    return () => {
      if (fileUrl) {
        URL.revokeObjectURL(fileUrl);
      }
    };
  }, [documentId]);

  const logDocumentView = async () => {
    try {
      const token = localStorage.getItem('token');
      await fetch(
        `/api/documents/case/${caseId}/documents/${documentId}/view`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
    } catch (err) {
      console.error('Failed to log document view:', err);
      // Don't block viewing if audit logging fails
    }
  };

  const loadDocument = async () => {
    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem('token');
      
      // Fetch document metadata first
      const metadataResponse = await fetch(
        `/api/documents/case/${caseId}/documents/${documentId}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (!metadataResponse.ok) {
        throw new Error('Failed to load document metadata');
      }

      const docData = await metadataResponse.json();
      setMetadata(docData);
      setFileType(docData.file_type || '');

      // Fetch document file
      const fileResponse = await fetch(
        `/api/documents/case/${caseId}/documents/${documentId}/download`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (!fileResponse.ok) {
        throw new Error('Failed to load document file');
      }

      const blob = await fileResponse.blob();
      const url = URL.createObjectURL(blob);
      setFileUrl(url);
      setLoading(false);
    } catch (err) {
      console.error('Document viewer error:', err);
      setError(err.message || 'Failed to load document');
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (fileUrl) {
      const a = document.createElement('a');
      a.href = fileUrl;
      a.download = documentName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const canPreview = () => {
    if (!fileType) return false;
    
    // Supported preview types
    const previewTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/tiff',
      'text/plain',
      'text/html'
    ];

    return previewTypes.includes(fileType.toLowerCase());
  };

  const renderPreview = () => {
    if (!fileUrl || !fileType) return null;

    const type = fileType.toLowerCase();

    // PDF Preview
    if (type === 'application/pdf') {
      return (
        <iframe
          src={fileUrl}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            background: '#525659'
          }}
          title={documentName}
        />
      );
    }

    // Image Preview
    if (type.startsWith('image/')) {
      return (
        <div style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f7fafc',
          overflow: 'auto',
          padding: '20px'
        }}>
          <img
            src={fileUrl}
            alt={documentName}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
            }}
          />
        </div>
      );
    }

    // Text Preview
    if (type === 'text/plain' || type === 'text/html') {
      return (
        <iframe
          src={fileUrl}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            background: '#fff',
            padding: '20px'
          }}
          title={documentName}
        />
      );
    }

    return null;
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.85)',
      zIndex: 2000,
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        background: '#1a202c',
        color: '#fff',
        padding: '12px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ 
            margin: 0, 
            fontSize: '1.1em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {documentName}
          </h3>
          {metadata && (
            <div style={{ 
              fontSize: '0.85em', 
              color: '#cbd5e0',
              marginTop: '4px',
              display: 'flex',
              gap: '16px'
            }}>
              {metadata.file_type && (
                <span>{metadata.file_type.split('/').pop().toUpperCase()}</span>
              )}
              {metadata.size && (
                <span>{(metadata.size / 1024).toFixed(1)} KB</span>
              )}
              {metadata.legal_category && (
                <span>📋 {metadata.legal_category}</span>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={handleDownload}
            disabled={!fileUrl}
            style={{
              padding: '8px 16px',
              background: '#48bb78',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: fileUrl ? 'pointer' : 'not-allowed',
              fontWeight: '600',
              fontSize: '0.9em',
              opacity: fileUrl ? 1 : 0.5
            }}
          >
            ⬇️ Download
          </button>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#fff',
              fontSize: '28px',
              cursor: 'pointer',
              padding: '0 8px',
              lineHeight: '1'
            }}
          >
            ×
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        position: 'relative'
      }}>
        {loading && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            color: '#fff'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              border: '4px solid rgba(255, 255, 255, 0.3)',
              borderTopColor: '#fff',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite'
            }} />
            <div style={{ fontSize: '1.1em' }}>Loading document...</div>
          </div>
        )}

        {error && (
          <div style={{
            background: '#fff',
            borderRadius: '8px',
            padding: '32px',
            maxWidth: '500px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
            <h3 style={{ color: '#e53e3e', margin: '0 0 12px 0' }}>
              Failed to Load Document
            </h3>
            <p style={{ color: '#4a5568', margin: '0 0 20px 0' }}>
              {error}
            </p>
            <button
              onClick={onClose}
              style={{
                padding: '10px 24px',
                background: '#2166e8',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              Close
            </button>
          </div>
        )}

        {!loading && !error && fileUrl && (
          <>
            {canPreview() ? (
              <div style={{ width: '100%', height: '100%' }}>
                {renderPreview()}
              </div>
            ) : (
              <div style={{
                background: '#fff',
                borderRadius: '8px',
                padding: '40px',
                maxWidth: '500px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '64px', marginBottom: '16px' }}>📄</div>
                <h3 style={{ color: '#2d3748', margin: '0 0 12px 0' }}>
                  Preview Not Available
                </h3>
                <p style={{ color: '#718096', margin: '0 0 8px 0' }}>
                  This file type cannot be previewed in the browser.
                </p>
                <p style={{ color: '#718096', margin: '0 0 24px 0', fontWeight: '600' }}>
                  {fileType || 'Unknown file type'}
                </p>
                <button
                  onClick={handleDownload}
                  style={{
                    padding: '12px 24px',
                    background: '#48bb78',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '1em'
                  }}
                >
                  ⬇️ Download to View
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer with metadata */}
      {!loading && !error && metadata && (
        <div style={{
          background: '#2d3748',
          color: '#e2e8f0',
          padding: '12px 20px',
          fontSize: '0.85em',
          display: 'flex',
          gap: '20px',
          flexWrap: 'wrap'
        }}>
          {metadata.witness_name && (
            <span><strong>Witness:</strong> {metadata.witness_name}</span>
          )}
          {metadata.case_number && (
            <span><strong>Case #:</strong> {metadata.case_number}</span>
          )}
          {metadata.evidence_type && (
            <span><strong>Evidence:</strong> {metadata.evidence_type}</span>
          )}
          {metadata.created_at && (
            <span><strong>Uploaded:</strong> {new Date(metadata.created_at).toLocaleString()}</span>
          )}
        </div>
      )}
    </div>
  );
}

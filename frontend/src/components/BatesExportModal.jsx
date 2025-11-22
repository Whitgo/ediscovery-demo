import React, { useState } from "react";
import { apiPost } from "../utils/api";

export default function BatesExportModal({ caseId, caseNumber, selectedDocuments, onClose }) {
  const [includeDateTime, setIncludeDateTime] = useState(true);
  const [includeUserId, setIncludeUserId] = useState(true);
  const [startingNumber, setStartingNumber] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);

  async function handleExport() {
    setExporting(true);
    setError(null);

    try {
      const response = await fetch(`/api/export/case/${caseId}/bates-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          documentIds: selectedDocuments,
          includeDateTime,
          includeUserId,
          startingNumber
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Export failed');
      }

      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition && contentDisposition.match(/filename="?(.+)"?/i);
      const filename = filenameMatch ? filenameMatch[1] : `BATES_${caseNumber}_${new Date().toISOString().split('T')[0]}.zip`;

      // Download the ZIP file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Success - close modal
      setTimeout(() => {
        onClose();
      }, 500);

    } catch (err) {
      console.error('Bates export error:', err);
      setError(err.message || 'Failed to export documents with Bates numbering');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '8px',
        padding: '32px',
        maxWidth: '550px',
        width: '90%',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px'
        }}>
          <h2 style={{ margin: 0, color: '#2d3748', fontSize: '1.5em' }}>
            📋 Bates Numbering Export
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
            disabled={exporting}
          >
            ×
          </button>
        </div>

        <div style={{
          background: '#edf2f7',
          padding: '16px',
          borderRadius: '6px',
          marginBottom: '24px'
        }}>
          <div style={{ fontSize: '0.9em', color: '#4a5568', marginBottom: '8px' }}>
            <strong>Case:</strong> {caseNumber}
          </div>
          <div style={{ fontSize: '0.9em', color: '#4a5568' }}>
            <strong>Documents Selected:</strong> {selectedDocuments.length} (PDF files only will be processed)
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ 
            fontSize: '1.1em', 
            color: '#2d3748', 
            marginBottom: '16px',
            fontWeight: '600'
          }}>
            Bates Stamping Options
          </h3>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ 
              display: 'flex', 
              alignItems: 'center', 
              cursor: 'pointer',
              padding: '12px',
              background: '#f7fafc',
              borderRadius: '6px',
              border: '1px solid #e2e8f0'
            }}>
              <input
                type="checkbox"
                checked={includeDateTime}
                onChange={(e) => setIncludeDateTime(e.target.checked)}
                style={{ marginRight: '12px', width: '18px', height: '18px', cursor: 'pointer' }}
                disabled={exporting}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '600', color: '#2d3748', marginBottom: '4px' }}>
                  Include Date & Time
                </div>
                <div style={{ fontSize: '0.85em', color: '#718096' }}>
                  Add timestamp to each Bates stamp (e.g., "CASE001-0001 | 2025-11-22 10:30:45")
                </div>
              </div>
            </label>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ 
              display: 'flex', 
              alignItems: 'center', 
              cursor: 'pointer',
              padding: '12px',
              background: '#f7fafc',
              borderRadius: '6px',
              border: '1px solid #e2e8f0'
            }}>
              <input
                type="checkbox"
                checked={includeUserId}
                onChange={(e) => setIncludeUserId(e.target.checked)}
                style={{ marginRight: '12px', width: '18px', height: '18px', cursor: 'pointer' }}
                disabled={exporting}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '600', color: '#2d3748', marginBottom: '4px' }}>
                  Include User ID
                </div>
                <div style={{ fontSize: '0.85em', color: '#718096' }}>
                  Add user identifier to each stamp for audit trail compliance
                </div>
              </div>
            </label>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ 
              display: 'block',
              marginBottom: '8px',
              fontWeight: '600',
              color: '#2d3748'
            }}>
              Starting Number
            </label>
            <input
              type="number"
              min="1"
              max="9999"
              value={startingNumber}
              onChange={(e) => setStartingNumber(parseInt(e.target.value, 10) || 1)}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                fontSize: '1em'
              }}
              disabled={exporting}
            />
            <div style={{ fontSize: '0.85em', color: '#718096', marginTop: '6px' }}>
              First Bates number will be: {caseNumber.replace(/[^A-Z0-9]/gi, '').toUpperCase()}-{String(startingNumber).padStart(4, '0')}
            </div>
          </div>
        </div>

        <div style={{
          background: '#fffaf0',
          border: '1px solid #fbd38d',
          borderRadius: '6px',
          padding: '12px',
          marginBottom: '24px'
        }}>
          <div style={{ fontSize: '0.9em', color: '#7c2d12' }}>
            <strong>ℹ️ Note:</strong> Bates stamps will be applied in black font at the bottom right corner of each page. A manifest file will be included for audit trail compliance.
          </div>
        </div>

        {error && (
          <div style={{
            background: '#fff5f5',
            border: '1px solid #feb2b2',
            borderRadius: '6px',
            padding: '12px',
            marginBottom: '16px',
            color: '#c53030'
          }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={onClose}
            disabled={exporting}
            style={{
              padding: '10px 20px',
              background: '#fff',
              color: '#4a5568',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              cursor: exporting ? 'not-allowed' : 'pointer',
              fontWeight: '600',
              opacity: exporting ? 0.5 : 1
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={exporting || selectedDocuments.length === 0}
            style={{
              padding: '10px 20px',
              background: exporting ? '#a0aec0' : '#2166e8',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: (exporting || selectedDocuments.length === 0) ? 'not-allowed' : 'pointer',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {exporting ? (
              <>
                <span style={{ 
                  display: 'inline-block', 
                  width: '16px', 
                  height: '16px', 
                  border: '2px solid #fff',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite'
                }} />
                Processing...
              </>
            ) : (
              <>
                📋 Export with Bates Numbers
              </>
            )}
          </button>
        </div>

        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}

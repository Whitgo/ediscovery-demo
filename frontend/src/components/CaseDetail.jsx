import React, { useEffect, useState } from "react";
import { apiGet, apiPost, apiDelete } from "../utils/api";
import { useUser } from "../context/UserContext";
import FileUploadModal from "./FileUploadModal";
import BulkFileUploadModal from "./BulkFileUploadModal";
import DocumentMetadataForm from "./DocumentMetadataForm";
import AdvancedDocumentSearch from "./AdvancedDocumentSearch";
import ExportModal from "./ExportModal";
import DocumentViewer from "./DocumentViewer";

export default function CaseDetail({ caseId, onBack }) {
  const user = useUser();
  const [casedata, setCasedata] = useState(null);
  const [docs, setDocs] = useState([]);
  const [audit, setAudit] = useState([]);
  const [showAudit, setShowAudit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [editingDocId, setEditingDocId] = useState(null);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const [searchPagination, setSearchPagination] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedDocs, setSelectedDocs] = useState([]);
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [viewingDocId, setViewingDocId] = useState(null);
  const [viewingDocName, setViewingDocName] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setCasedata(await apiGet(`/cases/${caseId}`));
      setDocs(await apiGet(`/documents/case/${caseId}/documents`));
      setLoading(false);
    }
    load();
  }, [caseId]);

  async function loadAudit() {
    setAudit(await apiGet(`/audit/case/${caseId}`));
  }

  async function refreshDocuments() {
    setDocs(await apiGet(`/documents/case/${caseId}/documents`));
    // Clear search results when refreshing to show all docs
    setSearchResults(null);
    setSearchPagination(null);
  }
  
  async function handleMetadataSave(docId, metadata) {
    await refreshDocuments();
    setEditingDocId(null);
  }
  
  async function handleDeleteDoc(docId) {
    await apiDelete(`/documents/case/${caseId}/documents/${docId}`);
    setDocs(await apiGet(`/documents/case/${caseId}/documents`));
  }

  function handleSearchResults(documents, pagination) {
    setSearchResults(documents);
    setSearchPagination(pagination);
  }

  function handleSearchError(error) {
    console.error('Search error in CaseDetail:', error);
  }

  function toggleDocSelection(docId) {
    setSelectedDocs(prev => 
      prev.includes(docId) 
        ? prev.filter(id => id !== docId)
        : [...prev, docId]
    );
  }

  function toggleSelectAll() {
    if (selectedDocs.length === displayDocs.length) {
      setSelectedDocs([]);
    } else {
      setSelectedDocs(displayDocs.map(doc => doc.id));
    }
  }

  async function handleBulkDelete() {
    if (selectedDocs.length === 0) return;
    
    if (!window.confirm(`Delete ${selectedDocs.length} selected documents? This cannot be undone.`)) {
      return;
    }

    try {
      await Promise.all(
        selectedDocs.map(docId => 
          apiDelete(`/documents/case/${caseId}/documents/${docId}`)
        )
      );
      await refreshDocuments();
      setSelectedDocs([]);
      setBulkEditMode(false);
    } catch (err) {
      console.error('Bulk delete error:', err);
      alert('Failed to delete some documents');
    }
  }

  const displayDocs = searchResults !== null ? searchResults : docs;

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <button onClick={onBack}>&larr; Back</button>
      <h3 style={{marginTop:8}}>{casedata.name}</h3>
      <div>Case Number: {casedata.number}</div>
      <div>Status: <b>{casedata.status}</b></div>
      <div>Assigned: {casedata.assigned_to}</div>
      <div style={{margin:"1em 0", color:"#777"}}>{casedata.notes}</div>
      <div>
        <h4>Documents</h4>
        {user.role === "manager" || user.role === "support" || user.role === "user" ? (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: 8, flexWrap: 'wrap' }}>
              <button 
                style={{
                  padding: '8px 16px',
                  background: '#2166e8',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }} 
                onClick={() => setShowUploadModal(true)}
              >
                📤 Upload Single
              </button>
              <button 
                style={{
                  padding: '8px 16px',
                  background: '#3182ce',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }} 
                onClick={() => setShowBulkUploadModal(true)}
              >
                📤 Bulk Upload
              </button>
              <button
                style={{
                  padding: '8px 16px',
                  background: showAdvancedSearch ? '#cbd5e0' : '#48bb78',
                  color: showAdvancedSearch ? '#2d3748' : '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
                onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
              >
                {showAdvancedSearch ? '✕ Close Search' : '🔍 Advanced Search'}
              </button>
              <button
                style={{
                  padding: '8px 16px',
                  background: '#805ad5',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: docs.length === 0 ? 'not-allowed' : 'pointer',
                  fontWeight: '600',
                  opacity: docs.length === 0 ? 0.5 : 1
                }}
                onClick={() => setShowExportModal(true)}
                disabled={docs.length === 0}
              >
                📦 Export
              </button>
              <button
                style={{
                  padding: '8px 16px',
                  background: bulkEditMode ? '#e53e3e' : '#ed8936',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: docs.length === 0 ? 'not-allowed' : 'pointer',
                  fontWeight: '600',
                  opacity: docs.length === 0 ? 0.5 : 1
                }}
                onClick={() => {
                  setBulkEditMode(!bulkEditMode);
                  setSelectedDocs([]);
                }}
                disabled={docs.length === 0}
              >
                {bulkEditMode ? '✕ Cancel Bulk Edit' : '☑ Bulk Edit'}
              </button>
            </div>

            {bulkEditMode && (
              <div style={{
                padding: '12px 16px',
                background: '#fff5eb',
                border: '1px solid #ed8936',
                borderRadius: '6px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontWeight: '600', color: '#7c2d12' }}>
                    {selectedDocs.length} document{selectedDocs.length !== 1 ? 's' : ''} selected
                  </span>
                  <button
                    onClick={toggleSelectAll}
                    style={{
                      padding: '6px 12px',
                      background: '#fff',
                      border: '1px solid #ed8936',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.85em',
                      fontWeight: '600',
                      color: '#7c2d12'
                    }}
                  >
                    {selectedDocs.length === displayDocs.length ? '☑ Deselect All' : '☐ Select All'}
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={handleBulkDelete}
                    disabled={selectedDocs.length === 0}
                    style={{
                      padding: '6px 12px',
                      background: selectedDocs.length === 0 ? '#cbd5e0' : '#e53e3e',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: selectedDocs.length === 0 ? 'not-allowed' : 'pointer',
                      fontSize: '0.85em',
                      fontWeight: '600'
                    }}
                  >
                    🗑 Delete Selected
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {showAdvancedSearch && (
          <div style={{ marginBottom: '16px' }}>
            <AdvancedDocumentSearch
              caseId={caseId}
              onResults={handleSearchResults}
              onError={handleSearchError}
            />
          </div>
        )}

        {searchResults !== null && (
          <div style={{
            padding: '12px 16px',
            background: '#e6fffa',
            border: '1px solid #38b2ac',
            borderRadius: '6px',
            marginBottom: '12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span style={{ color: '#234e52', fontWeight: '600' }}>
              🎯 Showing {searchPagination?.returned || 0} of {searchPagination?.total || 0} search results
            </span>
            <button
              onClick={() => {
                setSearchResults(null);
                setSearchPagination(null);
              }}
              style={{
                padding: '6px 12px',
                background: '#38b2ac',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.9em',
                fontWeight: '600'
              }}
            >
              Clear Search
            </button>
          </div>
        )}

        <ul style={{ listStyle: 'none', padding: 0 }}>
          {displayDocs.map(doc => (
            <li key={doc.id} style={{
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              padding: "16px",
              margin: "12px 0",
              background: selectedDocs.includes(doc.id) ? "#fff5eb" : "#fff",
              position: 'relative'
            }}>
              {bulkEditMode && (
                <div style={{
                  position: 'absolute',
                  top: '16px',
                  left: '16px'
                }}>
                  <input
                    type="checkbox"
                    checked={selectedDocs.includes(doc.id)}
                    onChange={() => toggleDocSelection(doc.id)}
                    style={{
                      width: '20px',
                      height: '20px',
                      cursor: 'pointer'
                    }}
                  />
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: editingDocId === doc.id ? '12px' : '0', marginLeft: bulkEditMode ? '35px' : '0' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ marginBottom: '8px' }}>
                    <b style={{ fontSize: '1.05em', color: '#1a202c' }}>{doc.name}</b>
                  </div>
                  
                  {/* Metadata Display */}
                  <div style={{ fontSize: '0.9em', color: '#4a5568', lineHeight: '1.8' }}>
                    {doc.legal_category && (
                      <div>
                        <span style={{ fontWeight: '600', color: '#2d3748' }}>Category:</span>{' '}
                        <span style={{ 
                          padding: '2px 8px', 
                          background: '#e6fffa', 
                          borderRadius: '4px',
                          border: '1px solid #81e6d9'
                        }}>
                          {doc.legal_category}
                        </span>
                      </div>
                    )}
                    {doc.evidence_type && (
                      <div>
                        <span style={{ fontWeight: '600', color: '#2d3748' }}>Evidence Type:</span> {doc.evidence_type}
                      </div>
                    )}
                    {doc.case_number && (
                      <div>
                        <span style={{ fontWeight: '600', color: '#2d3748' }}>Case #:</span> {doc.case_number}
                      </div>
                    )}
                    {doc.witness_name && (
                      <div>
                        <span style={{ fontWeight: '600', color: '#2d3748' }}>Witness:</span> {doc.witness_name}
                      </div>
                    )}
                    {doc.folder && (
                      <div>
                        <span style={{ fontWeight: '600', color: '#2d3748' }}>Folder:</span> {doc.folder}
                      </div>
                    )}
                    {doc.tags && JSON.parse(doc.tags).length > 0 && (
                      <div style={{ marginTop: '6px' }}>
                        <span style={{ fontWeight: '600', color: '#2d3748' }}>Tags:</span>{' '}
                        {JSON.parse(doc.tags).map(tag => (
                          <span 
                            key={tag} 
                            style={{
                              display: 'inline-block',
                              marginRight: 6,
                              marginTop: 4,
                              background: '#edf2f7',
                              border: '1px solid #cbd5e0',
                              borderRadius: 12,
                              padding: '2px 10px',
                              fontSize: '0.85em'
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <div style={{ marginTop: '8px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                      {doc.stored_filename && (
                        <>
                          <button
                            onClick={() => {
                              setViewingDocId(doc.id);
                              setViewingDocName(doc.name);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#2166e8',
                              cursor: 'pointer',
                              fontWeight: '600',
                              fontSize: '0.95em',
                              padding: '0',
                              textDecoration: 'underline'
                            }}
                          >
                            👁️ View
                          </button>
                          <a 
                            href={`${process.env.REACT_APP_API_URL || 'http://localhost:4000'}/api/documents/case/${caseId}/documents/${doc.id}/download`}
                            style={{
                              color: '#2166e8',
                              textDecoration: 'none',
                              fontWeight: '600',
                              fontSize: '0.95em'
                            }}
                          >
                            📥 Download
                          </a>
                        </>
                      )}
                      {doc.file_url && !doc.stored_filename && (
                        <a 
                          href={doc.file_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{
                            color: '#2166e8',
                            textDecoration: 'none',
                            fontWeight: '600'
                          }}
                        >
                          🔗 Open
                        </a>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '8px', marginLeft: '16px' }}>
                  {(user.role === "manager" || user.role === "support") && editingDocId !== doc.id && (
                    <>
                      <button
                        onClick={() => setEditingDocId(doc.id)}
                        style={{
                          background: '#4299e1',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 6,
                          padding: '6px 12px',
                          cursor: 'pointer',
                          fontSize: '0.85em',
                          fontWeight: '600'
                        }}
                      >
                        Edit Metadata
                      </button>
                      <button
                        onClick={() => handleDeleteDoc(doc.id)}
                        style={{
                          background: '#e87272',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 6,
                          padding: '6px 12px',
                          cursor: 'pointer',
                          fontSize: '0.85em',
                          fontWeight: '600'
                        }}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
              
              {/* Inline Metadata Editor */}
              {editingDocId === doc.id && (
                <DocumentMetadataForm
                  caseId={caseId}
                  docId={doc.id}
                  initialData={{
                    case_number: doc.case_number || '',
                    witness_name: doc.witness_name || '',
                    evidence_type: doc.evidence_type || '',
                    legal_category: doc.legal_category || '',
                    tags: doc.tags ? JSON.parse(doc.tags) : []
                  }}
                  onSave={(metadata) => handleMetadataSave(doc.id, metadata)}
                  onCancel={() => setEditingDocId(null)}
                  inline={true}
                />
              )}
            </li>
          ))}
        </ul>
      </div>
      {(user.role === "manager" || user.role === "support") && (
        <div>
          <button style={{marginTop:10}} onClick={() => { setShowAudit(v=>!v); if (!audit.length) loadAudit(); }}>
            {showAudit ? "Hide" : "Show"} Audit Log
          </button>
          {showAudit && (
            <div style={{marginTop:8, fontSize:"0.95em"}}>
              {audit.length === 0 ? (
                <div style={{ color: '#718096', padding: '12px' }}>No audit logs available</div>
              ) : (
                audit.map(log => {
                  const actionIcons = {
                    'view_document': '👁️',
                    'create': '✅',
                    'update': '✏️',
                    'delete': '🗑️',
                    'export_documents': '📦'
                  };
                  const icon = actionIcons[log.action] || '📝';
                  
                  return (
                    <div key={log.id} style={{
                      borderBottom:"1px solid #e2e8f0",
                      padding:"10px 0",
                      display: 'flex',
                      gap: '12px',
                      alignItems: 'flex-start'
                    }}>
                      <span style={{ fontSize: '1.2em' }}>{icon}</span>
                      <div style={{ flex: 1 }}>
                        <div>
                          <b style={{ color: '#2d3748' }}>{log.action.replace(/_/g, ' ')}</b>
                          {log.object_type && <span style={{ color: '#4a5568' }}> {log.object_type} #{log.object_id}</span>}
                          <span style={{ color: '#718096' }}> by {log.user}</span>
                        </div>
                        <div style={{ color: '#a0aec0', fontSize: '0.85em', marginTop: '2px' }}>
                          {new Date(log.timestamp || log.created_at).toLocaleString()}
                        </div>
                        {log.details && (
                          <div style={{
                            color:"#718096",
                            fontSize: '0.9em',
                            marginTop: '4px',
                            background: '#f7fafc',
                            padding: '6px 8px',
                            borderRadius: '4px',
                            fontFamily: 'monospace'
                          }}>
                            {typeof log.details === 'string' 
                              ? log.details 
                              : JSON.stringify(log.details, null, 2)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}
      
      {showUploadModal && (
        <FileUploadModal
          caseId={caseId}
          onClose={() => setShowUploadModal(false)}
          onSuccess={refreshDocuments}
        />
      )}

      {showBulkUploadModal && (
        <BulkFileUploadModal
          caseId={caseId}
          onClose={() => setShowBulkUploadModal(false)}
          onSuccess={refreshDocuments}
        />
      )}

      {showExportModal && (
        <ExportModal
          caseId={caseId}
          documents={docs}
          onClose={() => setShowExportModal(false)}
        />
      )}

      {viewingDocId && (
        <DocumentViewer
          caseId={caseId}
          documentId={viewingDocId}
          documentName={viewingDocName}
          onClose={() => {
            setViewingDocId(null);
            setViewingDocName("");
          }}
        />
      )}
    </div>
  );
}
import React, { useState, useRef, useEffect } from "react";

export default function FileUploadModal({ caseId, onClose, onSuccess }) {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const [metadata, setMetadata] = useState({
    category: "",
    folder: "",
    tags: "",
    case_number: "",
    witness_name: "",
    evidence_type: "",
    legal_category: ""
  });
  const [options, setOptions] = useState({
    legalCategories: [],
    evidenceTypes: []
  });
  const [suggestions, setSuggestions] = useState({
    tags: [],
    witnesses: []
  });
  const fileInputRef = useRef(null);

  const ALLOWED_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'image/tiff',
    'application/zip',
    'message/rfc822'
  ];

  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

  useEffect(() => {
    loadOptions();
    loadSuggestions();
  }, [caseId]);

  const loadOptions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.REACT_APP_API_URL || 'http://localhost:4000'}/api/tags/metadata/options`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const data = await response.json();
      setOptions(data);
    } catch (err) {
      console.error('Failed to load options:', err);
    }
  };

  const loadSuggestions = async () => {
    try {
      const token = localStorage.getItem('token');
      const [tagsRes, witnessesRes] = await Promise.all([
        fetch(
          `${process.env.REACT_APP_API_URL || 'http://localhost:4000'}/api/tags/case/${caseId}/tags`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        ),
        fetch(
          `${process.env.REACT_APP_API_URL || 'http://localhost:4000'}/api/tags/case/${caseId}/witnesses`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        )
      ]);
      
      const tagsData = await tagsRes.json();
      const witnessesData = await witnessesRes.json();
      
      setSuggestions({
        tags: tagsData.tags || [],
        witnesses: witnessesData.witnesses || []
      });
    } catch (err) {
      console.error('Failed to load suggestions:', err);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const validateFile = (file) => {
    if (!file) return "No file selected";
    
    if (!ALLOWED_TYPES.includes(file.type)) {
      return `File type not allowed. Allowed: PDF, DOC, DOCX, TXT, XLS, XLSX, JPG, PNG, TIFF, ZIP, EML`;
    }
    
    if (file.size > MAX_FILE_SIZE) {
      return `File too large. Maximum size: 50MB`;
    }
    
    return null;
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setError("");

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      const validationError = validateFile(droppedFile);
      
      if (validationError) {
        setError(validationError);
      } else {
        setFile(droppedFile);
      }
    }
  };

  const handleFileChange = (e) => {
    setError("");
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      const validationError = validateFile(selectedFile);
      
      if (validationError) {
        setError(validationError);
        setFile(null);
      } else {
        setFile(selectedFile);
      }
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    
    if (!file) {
      setError("Please select a file");
      return;
    }

    setUploading(true);
    setError("");
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', metadata.category);
    formData.append('folder', metadata.folder);
    formData.append('case_number', metadata.case_number);
    formData.append('witness_name', metadata.witness_name);
    formData.append('evidence_type', metadata.evidence_type);
    formData.append('legal_category', metadata.legal_category);
    
    const tags = metadata.tags.split(',').map(t => t.trim()).filter(Boolean);
    formData.append('tags', JSON.stringify(tags));

    try {
      const token = localStorage.getItem('token');
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(progress);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status === 201) {
          setUploadProgress(100);
          setTimeout(() => {
            onSuccess();
            onClose();
          }, 500);
        } else {
          const response = JSON.parse(xhr.responseText);
          setError(response.error || 'Upload failed');
          setUploading(false);
        }
      });

      xhr.addEventListener('error', () => {
        setError('Network error occurred');
        setUploading(false);
      });

      xhr.open('POST', `${process.env.REACT_APP_API_URL || 'http://localhost:4000'}/api/documents/case/${caseId}/documents/upload`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.send(formData);
    } catch (err) {
      setError(err.message || 'Upload failed');
      setUploading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
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
        borderRadius: '12px',
        padding: '32px',
        maxWidth: '600px',
        width: '90%',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>
        <h3 style={{ marginTop: 0, marginBottom: '24px', color: '#1e3c72' }}>Upload Document</h3>

        <form onSubmit={handleUpload}>
          {/* Drag and Drop Area */}
          <div
            style={{
              border: dragActive ? '3px dashed #2166e8' : '2px dashed #cbd5e0',
              borderRadius: '12px',
              padding: '48px 24px',
              textAlign: 'center',
              background: dragActive ? '#f0f4ff' : '#f8f9fc',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              marginBottom: '24px'
            }}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              style={{ display: 'none' }}
              disabled={uploading}
            />
            
            {!file ? (
              <>
                <div style={{ fontSize: '3em', marginBottom: '16px' }}>📄</div>
                <p style={{ fontSize: '1.1em', color: '#4a5568', marginBottom: '8px', fontWeight: '600' }}>
                  Drag & drop your file here
                </p>
                <p style={{ fontSize: '0.95em', color: '#718096', marginBottom: '16px' }}>
                  or click to browse
                </p>
                <p style={{ fontSize: '0.85em', color: '#a0aec0' }}>
                  PDF, DOC, DOCX, TXT, XLS, XLSX, JPG, PNG, TIFF, ZIP, EML (max 50MB)
                </p>
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                <div style={{ fontSize: '2em' }}>✓</div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: '600', color: '#2d3748' }}>{file.name}</div>
                  <div style={{ fontSize: '0.9em', color: '#718096' }}>{formatFileSize(file.size)}</div>
                </div>
                {!uploading && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    style={{
                      background: '#e53e3e',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      cursor: 'pointer',
                      fontSize: '0.9em'
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Upload Progress */}
          {uploading && (
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.9em', color: '#4a5568' }}>Uploading...</span>
                <span style={{ fontSize: '0.9em', fontWeight: '600', color: '#2166e8' }}>{uploadProgress}%</span>
              </div>
              <div style={{
                height: '8px',
                background: '#e2e8f0',
                borderRadius: '4px',
                overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%',
                  background: 'linear-gradient(90deg, #2166e8, #4facfe)',
                  width: `${uploadProgress}%`,
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div style={{
              padding: '12px',
              background: '#fff5f5',
              border: '1px solid #fc8181',
              borderRadius: '8px',
              color: '#c53030',
              marginBottom: '24px',
              fontSize: '0.95em'
            }}>
              {error}
            </div>
          )}

          {/* Metadata Fields */}
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ marginTop: 0, marginBottom: '16px', color: '#2d3748' }}>Document Metadata</h4>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <label style={{ display: 'block' }}>
                <span style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#2d3748', fontSize: '0.9em' }}>
                  Legal Category
                </span>
                <select
                  value={metadata.legal_category}
                  onChange={(e) => setMetadata({ ...metadata, legal_category: e.target.value })}
                  disabled={uploading}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #cbd5e0',
                    borderRadius: '6px',
                    fontSize: '1em'
                  }}
                >
                  <option value="">Select category...</option>
                  {options.legalCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'block' }}>
                <span style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#2d3748', fontSize: '0.9em' }}>
                  Evidence Type
                </span>
                <select
                  value={metadata.evidence_type}
                  onChange={(e) => setMetadata({ ...metadata, evidence_type: e.target.value })}
                  disabled={uploading}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #cbd5e0',
                    borderRadius: '6px',
                    fontSize: '1em'
                  }}
                >
                  <option value="">Select type...</option>
                  {options.evidenceTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <label style={{ display: 'block' }}>
                <span style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#2d3748', fontSize: '0.9em' }}>
                  Case Number
                </span>
                <input
                  type="text"
                  value={metadata.case_number}
                  onChange={(e) => setMetadata({ ...metadata, case_number: e.target.value })}
                  placeholder="e.g., 2025-CV-12345"
                  disabled={uploading}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #cbd5e0',
                    borderRadius: '6px',
                    fontSize: '1em'
                  }}
                />
              </label>

              <label style={{ display: 'block' }}>
                <span style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#2d3748', fontSize: '0.9em' }}>
                  Witness Name
                </span>
                <input
                  type="text"
                  list="witness-suggestions"
                  value={metadata.witness_name}
                  onChange={(e) => setMetadata({ ...metadata, witness_name: e.target.value })}
                  placeholder="Enter witness name"
                  disabled={uploading}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #cbd5e0',
                    borderRadius: '6px',
                    fontSize: '1em'
                  }}
                />
                <datalist id="witness-suggestions">
                  {suggestions.witnesses.map(witness => (
                    <option key={witness} value={witness} />
                  ))}
                </datalist>
              </label>
            </div>

            <label style={{ display: 'block', marginBottom: '16px' }}>
              <span style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#2d3748', fontSize: '0.9em' }}>
                Category
              </span>
              <input
                type="text"
                value={metadata.category}
                onChange={(e) => setMetadata({ ...metadata, category: e.target.value })}
                placeholder="e.g., Evidence, Correspondence, Contract"
                disabled={uploading}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #cbd5e0',
                  borderRadius: '6px',
                  fontSize: '1em'
                }}
              />
            </label>

            <label style={{ display: 'block', marginBottom: '16px' }}>
              <span style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#2d3748' }}>
                Folder
              </span>
              <input
                type="text"
                value={metadata.folder}
                onChange={(e) => setMetadata({ ...metadata, folder: e.target.value })}
                placeholder="e.g., Discovery/Phase1"
                disabled={uploading}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #cbd5e0',
                  borderRadius: '6px',
                  fontSize: '1em'
                }}
              />
            </label>

            <label style={{ display: 'block' }}>
              <span style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#2d3748', fontSize: '0.9em' }}>
                Tags (comma-separated)
              </span>
              <input
                type="text"
                list="tag-suggestions"
                value={metadata.tags}
                onChange={(e) => setMetadata({ ...metadata, tags: e.target.value })}
                placeholder="e.g., privileged, confidential, exhibits"
                disabled={uploading}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #cbd5e0',
                  borderRadius: '6px',
                  fontSize: '1em'
                }}
              />
              <datalist id="tag-suggestions">
                {suggestions.tags.map(tag => (
                  <option key={tag} value={tag} />
                ))}
              </datalist>
            </label>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              style={{
                padding: '10px 24px',
                border: '1px solid #cbd5e0',
                borderRadius: '6px',
                background: '#fff',
                color: '#4a5568',
                cursor: uploading ? 'not-allowed' : 'pointer',
                fontSize: '1em',
                fontWeight: '600'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!file || uploading}
              style={{
                padding: '10px 24px',
                border: 'none',
                borderRadius: '6px',
                background: (!file || uploading) ? '#cbd5e0' : '#2166e8',
                color: '#fff',
                cursor: (!file || uploading) ? 'not-allowed' : 'pointer',
                fontSize: '1em',
                fontWeight: '600'
              }}
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

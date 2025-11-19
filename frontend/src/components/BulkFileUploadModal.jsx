import React, { useState, useRef, useEffect } from "react";

export default function BulkFileUploadModal({ caseId, onClose, onSuccess }) {
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [completedUploads, setCompletedUploads] = useState([]);
  const [failedUploads, setFailedUploads] = useState([]);
  const [error, setError] = useState("");
  const [globalMetadata, setGlobalMetadata] = useState({
    folder: "",
    case_number: "",
    witness_name: "",
    evidence_type: "",
    legal_category: "",
    tags: []
  });
  const [tagInput, setTagInput] = useState("");
  const [options, setOptions] = useState({
    legalCategories: [],
    evidenceTypes: []
  });
  const [suggestions, setSuggestions] = useState({
    tags: [],
    witnesses: []
  });
  const [applyMetadataToAll, setApplyMetadataToAll] = useState(true);
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
  const MAX_FILES = 50; // Maximum files per batch

  useEffect(() => {
    loadOptions();
    loadSuggestions();
  }, [caseId]);

  const loadOptions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `/api/tags/metadata/options`,
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
          `/api/tags/case/${caseId}/tags`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        ),
        fetch(
          `/api/tags/case/${caseId}/witnesses`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        )
      ]);
      const tags = await tagsRes.json();
      const witnesses = await witnessesRes.json();
      setSuggestions({ tags, witnesses });
    } catch (err) {
      console.error('Failed to load suggestions:', err);
    }
  };

  const validateFile = (file) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return `File type not allowed: ${file.type}`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File too large: ${(file.size / (1024 * 1024)).toFixed(2)}MB (max 50MB)`;
    }
    return null;
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

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFiles(droppedFiles);
  };

  const handleFileInput = (e) => {
    const selectedFiles = Array.from(e.target.files);
    handleFiles(selectedFiles);
  };

  const handleFiles = (newFiles) => {
    setError("");

    if (files.length + newFiles.length > MAX_FILES) {
      setError(`Maximum ${MAX_FILES} files can be uploaded at once`);
      return;
    }

    const validatedFiles = newFiles.map(file => {
      const validationError = validateFile(file);
      return {
        file,
        id: `${file.name}-${Date.now()}-${Math.random()}`,
        name: file.name,
        size: file.size,
        type: file.type,
        error: validationError,
        status: validationError ? 'invalid' : 'pending'
      };
    });

    setFiles(prev => [...prev, ...validatedFiles]);
  };

  const removeFile = (fileId) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const addTag = () => {
    const trimmed = tagInput.trim().toLowerCase();
    if (trimmed && !globalMetadata.tags.includes(trimmed)) {
      setGlobalMetadata({
        ...globalMetadata,
        tags: [...globalMetadata.tags, trimmed]
      });
      setTagInput("");
    }
  };

  const removeTag = (tagToRemove) => {
    setGlobalMetadata({
      ...globalMetadata,
      tags: globalMetadata.tags.filter(tag => tag !== tagToRemove)
    });
  };

  const uploadFile = async (fileObj) => {
    const formData = new FormData();
    formData.append('document', fileObj.file);
    formData.append('name', fileObj.name);
    formData.append('folder', globalMetadata.folder);
    
    if (applyMetadataToAll) {
      if (globalMetadata.case_number) formData.append('case_number', globalMetadata.case_number);
      if (globalMetadata.witness_name) formData.append('witness_name', globalMetadata.witness_name);
      if (globalMetadata.evidence_type) formData.append('evidence_type', globalMetadata.evidence_type);
      if (globalMetadata.legal_category) formData.append('legal_category', globalMetadata.legal_category);
      if (globalMetadata.tags.length > 0) formData.append('tags', JSON.stringify(globalMetadata.tags));
    }

    return new Promise((resolve, reject) => {
      const token = localStorage.getItem('token');
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(prev => ({
            ...prev,
            [fileObj.id]: percentComplete
          }));
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({ success: true, fileObj });
        } else {
          reject({ 
            success: false, 
            fileObj, 
            error: xhr.responseText || `Upload failed (${xhr.status})` 
          });
        }
      });

      xhr.addEventListener('error', () => {
        reject({ 
          success: false, 
          fileObj, 
          error: 'Network error during upload' 
        });
      });

      xhr.open('POST', `/api/documents/case/${caseId}/documents/upload`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.send(formData);
    });
  };

  const handleBulkUpload = async () => {
    const validFiles = files.filter(f => f.status === 'pending' && !f.error);
    
    if (validFiles.length === 0) {
      setError('No valid files to upload');
      return;
    }

    setUploading(true);
    setError("");
    setCompletedUploads([]);
    setFailedUploads([]);

    const uploadPromises = validFiles.map(fileObj => 
      uploadFile(fileObj)
        .then(result => {
          setCompletedUploads(prev => [...prev, result.fileObj.name]);
          return result;
        })
        .catch(error => {
          setFailedUploads(prev => [...prev, {
            name: error.fileObj.name,
            error: error.error
          }]);
          return error;
        })
    );

    try {
      await Promise.all(uploadPromises);
      
      // If all succeeded, close modal after short delay
      if (failedUploads.length === 0) {
        setTimeout(() => {
          onSuccess && onSuccess();
          onClose();
        }, 1500);
      }
    } catch (err) {
      console.error('Bulk upload error:', err);
      setError('Some uploads failed. See details below.');
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const validFilesCount = files.filter(f => !f.error).length;
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

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
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '8px',
        padding: '24px',
        maxWidth: '900px',
        width: '100%',
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
          <h3 style={{ margin: 0, color: '#1a202c' }}>📤 Bulk File Upload</h3>
          <button
            onClick={onClose}
            disabled={uploading}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: uploading ? 'not-allowed' : 'pointer',
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

        {completedUploads.length > 0 && (
          <div style={{
            padding: '12px',
            background: '#f0fff4',
            border: '1px solid #48bb78',
            borderRadius: '6px',
            color: '#22543d',
            marginBottom: '16px',
            fontSize: '0.9em'
          }}>
            ✅ Successfully uploaded {completedUploads.length} file{completedUploads.length !== 1 ? 's' : ''}
          </div>
        )}

        {failedUploads.length > 0 && (
          <div style={{
            padding: '12px',
            background: '#fff5f5',
            border: '1px solid #fc8181',
            borderRadius: '6px',
            marginBottom: '16px',
            fontSize: '0.85em'
          }}>
            <div style={{ fontWeight: '600', marginBottom: '6px', color: '#c53030' }}>
              ⚠️ Failed uploads ({failedUploads.length}):
            </div>
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              {failedUploads.map((fail, idx) => (
                <li key={idx} style={{ color: '#c53030' }}>
                  {fail.name}: {fail.error}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Drag & Drop Zone */}
        {!uploading && (
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            style={{
              border: dragActive ? '3px dashed #4299e1' : '2px dashed #cbd5e0',
              borderRadius: '8px',
              padding: '40px',
              textAlign: 'center',
              background: dragActive ? '#ebf8ff' : '#f7fafc',
              marginBottom: '20px',
              transition: 'all 0.2s',
              cursor: 'pointer'
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>📁</div>
            <div style={{ fontSize: '1.1em', fontWeight: '600', color: '#2d3748', marginBottom: '8px' }}>
              Drop multiple files here or click to browse
            </div>
            <div style={{ fontSize: '0.85em', color: '#718096' }}>
              Supports PDF, DOC, DOCX, TXT, XLS, XLSX, JPG, PNG, TIFF, ZIP, EML
            </div>
            <div style={{ fontSize: '0.85em', color: '#718096' }}>
              Max 50 files per batch, 50MB per file
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileInput}
              style={{ display: 'none' }}
              accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,.jpg,.jpeg,.png,.tiff,.zip,.eml"
            />
          </div>
        )}

        {/* File List */}
        {files.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px'
            }}>
              <h4 style={{ margin: 0, color: '#2d3748' }}>
                Selected Files ({validFilesCount} valid, {formatFileSize(totalSize)} total)
              </h4>
              {!uploading && (
                <button
                  onClick={() => setFiles([])}
                  style={{
                    padding: '6px 12px',
                    background: '#fff',
                    border: '1px solid #e53e3e',
                    borderRadius: '4px',
                    color: '#e53e3e',
                    cursor: 'pointer',
                    fontSize: '0.85em',
                    fontWeight: '600'
                  }}
                >
                  Clear All
                </button>
              )}
            </div>

            <div style={{
              maxHeight: '250px',
              overflow: 'auto',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              padding: '8px'
            }}>
              {files.map(fileObj => (
                <div
                  key={fileObj.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px',
                    borderRadius: '4px',
                    background: fileObj.error ? '#fff5f5' : '#f7fafc',
                    border: '1px solid',
                    borderColor: fileObj.error ? '#fc8181' : '#e2e8f0',
                    marginBottom: '8px'
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontWeight: '500',
                      color: fileObj.error ? '#c53030' : '#1a202c',
                      marginBottom: '4px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {fileObj.name}
                    </div>
                    <div style={{ fontSize: '0.8em', color: '#718096' }}>
                      {formatFileSize(fileObj.size)}
                      {fileObj.error && (
                        <span style={{ color: '#e53e3e', marginLeft: '8px' }}>
                          ⚠️ {fileObj.error}
                        </span>
                      )}
                    </div>
                    {uploadProgress[fileObj.id] !== undefined && (
                      <div style={{ marginTop: '6px' }}>
                        <div style={{
                          width: '100%',
                          height: '6px',
                          background: '#e2e8f0',
                          borderRadius: '3px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${uploadProgress[fileObj.id]}%`,
                            height: '100%',
                            background: uploadProgress[fileObj.id] === 100 ? '#48bb78' : '#4299e1',
                            transition: 'width 0.3s'
                          }} />
                        </div>
                        <div style={{ fontSize: '0.75em', color: '#718096', marginTop: '2px' }}>
                          {uploadProgress[fileObj.id]}%
                        </div>
                      </div>
                    )}
                  </div>
                  {!uploading && (
                    <button
                      onClick={() => removeFile(fileObj.id)}
                      style={{
                        marginLeft: '12px',
                        padding: '4px 8px',
                        background: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        color: '#718096',
                        fontSize: '0.85em'
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Global Metadata */}
        {files.length > 0 && (
          <div style={{
            background: '#f7fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            padding: '16px',
            marginBottom: '20px'
          }}>
            <div style={{ marginBottom: '12px' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                fontWeight: '600',
                color: '#2d3748',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={applyMetadataToAll}
                  onChange={(e) => setApplyMetadataToAll(e.target.checked)}
                  disabled={uploading}
                  style={{ marginRight: '8px' }}
                />
                Apply metadata to all files
              </label>
            </div>

            {applyMetadataToAll && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px',
                marginTop: '12px'
              }}>
                <label style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.9em', fontWeight: '500', marginBottom: '4px', color: '#4a5568' }}>
                    Legal Category
                  </span>
                  <select
                    value={globalMetadata.legal_category}
                    onChange={(e) => setGlobalMetadata({ ...globalMetadata, legal_category: e.target.value })}
                    disabled={uploading}
                    style={{
                      padding: '8px',
                      border: '1px solid #cbd5e0',
                      borderRadius: '4px',
                      fontSize: '0.9em'
                    }}
                  >
                    <option value="">Select category...</option>
                    {options.legalCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </label>

                <label style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.9em', fontWeight: '500', marginBottom: '4px', color: '#4a5568' }}>
                    Evidence Type
                  </span>
                  <select
                    value={globalMetadata.evidence_type}
                    onChange={(e) => setGlobalMetadata({ ...globalMetadata, evidence_type: e.target.value })}
                    disabled={uploading}
                    style={{
                      padding: '8px',
                      border: '1px solid #cbd5e0',
                      borderRadius: '4px',
                      fontSize: '0.9em'
                    }}
                  >
                    <option value="">Select type...</option>
                    {options.evidenceTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </label>

                <label style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.9em', fontWeight: '500', marginBottom: '4px', color: '#4a5568' }}>
                    Case Number
                  </span>
                  <input
                    type="text"
                    value={globalMetadata.case_number}
                    onChange={(e) => setGlobalMetadata({ ...globalMetadata, case_number: e.target.value })}
                    placeholder="e.g., 2023-CV-1234"
                    disabled={uploading}
                    style={{
                      padding: '8px',
                      border: '1px solid #cbd5e0',
                      borderRadius: '4px',
                      fontSize: '0.9em'
                    }}
                  />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.9em', fontWeight: '500', marginBottom: '4px', color: '#4a5568' }}>
                    Witness Name
                  </span>
                  <input
                    type="text"
                    value={globalMetadata.witness_name}
                    onChange={(e) => setGlobalMetadata({ ...globalMetadata, witness_name: e.target.value })}
                    placeholder="Witness name"
                    disabled={uploading}
                    list="witness-suggestions"
                    style={{
                      padding: '8px',
                      border: '1px solid #cbd5e0',
                      borderRadius: '4px',
                      fontSize: '0.9em'
                    }}
                  />
                  <datalist id="witness-suggestions">
                    {suggestions.witnesses.map((witness, idx) => (
                      <option key={idx} value={witness} />
                    ))}
                  </datalist>
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gridColumn: '1 / -1' }}>
                  <span style={{ fontSize: '0.9em', fontWeight: '500', marginBottom: '4px', color: '#4a5568' }}>
                    Folder
                  </span>
                  <input
                    type="text"
                    value={globalMetadata.folder}
                    onChange={(e) => setGlobalMetadata({ ...globalMetadata, folder: e.target.value })}
                    placeholder="Optional folder/path"
                    disabled={uploading}
                    style={{
                      padding: '8px',
                      border: '1px solid #cbd5e0',
                      borderRadius: '4px',
                      fontSize: '0.9em'
                    }}
                  />
                </label>

                {/* Tags */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <span style={{ fontSize: '0.9em', fontWeight: '500', marginBottom: '4px', color: '#4a5568', display: 'block' }}>
                    Tags
                  </span>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addTag();
                        }
                      }}
                      placeholder="Add tag..."
                      disabled={uploading}
                      list="tag-suggestions"
                      style={{
                        flex: 1,
                        padding: '8px',
                        border: '1px solid #cbd5e0',
                        borderRadius: '4px',
                        fontSize: '0.9em'
                      }}
                    />
                    <datalist id="tag-suggestions">
                      {suggestions.tags.map((tag, idx) => (
                        <option key={idx} value={tag} />
                      ))}
                    </datalist>
                    <button
                      type="button"
                      onClick={addTag}
                      disabled={uploading || !tagInput.trim()}
                      style={{
                        padding: '8px 16px',
                        background: tagInput.trim() ? '#4299e1' : '#cbd5e0',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: tagInput.trim() ? 'pointer' : 'not-allowed',
                        fontSize: '0.9em',
                        fontWeight: '600'
                      }}
                    >
                      Add
                    </button>
                  </div>

                  {globalMetadata.tags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {globalMetadata.tags.map(tag => (
                        <span
                          key={tag}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 10px',
                            background: '#e6f2ff',
                            border: '1px solid #4299e1',
                            borderRadius: '16px',
                            fontSize: '0.85em',
                            color: '#2c5282'
                          }}
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            disabled={uploading}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#2c5282',
                              cursor: 'pointer',
                              padding: '0',
                              fontSize: '1.1em',
                              lineHeight: '1'
                            }}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ 
          display: 'flex', 
          gap: '12px', 
          justifyContent: 'flex-end' 
        }}>
          <button
            onClick={onClose}
            disabled={uploading}
            style={{
              padding: '10px 20px',
              background: '#fff',
              color: '#4a5568',
              border: '1px solid #cbd5e0',
              borderRadius: '6px',
              cursor: uploading ? 'not-allowed' : 'pointer',
              fontSize: '0.95em',
              fontWeight: '600'
            }}
          >
            {uploading ? 'Uploading...' : 'Cancel'}
          </button>
          <button
            onClick={handleBulkUpload}
            disabled={uploading || validFilesCount === 0}
            style={{
              padding: '10px 20px',
              background: (uploading || validFilesCount === 0) ? '#cbd5e0' : '#2166e8',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: (uploading || validFilesCount === 0) ? 'not-allowed' : 'pointer',
              fontSize: '0.95em',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {uploading && (
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
            {uploading ? `Uploading ${completedUploads.length}/${validFilesCount}...` : `📤 Upload ${validFilesCount} File${validFilesCount !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

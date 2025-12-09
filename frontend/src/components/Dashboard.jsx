import React, { useEffect, useState } from "react";
import { apiGet, apiPost, apiPatch, apiDelete } from "../utils/api";
import GlobalSearch from "./GlobalSearch";
import AdvancedSearch from "./AdvancedSearch";
import { canAccess } from "../utils/rbac";

export default function Dashboard({ onOpenCase, user }) {
  const [cases, setCases] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [retentionStats, setRetentionStats] = useState(null);
  const [approachingCases, setApproachingCases] = useState([]);
  const [showRetentionPanel, setShowRetentionPanel] = useState(false);
  const [showAddCaseModal, setShowAddCaseModal] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeView, setActiveView] = useState('dashboard');
  const [showSearch, setShowSearch] = useState(false);
  const [selectedCase, setSelectedCase] = useState(null);
  const [caseNotes, setCaseNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFiles, setUploadFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploadConfig, setUploadConfig] = useState({
    caseId: '',
    custodian: '',
    autoTag: true
  });
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentUploadFile, setCurrentUploadFile] = useState('');
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [newCase, setNewCase] = useState({
    name: '',
    number: '',
    status: 'open',
    assigned_to: '',
    disposition: ''
  });
  const [stats, setStats] = useState({
    totalCases: 0,
    openCases: 0,
    closedCases: 0,
    flaggedCases: 0,
    totalDocuments: 0,
    documentsByType: {},
    casesByDisposition: {},
    casesByStatus: {}
  });

  useEffect(() => {
    async function load() {
      setLoading(true);
      const cs = await apiGet("/cases");
      setCases(cs);
      // Fetch all docs for search (optional: load inside CaseDetail for detail view)
      let allDocs = [];
      for (const c of cs) {
        try {
          const caseDocs = await apiGet(`/documents/case/${c.id}/documents`);
          allDocs = [...allDocs, ...caseDocs];
        } catch {}
      }
      setDocuments(allDocs);
      
      // Calculate statistics
      const newStats = calculateStats(cs, allDocs);
      setStats(newStats);
      
      // Load retention data (managers and admins only)
      if (user && canAccess(user.role, 'read', 'retention')) {
        try {
          const retStats = await apiGet('/retention/stats');
          setRetentionStats(retStats);
          
          const approaching = await apiGet('/retention/cases/approaching?days=90');
          setApproachingCases(approaching.cases || []);
        } catch (err) {
          console.error('Error loading retention data:', err);
        }
      }
      
      setLoading(false);
    }
    load();
  }, [user]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const calculateStats = (caseList, docList) => {
    const stats = {
      totalCases: caseList.length,
      openCases: caseList.filter(c => c.status === 'open').length,
      closedCases: caseList.filter(c => c.status === 'closed').length,
      flaggedCases: caseList.filter(c => c.status === 'flagged').length,
      totalDocuments: docList.length,
      documentsByType: {},
      casesByDisposition: {},
      casesByStatus: {}
    };

    // Count documents by type
    docList.forEach(doc => {
      if (doc.file_type) {
        const ext = doc.file_type.split('/').pop().toUpperCase();
        stats.documentsByType[ext] = (stats.documentsByType[ext] || 0) + 1;
      }
    });

    // Count cases by disposition
    caseList.forEach(c => {
      if (c.disposition) {
        stats.casesByDisposition[c.disposition] = (stats.casesByDisposition[c.disposition] || 0) + 1;
      }
    });

    // Count cases by status
    caseList.forEach(c => {
      if (c.status) {
        stats.casesByStatus[c.status] = (stats.casesByStatus[c.status] || 0) + 1;
      }
    });

    return stats;
  };

  const handleAddCase = async () => {
    if (!newCase.name || !newCase.number) {
      alert('Please fill in case name and number');
      return;
    }

    try {
      const createdCase = await apiPost('/cases', newCase);
      setCases([...cases, createdCase]);
      setShowAddCaseModal(false);
      setNewCase({
        name: '',
        number: '',
        status: 'open',
        assigned_to: '',
        disposition: ''
      });
      alert('Case created successfully!');
    } catch (error) {
      alert('Failed to create case: ' + error.message);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'open': '#48bb78',
      'closed': '#718096',
      'flagged': '#f56565',
      'pending': '#ed8936',
      'in-progress': '#4299e1'
    };
    return colors[status] || '#a0aec0';
  };

  const getDispositionColor = (disposition) => {
    const colors = {
      'dismissed': '#48bb78',
      'plea': '#4299e1',
      'settlement': '#805ad5',
      'probation': '#ed8936',
      'trial': '#e53e3e'
    };
    return colors[disposition] || '#a0aec0';
  };

  const handleCaseClick = (caseItem) => {
    setSelectedCase(caseItem);
    setCaseNotes(caseItem.notes || '');
  };

  const handleSaveNotes = async () => {
    if (!selectedCase) return;
    
    setSavingNotes(true);
    try {
      await apiPatch(`/cases/${selectedCase.id}`, { notes: caseNotes });
      // Update the case in the local state
      setCases(cases.map(c => c.id === selectedCase.id ? { ...c, notes: caseNotes } : c));
      setSelectedCase({ ...selectedCase, notes: caseNotes });
      alert('Notes saved successfully!');
    } catch (error) {
      alert('Failed to save notes: ' + error.message);
    } finally {
      setSavingNotes(false);
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

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const newFiles = Array.from(e.dataTransfer.files);
      setUploadFiles(prev => [...prev, ...newFiles]);
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      const newFiles = Array.from(e.target.files);
      setUploadFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index) => {
    setUploadFiles(prev => prev.filter((_, i) => i !== index));
  };

  const getFileType = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    const typeMap = {
      pdf: 'PDF Document',
      doc: 'Word Document',
      docx: 'Word Document',
      xls: 'Excel Spreadsheet',
      xlsx: 'Excel Spreadsheet',
      ppt: 'PowerPoint',
      pptx: 'PowerPoint',
      txt: 'Text File',
      jpg: 'Image',
      jpeg: 'Image',
      png: 'Image',
      gif: 'Image',
      zip: 'Archive',
      msg: 'Email Message',
      eml: 'Email Message',
      mp4: 'Video',
      mov: 'Video'
    };
    return typeMap[ext] || 'Unknown';
  };

  const handleBatchUpload = async () => {
    if (uploadFiles.length === 0) {
      alert('Please select files to upload');
      return;
    }
    if (!uploadConfig.caseId) {
      alert('Please select a case');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      
      // Add all files to FormData
      uploadFiles.forEach(file => {
        formData.append('files', file);
      });
      
      // Add shared metadata
      formData.append('case_id', uploadConfig.caseId);
      formData.append('custodian', uploadConfig.custodian || '');
      formData.append('auto_tag', uploadConfig.autoTag);
      
      // Add tags if auto-tagging is disabled
      if (!uploadConfig.autoTag) {
        formData.append('tags', JSON.stringify([]));
      }

      // Use XMLHttpRequest for progress tracking
      const xhr = new XMLHttpRequest();
      
      // Set timeout to 5 minutes
      xhr.timeout = 300000;
      
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(percentComplete);
          setCurrentUploadFile(`Uploading ${uploadFiles.length} files...`);
        }
      });

      const response = await new Promise((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject(new Error(xhr.statusText));
          }
        };
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.ontimeout = () => reject(new Error('Upload timeout - please try with fewer files'));
        
        xhr.open('POST', `http://localhost:4443/api/case/${uploadConfig.caseId}/documents/bulk-upload`);
        xhr.setRequestHeader('Authorization', `Bearer ${localStorage.getItem('token')}`);
        xhr.send(formData);
      });

      setUploading(false);
      setUploadProgress(0);
      setCurrentUploadFile('');

      if (response.success) {
        alert(`✅ Bulk upload complete!\n\nSuccessfully uploaded: ${response.uploaded}\nFailed: ${response.failed}\n\nTotal files: ${uploadFiles.length}`);
        
        if (response.errors && response.errors.length > 0) {
          console.error('Upload errors:', response.errors);
        }
        
        // Reload documents
        const allDocs = [];
        const failedCases = [];
        for (const c of cases) {
          try {
            const caseDocs = await apiGet(`/documents/case/${c.id}/documents`);
            allDocs.push(...caseDocs);
          } catch (error) {
            console.error(`Failed to load documents for case ${c.id}:`, error);
            failedCases.push(c.name);
          }
        }
        setDocuments(allDocs);
        
        if (failedCases.length > 0) {
          console.warn(`Could not load documents from: ${failedCases.join(', ')}`);
        }
        
        // Reset upload state
        setUploadFiles([]);
        setUploadConfig({ caseId: '', custodian: '', autoTag: true });
        setShowUploadModal(false);
      }
    } catch (error) {
      console.error('Bulk upload error:', error);
      setUploading(false);
      setUploadProgress(0);
      setCurrentUploadFile('');
      alert(`❌ Bulk upload failed: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        color: '#718096' 
      }}>
        <div>
          <div style={{ fontSize: '48px', marginBottom: '16px', textAlign: 'center' }}>⏳</div>
          <div>Loading dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#f7fafc' }}>
      {/* Top Navigation Bar */}
      <div style={{
        height: '64px',
        background: '#fff',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: isMobile ? '0 12px' : '0 24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        zIndex: 200,
        gap: isMobile ? '8px' : '24px'
      }}>
        {/* Mobile Menu Toggle */}
        {isMobile && (
          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1.5em',
              padding: '8px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            ☰
          </button>
        )}

        {/* Left Section - Logo/Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ fontSize: '1.5em' }}>⚖️</div>
          {!isMobile && (
            <div style={{ fontWeight: '700', fontSize: '1.2em', color: '#2d3748', whiteSpace: 'nowrap' }}>
              eDiscovery
            </div>
          )}
        </div>

        {/* Center Section - Global Search (Hidden on mobile) */}
        {!isMobile && (
          <div style={{ flex: 1, maxWidth: '600px', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <GlobalSearch
              cases={cases}
              documents={documents}
              onNavigate={(item) => {
                if (item.type === "Case") onOpenCase(item.id);
                if (item.type === "Document") onOpenCase(item.case_id);
              }}
            />
            <button
              onClick={() => setShowAdvancedSearch(true)}
              title="Advanced Search"
              style={{
                padding: '10px 16px',
                background: '#805ad5',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.9em',
                transition: 'background 0.2s',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#6b46c1'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#805ad5'}
            >
              🔍+ Advanced
            </button>
          </div>
        )}

        {/* Right Section - Actions & User */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '16px' }}>
          {/* Upload Button */}
          {user && canAccess(user.role, 'create', 'document') && (
            <button
              onClick={() => setShowUploadModal(true)}
              style={{
                padding: isMobile ? '8px' : '10px 20px',
                background: '#4299e1',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.95em',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'background 0.2s',
                whiteSpace: 'nowrap'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#3182ce'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#4299e1'}
            >
              <span style={{ fontSize: '1.2em' }}>📤</span>
              {!isMobile && 'Upload'}
            </button>
          )}

          {/* Add Case Button */}
          {user && canAccess(user.role, 'create', 'case') && (
            <button
              onClick={() => setShowAddCaseModal(true)}
              style={{
                padding: isMobile ? '8px' : '10px 20px',
                background: '#48bb78',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.95em',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'background 0.2s',
                whiteSpace: 'nowrap'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#38a169'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#48bb78'}
            >
              <span style={{ fontSize: '1.2em' }}>+</span>
              {!isMobile && 'Add Case'}
            </button>
          )}

          {/* Notifications - Hide on mobile */}
          {!isMobile && (
            <button style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1.3em',
              padding: '8px',
              borderRadius: '6px',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#f7fafc'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            title="Notifications">
              🔔
            </button>
          )}

          {/* Settings - Hide on mobile */}
          {!isMobile && (
            <button style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1.3em',
              padding: '8px',
              borderRadius: '6px',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#f7fafc'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            title="Settings">
              ⚙️
            </button>
          )}

          {/* User Avatar/Profile */}
          {user && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '6px 12px',
              background: '#f7fafc',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#edf2f7'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#f7fafc'}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: '#2166e8',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '700',
                fontSize: '0.9em'
              }}>
                {user.name.charAt(0).toUpperCase()}
              </div>
              {!isMobile && (
                <div style={{ fontSize: '0.9em' }}>
                  <div style={{ fontWeight: '600', color: '#2d3748' }}>{user.name}</div>
                  <div style={{ fontSize: '0.85em', color: '#718096', textTransform: 'capitalize' }}>
                    {user.role}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Layout Container */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* Left Sidebar - Hidden on mobile unless menu is open */}
      {(!isMobile || showMobileMenu) && (
      <div style={{
        width: isMobile ? '100%' : (sidebarCollapsed ? '60px' : '240px'),
        background: '#2d3748',
        transition: 'width 0.3s ease',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '2px 0 8px rgba(0,0,0,0.1)',
        zIndex: isMobile ? 300 : 100,
        position: isMobile ? 'fixed' : 'relative',
        height: isMobile ? 'calc(100vh - 64px)' : 'auto',
        top: isMobile ? '64px' : 'auto',
        left: isMobile ? '0' : 'auto'
      }}>
        {/* Top Menu Toggle Button */}
        {!isMobile && (
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          style={{
            padding: '20px',
            background: 'transparent',
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
            transition: 'background 0.2s',
            fontSize: '1.2em'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#4a5568'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <span style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ width: '24px', height: '3px', background: '#fff', borderRadius: '2px' }}></div>
            <div style={{ width: '24px', height: '3px', background: '#fff', borderRadius: '2px' }}></div>
            <div style={{ width: '24px', height: '3px', background: '#fff', borderRadius: '2px' }}></div>
          </span>
          {!sidebarCollapsed && <span style={{ marginLeft: '12px', fontSize: '0.9em' }}>Menu</span>}
        </button>
        )}

        {/* Navigation Menu */}
        <div style={{ flex: 1, padding: '10px 0' }}>
          {/* Upload Button */}
          {user && canAccess(user.role, 'create', 'document') && (
            <button
              onClick={() => {
                setShowUploadModal(true);
                if (isMobile) setShowMobileMenu(false);
              }}
              style={{
                width: '100%',
                padding: '16px 20px',
                background: showUploadModal ? '#2166e8' : 'transparent',
                border: 'none',
                borderLeft: showUploadModal ? '4px solid #fff' : '4px solid transparent',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: (sidebarCollapsed && !isMobile) ? 'center' : 'flex-start',
                gap: '12px',
                transition: 'all 0.2s',
                fontSize: '1em'
              }}
              onMouseEnter={(e) => {
                if (!showUploadModal) e.currentTarget.style.background = '#4a5568';
              }}
              onMouseLeave={(e) => {
                if (!showUploadModal) e.currentTarget.style.background = 'transparent';
              }}
            >
              <span style={{ fontSize: '1.3em' }}>📤</span>
              {(!sidebarCollapsed || isMobile) && <span>Upload</span>}
            </button>
          )}

          {/* Tag Button */}
          {user && canAccess(user.role, 'update', 'document') && (
            <button
              onClick={() => {
                setActiveView('tag');
                if (isMobile) setShowMobileMenu(false);
              }}
              style={{
                width: '100%',
                padding: '16px 20px',
                background: activeView === 'tag' ? '#2166e8' : 'transparent',
                border: 'none',
                borderLeft: activeView === 'tag' ? '4px solid #fff' : '4px solid transparent',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: (sidebarCollapsed && !isMobile) ? 'center' : 'flex-start',
                gap: '12px',
                transition: 'all 0.2s',
                fontSize: '1em'
              }}
              onMouseEnter={(e) => {
                if (activeView !== 'tag') e.currentTarget.style.background = '#4a5568';
              }}
              onMouseLeave={(e) => {
                if (activeView !== 'tag') e.currentTarget.style.background = 'transparent';
              }}
            >
              <span style={{ fontSize: '1.3em' }}>🏷️</span>
              {(!sidebarCollapsed || isMobile) && <span>Tag</span>}
            </button>
          )}

          {/* Search Button */}
          <button
            onClick={() => {
              setActiveView('search');
              if (isMobile) setShowMobileMenu(false);
            }}
            style={{
              width: '100%',
              padding: '16px 20px',
              background: activeView === 'search' ? '#2166e8' : 'transparent',
              border: 'none',
              borderLeft: activeView === 'search' ? '4px solid #fff' : '4px solid transparent',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: (sidebarCollapsed && !isMobile) ? 'center' : 'flex-start',
              gap: '12px',
              transition: 'all 0.2s',
              fontSize: '1em'
            }}
            onMouseEnter={(e) => {
              if (activeView !== 'search') e.currentTarget.style.background = '#4a5568';
            }}
            onMouseLeave={(e) => {
              if (activeView !== 'search') e.currentTarget.style.background = 'transparent';
            }}
          >
            <span style={{ fontSize: '1.3em' }}>🔍</span>
            {(!sidebarCollapsed || isMobile) && <span>Search</span>}
          </button>

          {/* Export Button */}
          {user && canAccess(user.role, 'read', 'document') && (
            <button
              onClick={() => {
                setActiveView('export');
                if (isMobile) setShowMobileMenu(false);
              }}
              style={{
                width: '100%',
                padding: '16px 20px',
                background: activeView === 'export' ? '#2166e8' : 'transparent',
                border: 'none',
                borderLeft: activeView === 'export' ? '4px solid #fff' : '4px solid transparent',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: (sidebarCollapsed && !isMobile) ? 'center' : 'flex-start',
                gap: '12px',
                transition: 'all 0.2s',
                fontSize: '1em'
              }}
              onMouseEnter={(e) => {
                if (activeView !== 'export') e.currentTarget.style.background = '#4a5568';
              }}
              onMouseLeave={(e) => {
                if (activeView !== 'export') e.currentTarget.style.background = 'transparent';
              }}
            >
              <span style={{ fontSize: '1.3em' }}>📥</span>
              {(!sidebarCollapsed || isMobile) && <span>Export</span>}
            </button>
          )}
        </div>

        {/* User Info at Bottom */}
        {(!sidebarCollapsed || isMobile) && user && (
          <div style={{
            padding: '20px',
            borderTop: '1px solid #4a5568',
            color: '#cbd5e0',
            fontSize: '0.85em'
          }}>
            <div style={{ fontWeight: '600', marginBottom: '4px' }}>{user.name}</div>
            <div style={{ textTransform: 'capitalize', color: '#a0aec0' }}>{user.role}</div>
          </div>
        )}
      </div>
      )}

      {/* Main Content Area */}
      <div style={{ 
        flex: 1, 
        overflowY: 'auto', 
        padding: isMobile ? '16px' : '32px',
        background: '#f7fafc'
      }}>
        {/* Content based on active view */}
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>

          {/* Search View */}
          {activeView === 'search' && (
            <div style={{
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '24px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
            }}>
              <h2 style={{ margin: '0 0 20px 0', color: '#2d3748', fontSize: '1.5em' }}>
                🔍 Search Documents
              </h2>
              <p style={{ color: '#718096', marginBottom: '20px' }}>
                Search through all documents across all cases
              </p>
              <GlobalSearch 
                documents={documents} 
                onSelect={(doc) => console.log('Selected:', doc)} 
              />
            </div>
          )}

          {/* Tag View */}
          {activeView === 'tag' && (
            <div style={{
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '24px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
            }}>
              <h2 style={{ margin: '0 0 20px 0', color: '#2d3748', fontSize: '1.5em' }}>
                🏷️ Tag Documents
              </h2>
              <p style={{ color: '#718096', marginBottom: '20px' }}>
                Organize and categorize your documents with tags
              </p>
              <div style={{ padding: '40px', textAlign: 'center', color: '#718096' }}>
                <div style={{ fontSize: '4em', marginBottom: '16px' }}>🏷️</div>
                <h3 style={{ color: '#2d3748', marginBottom: '12px' }}>Document Tagging</h3>
                <p>Select documents from the search results or upload them first to add tags.</p>
                <p style={{ marginTop: '16px', fontSize: '0.9em' }}>
                  Tags help you organize documents by case, custodian, file type, and custom categories.
                </p>
              </div>
            </div>
          )}

          {/* Export View */}
          {activeView === 'export' && (
            <div style={{
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '24px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
            }}>
              <h2 style={{ margin: '0 0 20px 0', color: '#2d3748', fontSize: '1.5em' }}>
                📥 Export Documents
              </h2>
              <p style={{ color: '#718096', marginBottom: '20px' }}>
                Export documents in various formats (PDF, CSV, ZIP)
              </p>
              <div style={{ padding: '40px', textAlign: 'center', color: '#718096' }}>
                <div style={{ fontSize: '4em', marginBottom: '16px' }}>📥</div>
                <h3 style={{ color: '#2d3748', marginBottom: '12px' }}>Export Options</h3>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                  gap: '16px', 
                  maxWidth: '800px', 
                  margin: '24px auto' 
                }}>
                  <div style={{ 
                    padding: '24px', 
                    border: '1px solid #e2e8f0', 
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                  >
                    <div style={{ fontSize: '2em', marginBottom: '8px' }}>📄</div>
                    <div style={{ fontWeight: '600', color: '#2d3748' }}>Export as PDF</div>
                    <div style={{ fontSize: '0.85em', marginTop: '8px' }}>Export documents to PDF format</div>
                  </div>
                  <div style={{ 
                    padding: '24px', 
                    border: '1px solid #e2e8f0', 
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                  >
                    <div style={{ fontSize: '2em', marginBottom: '8px' }}>📊</div>
                    <div style={{ fontWeight: '600', color: '#2d3748' }}>Export as CSV</div>
                    <div style={{ fontSize: '0.85em', marginTop: '8px' }}>Export metadata to spreadsheet</div>
                  </div>
                  <div style={{ 
                    padding: '24px', 
                    border: '1px solid #e2e8f0', 
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                  >
                    <div style={{ fontSize: '2em', marginBottom: '8px' }}>🗜️</div>
                    <div style={{ fontWeight: '600', color: '#2d3748' }}>Export as ZIP</div>
                    <div style={{ fontSize: '0.85em', marginTop: '8px' }}>Download all files in archive</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Default view - removed dashboard sections */}
        </div>
      </div>

      {/* Upload & Ingest Modal */}
      {showUploadModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#fff',
            borderRadius: isMobile ? '0' : '8px',
            padding: isMobile ? '16px' : '24px',
            maxWidth: isMobile ? '100%' : '700px',
            width: isMobile ? '100%' : '90%',
            maxHeight: isMobile ? '100%' : '90vh',
            height: isMobile ? '100%' : 'auto',
            overflowY: 'auto',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ margin: '0 0 20px 0', color: '#2d3748', fontSize: '1.5em' }}>
              📤 Upload & Ingest Documents
            </h3>
            
            {/* Configuration Section */}
            <div style={{ marginBottom: '24px', padding: '16px', background: '#f7fafc', borderRadius: '8px' }}>
              <h4 style={{ margin: '0 0 16px 0', color: '#2d3748', fontSize: '1.1em' }}>Upload Configuration</h4>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#4a5568' }}>
                  Select Case *
                </label>
                <select
                  value={uploadConfig.caseId}
                  onChange={(e) => setUploadConfig({ ...uploadConfig, caseId: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #cbd5e0',
                    borderRadius: '6px',
                    fontSize: '1em',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="">Choose a case...</option>
                  {cases.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} (#{c.number})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#4a5568' }}>
                  Custodian (Optional)
                </label>
                <input
                  type="text"
                  value={uploadConfig.custodian}
                  onChange={(e) => setUploadConfig({ ...uploadConfig, custodian: e.target.value })}
                  placeholder="e.g., John Doe"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #cbd5e0',
                    borderRadius: '6px',
                    fontSize: '1em',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <input
                  type="checkbox"
                  id="autoTag"
                  checked={uploadConfig.autoTag}
                  onChange={(e) => setUploadConfig({ ...uploadConfig, autoTag: e.target.checked })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="autoTag" style={{ fontWeight: '600', color: '#4a5568', cursor: 'pointer' }}>
                  Enable auto-tagging by case, custodian, and file type
                </label>
              </div>

              {uploadConfig.autoTag && (
                <div style={{ 
                  padding: '12px', 
                  background: '#e6fffa', 
                  borderRadius: '6px', 
                  border: '1px solid #81e6d9',
                  fontSize: '0.9em',
                  color: '#234e52'
                }}>
                  <div style={{ fontWeight: '600', marginBottom: '6px' }}>✨ Auto-tagging enabled</div>
                  <div>All files will be automatically tagged with:</div>
                  <ul style={{ marginLeft: '20px', marginTop: '6px', marginBottom: 0 }}>
                    <li>File type (PDF, Word, Excel, etc.)</li>
                    {uploadConfig.custodian && <li>Custodian: {uploadConfig.custodian}</li>}
                  </ul>
                </div>
              )}
            </div>

            {/* Bulk Upload Info Banner */}
            {uploadFiles.length > 1 && (
              <div style={{
                marginBottom: '16px',
                padding: '12px 16px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: '8px',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                boxShadow: '0 4px 6px rgba(102, 126, 234, 0.3)'
              }}>
                <div style={{ fontSize: '24px' }}>🚀</div>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '1.05em' }}>
                    Bulk Upload Mode
                  </div>
                  <div style={{ fontSize: '0.9em', opacity: 0.95 }}>
                    {uploadFiles.length} files will be uploaded simultaneously with shared metadata
                  </div>
                </div>
              </div>
            )}

            {/* Drag & Drop Upload Area */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`
                relative border-2 border-dashed rounded-lg p-10 text-center mb-5 
                transition-all duration-200 cursor-pointer
                ${dragActive 
                  ? 'border-blue-500 bg-blue-50 border-4' 
                  : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-gray-100'
                }
              `}
              onClick={() => document.getElementById('fileInput').click()}
            >
              <div className="text-5xl mb-3">📁</div>
              <div className="text-lg font-semibold text-gray-800 mb-2">
                Drag & drop files here
              </div>
              <div className="text-gray-600 mb-3">
                or click to browse
              </div>
              <div className="text-sm text-gray-500">
                Supports: PDF, DOC, XLS, PPT, Images, Videos (MP4, MOV), Email files (MSG, EML)
              </div>
              <input
                id="fileInput"
                type="file"
                multiple
                onChange={handleFileInput}
                className="hidden"
              />
            </div>

            {/* Upload Progress Bar */}
            {uploading && (
              <div className="mb-5">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    Uploading: {currentUploadFile}
                  </span>
                  <span className="text-sm font-medium text-blue-600">
                    {uploadProgress}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                  >
                    <div className="h-full w-full bg-white opacity-20 animate-pulse"></div>
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-1 text-center">
                  {Math.round((uploadProgress / 100) * uploadFiles.length)} of {uploadFiles.length} files uploaded
                </div>
              </div>
            )}

            {/* Selected Files List */}
            {uploadFiles.length > 0 && !uploading && (
              <div className="mb-5">
                <h4 className="text-base font-semibold text-gray-800 mb-3">
                  Selected Files ({uploadFiles.length})
                </h4>
                <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-2">
                  {uploadFiles.map((file, index) => (
                    <div 
                      key={index} 
                      className="flex justify-between items-center p-3 bg-gray-50 rounded-md mb-2 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-800 text-sm truncate">
                          {file.name}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          {getFileType(file.name)} • {(file.size / 1024 / 1024).toFixed(2)} MB
                          {uploadConfig.autoTag && (
                            <span className="ml-2 text-blue-600">
                              🏷️ Auto-tagged
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => removeFile(index)}
                        className="ml-3 bg-red-500 hover:bg-red-600 text-white font-semibold py-1.5 px-3 rounded transition-colors text-sm flex-shrink-0"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadFiles([]);
                  setUploadConfig({ caseId: '', custodian: '', autoTag: true });
                }}
                disabled={uploading}
                style={{
                  padding: '10px 20px',
                  background: uploading ? '#cbd5e0' : '#e2e8f0',
                  color: '#2d3748',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: uploading ? 'not-allowed' : 'pointer',
                  fontWeight: '600'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleBatchUpload}
                disabled={uploading || uploadFiles.length === 0 || !uploadConfig.caseId}
                style={{
                  padding: '10px 20px',
                  background: uploading || uploadFiles.length === 0 || !uploadConfig.caseId ? '#cbd5e0' : '#4299e1',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: uploading || uploadFiles.length === 0 || !uploadConfig.caseId ? 'not-allowed' : 'pointer',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {uploading ? (
                  <>
                    <span>⏳</span>
                    Uploading...
                  </>
                ) : (
                  <>
                    <span>📤</span>
                    Upload {uploadFiles.length} {uploadFiles.length === 1 ? 'File' : 'Files'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Advanced Search Modal */}
      {showAdvancedSearch && (
        <AdvancedSearch
          onResults={(results) => {
            console.log('Search results:', results);
            // You can handle results display here if needed
          }}
          onClose={() => setShowAdvancedSearch(false)}
        />
      )}
        </div>
      </div>
      </div>
    </div>
  );
}
import React, { useEffect, useState } from "react";
import { apiGet, apiPost, apiPatch, apiDelete } from "../utils/api";
import GlobalSearch from "./GlobalSearch";
import { canAccess } from "../utils/rbac";

export default function Dashboard({ onOpenCase, user }) {
  const [cases, setCases] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [retentionStats, setRetentionStats] = useState(null);
  const [approachingCases, setApproachingCases] = useState([]);
  const [showRetentionPanel, setShowRetentionPanel] = useState(false);
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

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '400px',
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
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '20px' }}>
      {/* Global Search */}
      <div style={{marginBottom:32}}>
        <GlobalSearch
          cases={cases}
          documents={documents}
          onNavigate={(item) => {
            if (item.type === "Case") onOpenCase(item.id);
            if (item.type === "Document") onOpenCase(item.case_id);
          }}
        />
      </div>

      {/* Statistics Overview */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '32px'
      }}>
        {/* Total Cases */}
        <div style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '20px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ fontSize: '0.85em', color: '#718096', marginBottom: '8px', fontWeight: '600' }}>
            TOTAL CASES
          </div>
          <div style={{ fontSize: '2em', fontWeight: '700', color: '#2d3748' }}>
            {stats.totalCases}
          </div>
        </div>

        {/* Open Cases */}
        <div style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '20px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ fontSize: '0.85em', color: '#718096', marginBottom: '8px', fontWeight: '600' }}>
            OPEN CASES
          </div>
          <div style={{ fontSize: '2em', fontWeight: '700', color: '#48bb78' }}>
            {stats.openCases}
          </div>
        </div>

        {/* Closed Cases */}
        <div style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '20px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ fontSize: '0.85em', color: '#718096', marginBottom: '8px', fontWeight: '600' }}>
            CLOSED CASES
          </div>
          <div style={{ fontSize: '2em', fontWeight: '700', color: '#718096' }}>
            {stats.closedCases}
          </div>
        </div>

        {/* Flagged Cases */}
        <div style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '20px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ fontSize: '0.85em', color: '#718096', marginBottom: '8px', fontWeight: '600' }}>
            FLAGGED
          </div>
          <div style={{ fontSize: '2em', fontWeight: '700', color: '#f56565' }}>
            {stats.flaggedCases}
          </div>
        </div>

        {/* Total Documents */}
        <div style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '20px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ fontSize: '0.85em', color: '#718096', marginBottom: '8px', fontWeight: '600' }}>
            TOTAL DOCUMENTS
          </div>
          <div style={{ fontSize: '2em', fontWeight: '700', color: '#2d3748' }}>
            {stats.totalDocuments}
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
        gap: '20px',
        marginBottom: '32px'
      }}>
        {/* Case Status Chart */}
        {Object.keys(stats.casesByStatus).length > 0 && (
          <div style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}>
            <h4 style={{ margin: '0 0 16px 0', color: '#2d3748' }}>📊 Cases by Status</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {Object.entries(stats.casesByStatus).map(([status, count]) => {
                const percentage = (count / stats.totalCases * 100).toFixed(1);
                return (
                  <div key={status}>
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      marginBottom: '6px',
                      fontSize: '0.9em'
                    }}>
                      <span style={{ fontWeight: '600', color: '#2d3748', textTransform: 'capitalize' }}>
                        {status}
                      </span>
                      <span style={{ color: '#718096' }}>
                        {count} ({percentage}%)
                      </span>
                    </div>
                    <div style={{
                      width: '100%',
                      height: '8px',
                      background: '#edf2f7',
                      borderRadius: '4px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${percentage}%`,
                        height: '100%',
                        background: getStatusColor(status),
                        transition: 'width 0.3s'
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Case Disposition Chart */}
        {Object.keys(stats.casesByDisposition).length > 0 && (
          <div style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}>
            <h4 style={{ margin: '0 0 16px 0', color: '#2d3748' }}>⚖️ Cases by Disposition</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {Object.entries(stats.casesByDisposition).map(([disposition, count]) => {
                const percentage = (count / stats.totalCases * 100).toFixed(1);
                return (
                  <div key={disposition}>
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      marginBottom: '6px',
                      fontSize: '0.9em'
                    }}>
                      <span style={{ fontWeight: '600', color: '#2d3748', textTransform: 'capitalize' }}>
                        {disposition}
                      </span>
                      <span style={{ color: '#718096' }}>
                        {count} ({percentage}%)
                      </span>
                    </div>
                    <div style={{
                      width: '100%',
                      height: '8px',
                      background: '#edf2f7',
                      borderRadius: '4px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${percentage}%`,
                        height: '100%',
                        background: getDispositionColor(disposition),
                        transition: 'width 0.3s'
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Document Types Chart */}
        {Object.keys(stats.documentsByType).length > 0 && (
          <div style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}>
            <h4 style={{ margin: '0 0 16px 0', color: '#2d3748' }}>📄 Documents by Type</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {Object.entries(stats.documentsByType)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 6)
                .map(([type, count]) => {
                  const percentage = (count / stats.totalDocuments * 100).toFixed(1);
                  return (
                    <div key={type}>
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        marginBottom: '6px',
                        fontSize: '0.9em'
                      }}>
                        <span style={{ fontWeight: '600', color: '#2d3748' }}>
                          {type}
                        </span>
                        <span style={{ color: '#718096' }}>
                          {count} ({percentage}%)
                        </span>
                      </div>
                      <div style={{
                        width: '100%',
                        height: '8px',
                        background: '#edf2f7',
                        borderRadius: '4px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${percentage}%`,
                          height: '100%',
                          background: '#4299e1',
                          transition: 'width 0.3s'
                        }} />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>

      {/* Cases List */}
      <div style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '20px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        <h3 style={{ margin: '0 0 20px 0', color: '#2d3748' }}>Cases</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {cases.map(c => (
            <div 
              key={c.id} 
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                transition: 'all 0.2s',
                cursor: 'pointer'
              }}
              onClick={() => onOpenCase(c.id)}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#4299e1';
                e.currentTarget.style.background = '#f7fafc';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e2e8f0';
                e.currentTarget.style.background = '#fff';
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ marginBottom: '8px' }}>
                  <span style={{ fontSize: '1.1em', fontWeight: '600', color: '#2d3748' }}>
                    {c.name}
                  </span>
                  <span style={{ 
                    marginLeft: '8px', 
                    fontSize: '0.9em', 
                    color: '#718096',
                    fontFamily: 'monospace'
                  }}>
                    #{c.number}
                  </span>
                </div>
                <div style={{ 
                  display: 'flex', 
                  gap: '16px', 
                  fontSize: '0.9em',
                  color: '#4a5568',
                  flexWrap: 'wrap'
                }}>
                  <span>
                    <span style={{ fontWeight: '600' }}>Status:</span>{' '}
                    <span style={{
                      padding: '2px 8px',
                      background: getStatusColor(c.status) + '20',
                      color: getStatusColor(c.status),
                      borderRadius: '4px',
                      fontWeight: '600',
                      textTransform: 'capitalize'
                    }}>
                      {c.status}
                    </span>
                  </span>
                  {c.disposition && (
                    <span>
                      <span style={{ fontWeight: '600' }}>Disposition:</span>{' '}
                      <span style={{
                        padding: '2px 8px',
                        background: getDispositionColor(c.disposition) + '20',
                        color: getDispositionColor(c.disposition),
                        borderRadius: '4px',
                        fontWeight: '600',
                        textTransform: 'capitalize'
                      }}>
                        {c.disposition}
                      </span>
                    </span>
                  )}
                  <span>
                    <span style={{ fontWeight: '600' }}>Assigned:</span> {c.assigned_to}
                  </span>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenCase(c.id);
                }}
                style={{
                  padding: '8px 16px',
                  background: '#2166e8',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '0.9em'
                }}
              >
                Open →
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Data Retention Panel (Managers Only) */}
      {user && canAccess(user.role, 'read', 'retention') && retentionStats && (
        <div style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '20px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          marginTop: '20px'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '20px'
          }}>
            <h3 style={{ margin: 0, color: '#2d3748' }}>
              📅 Data Retention Management
            </h3>
            <button
              onClick={() => setShowRetentionPanel(!showRetentionPanel)}
              style={{
                padding: '8px 16px',
                background: '#805ad5',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              {showRetentionPanel ? 'Hide Details' : 'Show Details'}
            </button>
          </div>

          {/* Retention Stats Summary */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px',
            marginBottom: showRetentionPanel ? '20px' : '0'
          }}>
            <div style={{
              padding: '12px',
              background: '#fff5f5',
              border: '1px solid #feb2b2',
              borderRadius: '6px'
            }}>
              <div style={{ fontSize: '0.75em', color: '#742a2a', fontWeight: '600', marginBottom: '4px' }}>
                EXPIRED CASES
              </div>
              <div style={{ fontSize: '1.5em', fontWeight: '700', color: '#c53030' }}>
                {retentionStats.expired_count || 0}
              </div>
            </div>

            <div style={{
              padding: '12px',
              background: '#fffaf0',
              border: '1px solid #fbd38d',
              borderRadius: '6px'
            }}>
              <div style={{ fontSize: '0.75em', color: '#7c2d12', fontWeight: '600', marginBottom: '4px' }}>
                APPROACHING (90 DAYS)
              </div>
              <div style={{ fontSize: '1.5em', fontWeight: '700', color: '#c05621' }}>
                {retentionStats.approaching_count || 0}
              </div>
            </div>

            <div style={{
              padding: '12px',
              background: '#e6fffa',
              border: '1px solid #81e6d9',
              borderRadius: '6px'
            }}>
              <div style={{ fontSize: '0.75em', color: '#234e52', fontWeight: '600', marginBottom: '4px' }}>
                LEGAL HOLD
              </div>
              <div style={{ fontSize: '1.5em', fontWeight: '700', color: '#2c7a7b' }}>
                {retentionStats.legal_hold_count || 0}
              </div>
            </div>

            <div style={{
              padding: '12px',
              background: '#f0fff4',
              border: '1px solid #9ae6b4',
              borderRadius: '6px'
            }}>
              <div style={{ fontSize: '0.75em', color: '#22543d', fontWeight: '600', marginBottom: '4px' }}>
                DELETED CASES
              </div>
              <div style={{ fontSize: '1.5em', fontWeight: '700', color: '#2f855a' }}>
                {retentionStats.deleted_count || 0}
              </div>
            </div>
          </div>

          {/* Detailed Panel */}
          {showRetentionPanel && approachingCases.length > 0 && (
            <div style={{
              marginTop: '20px',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              overflow: 'hidden'
            }}>
              <div style={{
                background: '#f7fafc',
                padding: '12px 16px',
                borderBottom: '1px solid #e2e8f0',
                fontWeight: '600',
                color: '#2d3748'
              }}>
                Cases Approaching Retention Deadline
              </div>
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {approachingCases.map(c => (
                  <div
                    key={c.id}
                    style={{
                      padding: '16px',
                      borderBottom: '1px solid #e2e8f0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: c.days_remaining <= 30 ? '#fff5f5' : '#fff'
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '600', color: '#2d3748', marginBottom: '4px' }}>
                        {c.case_name || c.name}
                      </div>
                      <div style={{ fontSize: '0.85em', color: '#718096' }}>
                        Case #{c.case_number || c.number} • Retention Date: {new Date(c.retention_date).toLocaleDateString()}
                      </div>
                    </div>
                    <div style={{
                      padding: '8px 16px',
                      background: c.days_remaining <= 30 ? '#feb2b2' : '#fbd38d',
                      color: c.days_remaining <= 30 ? '#742a2a' : '#7c2d12',
                      borderRadius: '6px',
                      fontWeight: '700',
                      fontSize: '0.9em',
                      marginRight: '12px'
                    }}>
                      {c.days_remaining} days
                    </div>
                    <button
                      onClick={() => onOpenCase(c.id)}
                      style={{
                        padding: '8px 16px',
                        background: '#2166e8',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '0.85em'
                      }}
                    >
                      Manage
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showRetentionPanel && approachingCases.length === 0 && (
            <div style={{
              marginTop: '20px',
              padding: '20px',
              textAlign: 'center',
              color: '#718096',
              background: '#f7fafc',
              borderRadius: '8px'
            }}>
              ✅ No cases approaching retention deadline in the next 90 days
            </div>
          )}
        </div>
      )}
    </div>
  );
}
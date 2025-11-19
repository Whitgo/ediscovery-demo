import React, { useState } from "react";

export default function AdvancedDocumentSearch({ caseId, onResults, onError }) {
  const [filters, setFilters] = useState({
    legal_category: '',
    evidence_type: '',
    witness_name: '',
    case_number: '',
    tags: [],
    name_keyword: '',
    file_type: '',
    size_min: '',
    size_max: '',
    date_from: '',
    date_to: '',
    sort_by: 'created_at',
    sort_order: 'desc'
  });
  const [tagInput, setTagInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [options, setOptions] = useState({
    legalCategories: [],
    evidenceTypes: []
  });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  React.useEffect(() => {
    loadOptions();
  }, []);

  const loadOptions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `/api/tags/metadata/options`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      if (!response.ok) {
        throw new Error('Failed to load search options');
      }
      
      const data = await response.json();
      setOptions(data);
    } catch (err) {
      console.error('Failed to load options:', err);
      setError('Unable to load search filters');
    }
  };

  const addTag = () => {
    const trimmed = tagInput.trim().toLowerCase();
    if (trimmed && !filters.tags.includes(trimmed)) {
      setFilters({
        ...filters,
        tags: [...filters.tags, trimmed]
      });
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove) => {
    setFilters({
      ...filters,
      tags: filters.tags.filter(tag => tag !== tagToRemove)
    });
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    
    // Validate at least one filter is selected
    const hasFilters = filters.legal_category || filters.evidence_type || 
                      filters.witness_name || filters.case_number || 
                      filters.tags.length > 0 || filters.name_keyword ||
                      filters.file_type || filters.size_min || filters.size_max ||
                      filters.date_from || filters.date_to;
    
    if (!hasFilters) {
      setError('Please select at least one search filter');
      return;
    }

    setSearching(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `/api/tags/case/${caseId}/documents/search`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            legal_category: filters.legal_category || undefined,
            evidence_type: filters.evidence_type || undefined,
            witness_name: filters.witness_name || undefined,
            case_number: filters.case_number || undefined,
            tags: filters.tags.length > 0 ? filters.tags : undefined,
            name_keyword: filters.name_keyword || undefined,
            file_type: filters.file_type || undefined,
            size_min: filters.size_min ? parseInt(filters.size_min) * 1024 : undefined,
            size_max: filters.size_max ? parseInt(filters.size_max) * 1024 : undefined,
            date_from: filters.date_from || undefined,
            date_to: filters.date_to || undefined,
            sort_by: filters.sort_by,
            sort_order: filters.sort_order
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Search failed (${response.status})`);
      }

      const data = await response.json();
      
      if (onResults) {
        onResults(data.documents, data.pagination);
      }

      if (data.documents.length === 0) {
        setError('No documents match your search criteria');
      }
    } catch (err) {
      console.error('Search error:', err);
      const errorMessage = err.message || 'Failed to search documents';
      setError(errorMessage);
      
      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setSearching(false);
    }
  };

  const handleClear = () => {
    setFilters({
      legal_category: '',
      evidence_type: '',
      witness_name: '',
      case_number: '',
      tags: [],
      name_keyword: '',
      file_type: '',
      size_min: '',
      size_max: '',
      date_from: '',
      date_to: '',
      sort_by: 'created_at',
      sort_order: 'desc'
    });
    setError('');
    setTagInput('');
    if (onResults) {
      onResults([], null);
    }
  };

  return (
    <form onSubmit={handleSearch} style={{
      padding: '20px',
      background: '#f8f9fc',
      borderRadius: '8px',
      border: '1px solid #e2e8f0'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h4 style={{ margin: 0, color: '#2d3748' }}>
          🔍 Advanced Document Search
        </h4>
        {/* Active Filter Count */}
        {(() => {
          const activeCount = [
            filters.legal_category,
            filters.evidence_type,
            filters.witness_name,
            filters.case_number,
            filters.name_keyword,
            filters.file_type,
            filters.size_min,
            filters.size_max,
            filters.date_from,
            filters.date_to,
            filters.tags.length > 0
          ].filter(Boolean).length;
          
          return activeCount > 0 ? (
            <span style={{
              padding: '4px 12px',
              background: '#4299e1',
              color: '#fff',
              borderRadius: '12px',
              fontSize: '0.85em',
              fontWeight: '600'
            }}>
              {activeCount} filter{activeCount !== 1 ? 's' : ''} active
            </span>
          ) : null;
        })()}
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

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '12px',
        marginBottom: '16px'
      }}>
        {/* Legal Category */}
        <label style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontWeight: '600', marginBottom: '6px', fontSize: '0.9em', color: '#2d3748' }}>
            Legal Category
          </span>
          <select
            value={filters.legal_category}
            onChange={(e) => setFilters({ ...filters, legal_category: e.target.value })}
            disabled={searching}
            style={{
              padding: '8px',
              border: '1px solid #cbd5e0',
              borderRadius: '6px',
              fontSize: '0.95em',
              background: '#fff'
            }}
          >
            <option value="">Any</option>
            {options.legalCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </label>

        {/* Evidence Type */}
        <label style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontWeight: '600', marginBottom: '6px', fontSize: '0.9em', color: '#2d3748' }}>
            Evidence Type
          </span>
          <select
            value={filters.evidence_type}
            onChange={(e) => setFilters({ ...filters, evidence_type: e.target.value })}
            disabled={searching}
            style={{
              padding: '8px',
              border: '1px solid #cbd5e0',
              borderRadius: '6px',
              fontSize: '0.95em',
              background: '#fff'
            }}
          >
            <option value="">Any</option>
            {options.evidenceTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </label>

        {/* Case Number */}
        <label style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontWeight: '600', marginBottom: '6px', fontSize: '0.9em', color: '#2d3748' }}>
            Case Number
          </span>
          <input
            type="text"
            value={filters.case_number}
            onChange={(e) => setFilters({ ...filters, case_number: e.target.value })}
            placeholder="Search by case #"
            disabled={searching}
            style={{
              padding: '8px',
              border: '1px solid #cbd5e0',
              borderRadius: '6px',
              fontSize: '0.95em'
            }}
          />
        </label>

        {/* Witness Name */}
        <label style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontWeight: '600', marginBottom: '6px', fontSize: '0.9em', color: '#2d3748' }}>
            Witness Name
          </span>
          <input
            type="text"
            value={filters.witness_name}
            onChange={(e) => setFilters({ ...filters, witness_name: e.target.value })}
            placeholder="Search by witness"
            disabled={searching}
            style={{
              padding: '8px',
              border: '1px solid #cbd5e0',
              borderRadius: '6px',
              fontSize: '0.95em'
            }}
          />
        </label>

        {/* Document Name/Keyword */}
        <label style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontWeight: '600', marginBottom: '6px', fontSize: '0.9em', color: '#2d3748' }}>
            Document Name
          </span>
          <input
            type="text"
            value={filters.name_keyword}
            onChange={(e) => setFilters({ ...filters, name_keyword: e.target.value })}
            placeholder="Search by name or keyword"
            disabled={searching}
            style={{
              padding: '8px',
              border: '1px solid #cbd5e0',
              borderRadius: '6px',
              fontSize: '0.95em'
            }}
          />
        </label>

        {/* File Type */}
        <label style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontWeight: '600', marginBottom: '6px', fontSize: '0.9em', color: '#2d3748' }}>
            File Type
          </span>
          <select
            value={filters.file_type}
            onChange={(e) => setFilters({ ...filters, file_type: e.target.value })}
            disabled={searching}
            style={{
              padding: '8px',
              border: '1px solid #cbd5e0',
              borderRadius: '6px',
              fontSize: '0.95em',
              background: '#fff'
            }}
          >
            <option value="">Any Type</option>
            <option value="application/pdf">PDF</option>
            <option value="application/msword">DOC</option>
            <option value="application/vnd.openxmlformats-officedocument.wordprocessingml.document">DOCX</option>
            <option value="text/plain">TXT</option>
            <option value="application/vnd.ms-excel">XLS</option>
            <option value="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet">XLSX</option>
            <option value="image/jpeg">JPG/JPEG</option>
            <option value="image/png">PNG</option>
            <option value="image/tiff">TIFF</option>
            <option value="application/zip">ZIP</option>
            <option value="message/rfc822">EML</option>
          </select>
        </label>
      </div>

      {/* Advanced Filters Toggle */}
      <div style={{ marginBottom: '12px' }}>
        <button
          type="button"
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          style={{
            background: 'none',
            border: 'none',
            color: '#2166e8',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '0.9em',
            padding: '0',
            textDecoration: 'underline'
          }}
        >
          {showAdvancedFilters ? '▼ Hide' : '▶ Show'} Advanced Filters (Date, Size, Sort)
        </button>
      </div>

      {/* Advanced Filters Section */}
      {showAdvancedFilters && (
        <div style={{
          background: '#fff',
          border: '1px solid #cbd5e0',
          borderRadius: '6px',
          padding: '16px',
          marginBottom: '16px'
        }}>
          <h5 style={{ marginTop: 0, marginBottom: '12px', color: '#2d3748' }}>
            Advanced Filters
          </h5>

          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: '12px',
            marginBottom: '12px'
          }}>
            {/* Date Range */}
            <label style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: '600', marginBottom: '6px', fontSize: '0.9em', color: '#2d3748' }}>
                Upload Date From
              </span>
              <input
                type="date"
                value={filters.date_from}
                onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
                disabled={searching}
                style={{
                  padding: '8px',
                  border: '1px solid #cbd5e0',
                  borderRadius: '6px',
                  fontSize: '0.95em'
                }}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: '600', marginBottom: '6px', fontSize: '0.9em', color: '#2d3748' }}>
                Upload Date To
              </span>
              <input
                type="date"
                value={filters.date_to}
                onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
                disabled={searching}
                style={{
                  padding: '8px',
                  border: '1px solid #cbd5e0',
                  borderRadius: '6px',
                  fontSize: '0.95em'
                }}
              />
            </label>

            {/* File Size Range */}
            <label style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: '600', marginBottom: '6px', fontSize: '0.9em', color: '#2d3748' }}>
                Min Size (KB)
              </span>
              <input
                type="number"
                value={filters.size_min}
                onChange={(e) => setFilters({ ...filters, size_min: e.target.value })}
                placeholder="e.g., 100"
                min="0"
                disabled={searching}
                style={{
                  padding: '8px',
                  border: '1px solid #cbd5e0',
                  borderRadius: '6px',
                  fontSize: '0.95em'
                }}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: '600', marginBottom: '6px', fontSize: '0.9em', color: '#2d3748' }}>
                Max Size (KB)
              </span>
              <input
                type="number"
                value={filters.size_max}
                onChange={(e) => setFilters({ ...filters, size_max: e.target.value })}
                placeholder="e.g., 5000"
                min="0"
                disabled={searching}
                style={{
                  padding: '8px',
                  border: '1px solid #cbd5e0',
                  borderRadius: '6px',
                  fontSize: '0.95em'
                }}
              />
            </label>

            {/* Sort Options */}
            <label style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: '600', marginBottom: '6px', fontSize: '0.9em', color: '#2d3748' }}>
                Sort By
              </span>
              <select
                value={filters.sort_by}
                onChange={(e) => setFilters({ ...filters, sort_by: e.target.value })}
                disabled={searching}
                style={{
                  padding: '8px',
                  border: '1px solid #cbd5e0',
                  borderRadius: '6px',
                  fontSize: '0.95em',
                  background: '#fff'
                }}
              >
                <option value="created_at">Upload Date</option>
                <option value="name">Name</option>
                <option value="size">File Size</option>
                <option value="updated_at">Last Modified</option>
                <option value="legal_category">Legal Category</option>
              </select>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: '600', marginBottom: '6px', fontSize: '0.9em', color: '#2d3748' }}>
                Sort Order
              </span>
              <select
                value={filters.sort_order}
                onChange={(e) => setFilters({ ...filters, sort_order: e.target.value })}
                disabled={searching}
                style={{
                  padding: '8px',
                  border: '1px solid #cbd5e0',
                  borderRadius: '6px',
                  fontSize: '0.95em',
                  background: '#fff'
                }}
              >
                <option value="desc">Newest First</option>
                <option value="asc">Oldest First</option>
              </select>
            </label>
          </div>
        </div>
      )}

      {/* Tags */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ fontWeight: '600', fontSize: '0.9em', color: '#2d3748', display: 'block', marginBottom: '6px' }}>
          Tags
        </label>
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
            placeholder="Add tag to search..."
            disabled={searching}
            style={{
              flex: 1,
              padding: '8px',
              border: '1px solid #cbd5e0',
              borderRadius: '6px',
              fontSize: '0.95em'
            }}
          />
          <button
            type="button"
            onClick={addTag}
            disabled={searching || !tagInput.trim()}
            style={{
              padding: '8px 16px',
              background: tagInput.trim() ? '#4299e1' : '#cbd5e0',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: tagInput.trim() ? 'pointer' : 'not-allowed',
              fontSize: '0.9em',
              fontWeight: '600'
            }}
          >
            Add
          </button>
        </div>
        
        {/* Tag chips */}
        {filters.tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {filters.tags.map(tag => (
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
                  disabled={searching}
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

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={handleClear}
          disabled={searching}
          style={{
            padding: '10px 20px',
            border: '1px solid #cbd5e0',
            borderRadius: '6px',
            background: '#fff',
            color: '#4a5568',
            cursor: searching ? 'not-allowed' : 'pointer',
            fontSize: '0.95em',
            fontWeight: '600'
          }}
        >
          Clear
        </button>
        <button
          type="submit"
          disabled={searching}
          style={{
            padding: '10px 20px',
            border: 'none',
            borderRadius: '6px',
            background: searching ? '#cbd5e0' : '#2166e8',
            color: '#fff',
            cursor: searching ? 'not-allowed' : 'pointer',
            fontSize: '0.95em',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          {searching && (
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
          {searching ? 'Searching...' : '🔍 Search'}
        </button>
      </div>
    </form>
  );
}

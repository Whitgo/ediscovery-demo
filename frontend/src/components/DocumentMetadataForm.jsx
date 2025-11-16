import React, { useState, useEffect } from "react";

export default function DocumentMetadataForm({ 
  caseId, 
  docId = null, 
  initialData = {}, 
  onSave, 
  onCancel,
  inline = false 
}) {
  const [metadata, setMetadata] = useState({
    case_number: initialData.case_number || '',
    witness_name: initialData.witness_name || '',
    evidence_type: initialData.evidence_type || '',
    legal_category: initialData.legal_category || '',
    tags: initialData.tags || []
  });
  
  const [tagInput, setTagInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [options, setOptions] = useState({
    legalCategories: [],
    evidenceTypes: []
  });
  const [suggestions, setSuggestions] = useState({
    tags: [],
    witnesses: []
  });

  useEffect(() => {
    loadOptions();
    loadSuggestions();
  }, [caseId]);

  const loadOptions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.REACT_APP_API_URL || 'http://localhost:4000'}/api/tags/metadata/options`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
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

  const addTag = () => {
    const trimmed = tagInput.trim().toLowerCase();
    if (trimmed && !metadata.tags.includes(trimmed)) {
      setMetadata({
        ...metadata,
        tags: [...metadata.tags, trimmed]
      });
      setTagInput('');
    } else if (metadata.tags.includes(trimmed)) {
      setError('Tag already added');
      setTimeout(() => setError(''), 2000);
    }
  };

  const removeTag = (tagToRemove) => {
    setMetadata({
      ...metadata,
      tags: metadata.tags.filter(tag => tag !== tagToRemove)
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const url = docId
        ? `${process.env.REACT_APP_API_URL || 'http://localhost:4000'}/api/tags/case/${caseId}/documents/${docId}/metadata`
        : null;

      if (url) {
        const response = await fetch(url, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(metadata)
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to update metadata');
        }
      }

      onSave(metadata);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formStyle = inline ? {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '12px',
    padding: '16px',
    background: '#f8f9fc',
    borderRadius: '8px',
    marginTop: '8px'
  } : {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  };

  return (
    <form onSubmit={handleSubmit} style={formStyle}>
      {error && (
        <div style={{
          gridColumn: '1 / -1',
          padding: '12px',
          background: '#fff5f5',
          border: '1px solid #fc8181',
          borderRadius: '6px',
          color: '#c53030',
          fontSize: '0.9em'
        }}>
          {error}
        </div>
      )}

      {/* Legal Category */}
      <label style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontWeight: '600', marginBottom: '6px', fontSize: '0.9em', color: '#2d3748' }}>
          Legal Category
        </span>
        <select
          value={metadata.legal_category}
          onChange={(e) => setMetadata({ ...metadata, legal_category: e.target.value })}
          disabled={loading}
          style={{
            padding: '8px',
            border: '1px solid #cbd5e0',
            borderRadius: '6px',
            fontSize: '0.95em'
          }}
        >
          <option value="">Select category...</option>
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
          value={metadata.evidence_type}
          onChange={(e) => setMetadata({ ...metadata, evidence_type: e.target.value })}
          disabled={loading}
          style={{
            padding: '8px',
            border: '1px solid #cbd5e0',
            borderRadius: '6px',
            fontSize: '0.95em'
          }}
        >
          <option value="">Select type...</option>
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
          value={metadata.case_number}
          onChange={(e) => setMetadata({ ...metadata, case_number: e.target.value })}
          placeholder="e.g., 2025-CV-12345"
          disabled={loading}
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
          list="witness-suggestions"
          value={metadata.witness_name}
          onChange={(e) => setMetadata({ ...metadata, witness_name: e.target.value })}
          placeholder="Enter witness name"
          disabled={loading}
          style={{
            padding: '8px',
            border: '1px solid #cbd5e0',
            borderRadius: '6px',
            fontSize: '0.95em'
          }}
        />
        <datalist id="witness-suggestions">
          {suggestions.witnesses.map(witness => (
            <option key={witness} value={witness} />
          ))}
        </datalist>
      </label>

      {/* Tags Section */}
      <div style={{ gridColumn: inline ? '1 / -1' : 'auto' }}>
        <label style={{ fontWeight: '600', fontSize: '0.9em', color: '#2d3748', display: 'block', marginBottom: '6px' }}>
          Tags
        </label>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <input
            type="text"
            list="tag-suggestions"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addTag();
              }
            }}
            placeholder="Add tag..."
            disabled={loading}
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
            disabled={loading}
            style={{
              padding: '8px 16px',
              background: '#4299e1',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.9em',
              fontWeight: '600'
            }}
          >
            Add
          </button>
        </div>
        <datalist id="tag-suggestions">
          {suggestions.tags.map(tag => (
            <option key={tag} value={tag} />
          ))}
        </datalist>
        
        {/* Tag chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {metadata.tags.map(tag => (
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
                disabled={loading}
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
      </div>

      {/* Action Buttons */}
      <div style={{ 
        gridColumn: inline ? '1 / -1' : 'auto',
        display: 'flex', 
        gap: '8px', 
        justifyContent: 'flex-end',
        marginTop: inline ? '8px' : '0'
      }}>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            style={{
              padding: '8px 16px',
              border: '1px solid #cbd5e0',
              borderRadius: '6px',
              background: '#fff',
              color: '#4a5568',
              cursor: 'pointer',
              fontSize: '0.9em',
              fontWeight: '600'
            }}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '8px 16px',
            border: 'none',
            borderRadius: '6px',
            background: loading ? '#cbd5e0' : '#2166e8',
            color: '#fff',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '0.9em',
            fontWeight: '600'
          }}
        >
          {loading ? 'Saving...' : 'Save Metadata'}
        </button>
      </div>
    </form>
  );
}

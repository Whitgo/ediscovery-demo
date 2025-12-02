import React, { useState, useEffect } from "react";
import { apiGet } from "../utils/api";

export default function AdvancedSearch({ onResults, onClose }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({
    caseId: "",
    fileType: "",
    custodian: "",
    dateFrom: "",
    dateTo: "",
    tags: "",
    minSize: "",
    maxSize: ""
  });
  const [booleanMode, setBooleanMode] = useState(true);
  const [proximityDistance, setProximityDistance] = useState(5);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [cases, setCases] = useState([]);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    loadCases();
  }, []);

  const loadCases = async () => {
    try {
      const data = await apiGet("/cases");
      setCases(data);
    } catch (error) {
      console.error("Failed to load cases:", error);
    }
  };

  const parseBoolean = (query) => {
    // Parse Boolean operators: AND, OR, NOT, parentheses
    // Convert to search terms array
    const terms = [];
    const parts = query.split(/\s+(AND|OR|NOT)\s+/i);
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].trim();
      if (part && !['AND', 'OR', 'NOT'].includes(part.toUpperCase())) {
        // Remove quotes and add to terms
        terms.push(part.replace(/^["']|["']$/g, ''));
      }
    }
    
    return terms;
  };

  const parseProximity = (query) => {
    // Parse proximity operators: NEAR/n, WITHIN/n
    // Example: "contract NEAR/5 agreement"
    const proximityRegex = /(["']?[\w\s]+["']?)\s+(NEAR|WITHIN)\/(\d+)\s+(["']?[\w\s]+["']?)/gi;
    const matches = [];
    let match;
    
    while ((match = proximityRegex.exec(query)) !== null) {
      matches.push({
        term1: match[1].replace(/^["']|["']$/g, ''),
        operator: match[2].toUpperCase(),
        distance: parseInt(match[3]),
        term2: match[4].replace(/^["']|["']$/g, '')
      });
    }
    
    return matches;
  };

  const handleSearch = async () => {
    setSearching(true);
    
    try {
      // Parse query based on mode
      let searchTerms = [];
      let proximityTerms = [];
      
      if (booleanMode) {
        searchTerms = parseBoolean(searchQuery);
      }
      
      proximityTerms = parseProximity(searchQuery);
      
      // If no Boolean/proximity operators, treat as simple search
      if (searchTerms.length === 0 && proximityTerms.length === 0 && searchQuery.trim()) {
        searchTerms = [searchQuery.trim()];
      }
      
      // Build search parameters
      const params = new URLSearchParams();
      
      if (searchTerms.length > 0) {
        params.append('q', searchTerms.join(' '));
      }
      
      if (filters.caseId) params.append('case_id', filters.caseId);
      if (filters.fileType) params.append('file_type', filters.fileType);
      if (filters.custodian) params.append('custodian', filters.custodian);
      if (filters.dateFrom) params.append('date_from', filters.dateFrom);
      if (filters.dateTo) params.append('date_to', filters.dateTo);
      if (filters.tags) params.append('tags', filters.tags);
      if (filters.minSize) params.append('min_size', filters.minSize);
      if (filters.maxSize) params.append('max_size', filters.maxSize);
      
      // Make API call to backend search endpoint
      const response = await apiGet(`/documents/search?${params.toString()}`);
      
      // Apply client-side proximity filtering if needed
      let filteredResults = response.documents || response || [];
      
      if (proximityTerms.length > 0) {
        filteredResults = filteredResults.filter(doc => {
          return proximityTerms.some(prox => {
            const text = (doc.filename + ' ' + (doc.content || '')).toLowerCase();
            const term1Lower = prox.term1.toLowerCase();
            const term2Lower = prox.term2.toLowerCase();
            
            const term1Idx = text.indexOf(term1Lower);
            const term2Idx = text.indexOf(term2Lower);
            
            if (term1Idx === -1 || term2Idx === -1) return false;
            
            const distance = Math.abs(term2Idx - term1Idx);
            return distance <= (prox.distance * 10); // Approximate word distance
          });
        });
      }
      
      setResults(filteredResults);
      if (onResults) onResults(filteredResults);
      
    } catch (error) {
      console.error("Search failed:", error);
      alert("Search failed: " + error.message);
    } finally {
      setSearching(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-800">🔍 Advanced Search</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        <div className="p-6">
          {/* Search Query Input */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-semibold text-gray-700">
                Search Query
              </label>
              <button
                onClick={() => setShowHelp(!showHelp)}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                {showHelp ? 'Hide' : 'Show'} Syntax Help
              </button>
            </div>
            
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder='e.g., contract AND agreement OR "legal document" NOT draft'
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            
            {/* Syntax Help */}
            {showHelp && (
              <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                <h4 className="font-semibold text-blue-900 mb-2">Search Syntax:</h4>
                <ul className="space-y-1 text-gray-700">
                  <li><strong>AND</strong> - Both terms must be present: <code className="bg-white px-2 py-0.5 rounded">contract AND agreement</code></li>
                  <li><strong>OR</strong> - Either term can be present: <code className="bg-white px-2 py-0.5 rounded">email OR message</code></li>
                  <li><strong>NOT</strong> - Exclude documents with term: <code className="bg-white px-2 py-0.5 rounded">document NOT draft</code></li>
                  <li><strong>Quotes</strong> - Exact phrase: <code className="bg-white px-2 py-0.5 rounded">"legal agreement"</code></li>
                  <li><strong>NEAR/n</strong> - Terms within n words: <code className="bg-white px-2 py-0.5 rounded">contract NEAR/5 signature</code></li>
                  <li><strong>WITHIN/n</strong> - Same as NEAR: <code className="bg-white px-2 py-0.5 rounded">party WITHIN/10 liable</code></li>
                  <li><strong>Parentheses</strong> - Group terms: <code className="bg-white px-2 py-0.5 rounded">(contract OR agreement) AND signed</code></li>
                </ul>
              </div>
            )}
          </div>

          {/* Options */}
          <div className="flex gap-4 mb-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={booleanMode}
                onChange={(e) => setBooleanMode(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-sm font-medium text-gray-700">Enable Boolean Search</span>
            </label>
          </div>

          {/* Metadata Filters */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">📋 Metadata Filters</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Case Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Case
                </label>
                <select
                  value={filters.caseId}
                  onChange={(e) => handleFilterChange('caseId', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Cases</option>
                  {cases.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} (#{c.number})
                    </option>
                  ))}
                </select>
              </div>

              {/* File Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  File Type
                </label>
                <select
                  value={filters.fileType}
                  onChange={(e) => handleFilterChange('fileType', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Types</option>
                  <option value="pdf">PDF</option>
                  <option value="doc">Word Document</option>
                  <option value="xls">Excel</option>
                  <option value="ppt">PowerPoint</option>
                  <option value="txt">Text</option>
                  <option value="msg">Email (MSG)</option>
                  <option value="eml">Email (EML)</option>
                  <option value="jpg">Image (JPG)</option>
                  <option value="png">Image (PNG)</option>
                  <option value="mp4">Video (MP4)</option>
                  <option value="mov">Video (MOV)</option>
                </select>
              </div>

              {/* Custodian */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Custodian
                </label>
                <input
                  type="text"
                  value={filters.custodian}
                  onChange={(e) => handleFilterChange('custodian', e.target.value)}
                  placeholder="Enter custodian name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={filters.tags}
                  onChange={(e) => handleFilterChange('tags', e.target.value)}
                  placeholder="e.g., privileged, confidential"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Date From */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date From
                </label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Date To */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date To
                </label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* File Size Min */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Min Size (MB)
                </label>
                <input
                  type="number"
                  value={filters.minSize}
                  onChange={(e) => handleFilterChange('minSize', e.target.value)}
                  placeholder="0"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* File Size Max */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Size (MB)
                </label>
                <input
                  type="number"
                  value={filters.maxSize}
                  onChange={(e) => handleFilterChange('maxSize', e.target.value)}
                  placeholder="1000"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Search Results */}
          {results.length > 0 && (
            <div className="border-t pt-6 mt-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                📊 Results ({results.length} documents)
              </h3>
              <div className="max-h-96 overflow-y-auto space-y-2">
                {results.map((doc, idx) => (
                  <div
                    key={doc.id || idx}
                    className="p-4 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
                  >
                    <div className="font-semibold text-gray-800">{doc.filename}</div>
                    <div className="text-sm text-gray-600 mt-1">
                      {doc.file_type && <span className="mr-3">Type: {doc.file_type}</span>}
                      {doc.file_size && <span className="mr-3">Size: {(doc.file_size / 1024 / 1024).toFixed(2)} MB</span>}
                      {doc.upload_date && <span>Date: {new Date(doc.upload_date).toLocaleDateString()}</span>}
                    </div>
                    {doc.tags && doc.tags.length > 0 && (
                      <div className="mt-2 flex gap-2 flex-wrap">
                        {doc.tags.map((tag, i) => (
                          <span key={i} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 mt-6 pt-6 border-t">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleSearch}
              disabled={searching || !searchQuery.trim()}
              className={`px-6 py-2 font-semibold rounded-lg transition-colors ${
                searching || !searchQuery.trim()
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {searching ? 'Searching...' : '🔍 Search'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useRef, useEffect } from "react";
import Fuse from "fuse.js";

function highlight(text, query) {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span style={{ background:"#ffe066", fontWeight:"bold" }}>{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  );
}

export default function GlobalSearch({ cases = [], documents = [], onNavigate }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [error, setError] = useState(null);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef();

  const caseFuse = new Fuse(cases || [], {
    keys: ["name", "number", "tags", "status", "notes", "assignedTo"],
    threshold: 0.34,
  });
  const docFuse = new Fuse(documents || [], {
    keys: [
      "name", 
      "tags", 
      "category", 
      "folder", 
      "uploadedBy"
    ],
    threshold: 0.32,
  });

  useEffect(() => {
    if (!query || query.trim().length === 0) {
      setResults([]);
      setError(null);
      return;
    }

    // Minimum query length validation
    if (query.trim().length < 2) {
      setError('Please enter at least 2 characters to search');
      setResults([]);
      return;
    }

    setSearching(true);
    setError(null);

    try {
      const caseMatches = caseFuse.search(query).map(res => ({ ...res.item, type: "Case" }));
      const docMatches = docFuse.search(query).map(res => ({ ...res.item, type: "Document" }));

      const combinedResults = [
        ...caseMatches.slice(0, 8),
        ...docMatches.slice(0, 8),
      ];

      setResults(combinedResults);
      
      if (combinedResults.length === 0 && query.trim().length >= 2) {
        setError('No results found');
      }
    } catch (err) {
      console.error('Search error:', err);
      setError('An error occurred while searching');
      setResults([]);
    } finally {
      setSearching(false);
    }
    
    setActiveIdx(-1);
  }, [query, cases, documents]);

  const visible = open && (results.length > 0 || error || searching);
  function onKeyDown(e) {
    if (!visible) return;
    if (e.key === "ArrowDown") {
      setActiveIdx(i => Math.min(results.length-1, i+1));
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      setActiveIdx(i => Math.max(0, i-1));
      e.preventDefault();
    } else if (e.key === "Enter" && activeIdx > -1 && results[activeIdx]) {
      handleSelect(results[activeIdx]);
      e.preventDefault();
    } else if (e.key === "Escape") {
      setOpen(false);
      setError(null);
    }
  }

  function handleChange(e) {
    const value = e.target.value;
    setQuery(value);
    setOpen(true);
    setError(null);
  }

  function handleSelect(item) {
    setOpen(false);
    setQuery("");
    setResults([]);
    setActiveIdx(-1);
    if (onNavigate) onNavigate(item);
  }

  function onBlur() {
    setTimeout(() => setOpen(false), 170);
  }

  useEffect(() => {
    function handleClick(e) {
      if (!inputRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const grouped = results.reduce((acc, item) => {
    const type = item.type || "Other";
    acc[type] = acc[type] || [];
    acc[type].push(item);
    return acc;
  }, {});

  return (
    <div ref={inputRef} style={{ display: "inline-block", position: "relative", width: 330 }}>
      <input
        type="text"
        value={query}
        placeholder="Search cases, documents, tags..."
        style={{
          width: "100%", padding: "0.72em", borderRadius: 9, border: "1.8px solid #2968b7",
          fontSize: "1.08em", boxSizing: "border-box", background:"#fffdfa"
        }}
        onFocus={() => setOpen(true)}
        onChange={handleChange}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        spellCheck="false"
      />
      {visible && (
        <div style={{
          position: "absolute",
          left: 0, top: "102%",
          zIndex: 201,
          background: "#fff",
          boxShadow: "0 3px 20px #00215717",
          width: "100%",
          borderRadius: "0 0 9px 9px",
          padding: 0,
          margin: 0,
          maxHeight: 376,
          overflowY: "auto"
        }}>
          {searching && (
            <div style={{
              padding: "1em 1.2em", 
              color: "#4a5568",
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span style={{ 
                display: 'inline-block',
                width: '14px',
                height: '14px',
                border: '2px solid #cbd5e0',
                borderTopColor: '#2166e8',
                borderRadius: '50%',
                animation: 'spin 0.6s linear infinite'
              }} />
              Searching...
              <style>{`
                @keyframes spin {
                  to { transform: rotate(360deg); }
                }
              `}</style>
            </div>
          )}
          
          {error && !searching && (
            <div style={{
              padding: "0.7em 1.2em", 
              color: error === 'No results found' ? "#a0aec0" : "#e53e3e",
              background: error === 'No results found' ? 'transparent' : '#fff5f5',
              fontSize: '0.95em'
            }}>
              {error === 'No results found' ? '🔍 No results found' : `⚠️ ${error}`}
            </div>
          )}
          
          {!searching && !error && ["Case", "Document"].map(group => (
            grouped[group]?.length > 0 && (
              <div key={group} style={{marginBottom: 0}}>
                <div style={{fontWeight:"bold", color:"#3a55c5", fontSize:"0.97em", borderBottom:"1px solid #b9caf7", padding:"0.32em 1em 0 0.7em"}}>
                  {group}s
                </div>
                {grouped[group].map((item, idx) => (
                  <div
                    key={item.id || idx}
                    onMouseDown={() => handleSelect(item)}
                    style={{
                      padding: "0.5em 0.96em",
                      cursor: "pointer",
                      background: idx+grouped["Case"]?.length*(group==="Document"?1:0) === activeIdx ? "#f2f5ff" : "#fff",
                      color: "#27374d",
                      borderBottom: "1px solid #f3f3f3"
                    }}
                  >
                    <span style={{fontSize:"1.19em", opacity:0.79, marginRight:7}}>
                      {group === "Case" ? "🗃️" : "📄"}
                    </span>
                    <span style={{fontWeight:"bold"}}>
                      {highlight(item.name, query)}
                    </span>
                    {group === "Case" && (
                      <>
                        {item.number && <span style={{marginLeft:8, color:"#6a7893"}}>#{item.number}</span>}
                        {item.tags && item.tags.length &&
                          <span style={{marginLeft:10, color:"#888", fontSize:"0.92em"}}>
                            {item.tags.map(tag => <span key={tag} style={{ marginRight:3, background:"#e2e8fa", borderRadius:6, padding:"1px 5px" }}>{tag}</span>)}
                          </span>
                        }
                      </>
                    )}
                    {group === "Document" && (
                      <>
                        {item.folder && <span style={{marginLeft:8, color:"#496", fontSize:"0.97em"}}>in {highlight(item.folder,query)}</span>}
                        {item.category && <span style={{marginLeft:8, color:"#6a74ab"}}>{highlight(item.category,query)}</span>}
                        {item.tags && item.tags.length &&
                          <span style={{marginLeft:10, color:"#fa8d0c", fontSize:"0.92em"}}>
                            {item.tags.map(tag => <span key={tag} style={{ marginRight:3, background:"#fff5e2", borderRadius:6, padding:"1px 5px" }}>{tag}</span>)}
                          </span>
                        }
                      </>
                    )}
                  </div>
                ))}
              </div>
            )
          ))}
          {!searching && !error && results.length === 0 && query.trim().length > 0 && (
            <div style={{padding:"0.7em 1.2em", color:"#a0aec0"}}>
              🔍 No results found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
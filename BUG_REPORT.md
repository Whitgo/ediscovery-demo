# Bug Hunt Report - eDiscovery Demo
**Date:** December 9, 2025  
**Status:** 🔍 Active Issues Found

## 🔴 Critical Issues

### 1. **Unsafe JSON.parse() in Bulk Upload** 
**Location:** `backend/src/api/documents.js:390`
```javascript
const parsedTags = tags ? (typeof tags === 'string' ? JSON.parse(tags) : tags) : [];
```
**Issue:** No try-catch around JSON.parse - will crash server on malformed JSON  
**Risk:** Server crash, DoS vulnerability  
**Fix:**
```javascript
const parsedTags = tags ? (typeof tags === 'string' ? JSON.parse(tags).catch(() => []) : tags) : [];
// OR use try-catch block
```

### 2. **Missing Input Validation on parseInt()** 
**Location:** `backend/src/api/documents.js:119, 123`
```javascript
query = query.where('size', '>=', parseInt(min_size) * 1024 * 1024);
query = query.where('size', '<=', parseInt(max_size) * 1024 * 1024);
```
**Issue:** `parseInt()` without radix parameter and no NaN check  
**Risk:** SQL query errors, potential injection  
**Fix:**
```javascript
const minSizeBytes = parseInt(min_size, 10);
const maxSizeBytes = parseInt(max_size, 10);
if (!isNaN(minSizeBytes)) {
  query = query.where('size', '>=', minSizeBytes * 1024 * 1024);
}
if (!isNaN(maxSizeBytes)) {
  query = query.where('size', '<=', maxSizeBytes * 1024 * 1024);
}
```

### 3. **SQL Injection Risk in Tag Filtering**
**Location:** `backend/src/api/documents.js:115-117`
```javascript
tagArray.forEach(tag => {
  query = query.whereRaw('LOWER(tags::text) LIKE ?', [`%${tag}%`]);
});
```
**Issue:** While using parameterized queries, the tag value could still cause issues with wildcard characters  
**Risk:** Query manipulation, information disclosure  
**Fix:** Escape wildcard characters or use full-text search
```javascript
tagArray.forEach(tag => {
  const escapedTag = tag.replace(/[%_\\]/g, '\\$&');
  query = query.whereRaw('LOWER(tags::text) LIKE ?', [`%${escapedTag}%`]);
});
```

## 🟡 High Priority Issues

### 4. **Unhandled Promise Rejection in Document Loading**
**Location:** `frontend/src/components/Dashboard.jsx:331-334`
```javascript
for (const c of cases) {
  try {
    const caseDocs = await apiGet(`/documents/case/${c.id}/documents`);
    allDocs.push(...caseDocs);
  } catch {}  // Empty catch - errors silently ignored
}
```
**Issue:** Silent error handling - users won't know if document loading failed  
**Risk:** Missing data, poor UX  
**Fix:**
```javascript
const failedCases = [];
for (const c of cases) {
  try {
    const caseDocs = await apiGet(`/documents/case/${c.id}/documents`);
    allDocs.push(...caseDocs);
  } catch (error) {
    console.error(`Failed to load docs for case ${c.id}:`, error);
    failedCases.push(c.name);
  }
}
if (failedCases.length > 0) {
  alert(`Warning: Failed to load documents from: ${failedCases.join(', ')}`);
}
```

### 5. **Memory Leak Risk - Missing useEffect Cleanup**
**Location:** `frontend/src/components/AdvancedSearch.jsx:22-24`
```javascript
useEffect(() => {
  loadCases();
}, []);
```
**Issue:** No cleanup function for async operation - component could unmount during fetch  
**Risk:** Memory leaks, setState on unmounted component warnings  
**Fix:**
```javascript
useEffect(() => {
  let cancelled = false;
  
  const loadCases = async () => {
    try {
      const data = await apiGet("/cases");
      if (!cancelled) {
        setCases(data);
      }
    } catch (error) {
      if (!cancelled) {
        console.error("Failed to load cases:", error);
      }
    }
  };
  
  loadCases();
  
  return () => {
    cancelled = true;
  };
}, []);
```

### 6. **Race Condition in XHR Upload**
**Location:** `frontend/src/components/Dashboard.jsx:291-313`
```javascript
const xhr = new XMLHttpRequest();

xhr.upload.addEventListener('progress', (e) => {
  // Progress handler
});

const response = await new Promise((resolve, reject) => {
  xhr.onload = () => { ... };
  xhr.onerror = () => reject(new Error('Network error'));
  // No timeout handling
});
```
**Issue:** No timeout on XHR request - could hang indefinitely  
**Risk:** Frozen UI, poor UX  
**Fix:**
```javascript
xhr.timeout = 300000; // 5 minutes
xhr.ontimeout = () => reject(new Error('Upload timeout'));
```

### 7. **Sensitive Data in Console Logs**
**Location:** Multiple files
- `frontend/src/components/AdvancedSearch.jsx:31` - `console.error("Failed to load cases:", error)`
- `frontend/src/components/Dashboard.jsx:324` - `console.error('Upload errors:', response.errors)`
- `backend/src/utils/emailService.js:43` - Email details logged
**Issue:** Potentially sensitive information logged to console  
**Risk:** Information disclosure in production  
**Fix:** Use proper logging with sanitization, disable in production

## 🟠 Medium Priority Issues

### 8. **Inefficient Array Operations**
**Location:** `frontend/src/components/AdvancedSearch.jsx:112-126`
```javascript
filteredResults = filteredResults.filter(doc => {
  return proximityTerms.some(prox => {
    const text = (doc.filename + ' ' + (doc.content || '')).toLowerCase();
    // String concatenation in loop
  });
});
```
**Issue:** Inefficient string concatenation and toLowerCase() calls in nested loops  
**Risk:** Performance degradation with large result sets  
**Fix:**
```javascript
filteredResults = filteredResults.filter(doc => {
  const text = `${doc.filename} ${doc.content || ''}`.toLowerCase();
  return proximityTerms.some(prox => {
    // ... rest of logic
  });
});
```

### 9. **Missing Error Boundary**
**Location:** Frontend components lack error boundaries  
**Issue:** Component errors will crash entire app  
**Risk:** Poor UX, loss of work  
**Fix:** Implement React Error Boundaries around key components

### 10. **Inconsistent Token Storage**
**Location:** Multiple files use `localStorage.getItem('token')`  
**Issue:** Token stored in localStorage (vulnerable to XSS)  
**Risk:** Token theft via XSS attacks  
**Recommendation:** Consider httpOnly cookies or sessionStorage with short expiry

## 🟢 Low Priority Issues

### 11. **Magic Numbers in Code**
**Location:** Various files
- `backend/src/api/documents.js:352` - `50 * 1024 * 1024` (50MB)
- `backend/src/api/documents.js:353` - `100` (max files)
**Issue:** Hard-coded values should be constants  
**Fix:**
```javascript
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_BULK_FILES = 100;
```

### 12. **Unused Variables and Imports**
**Location:** `frontend/src/components/AdvancedSearch.jsx:15`
```javascript
const [booleanMode, setBooleanMode] = useState(true);
// setBooleanMode never used
```
**Issue:** Dead code, unused state  
**Fix:** Remove unused state or implement boolean mode toggle

### 13. **Inconsistent Error Messages**
**Location:** Various API endpoints  
**Issue:** Some errors return just `{ error: message }`, others return detailed objects  
**Fix:** Standardize error response format

### 14. **Missing ARIA Labels**
**Location:** Frontend components  
**Issue:** Accessibility - many interactive elements lack proper ARIA labels  
**Fix:** Add aria-label attributes to buttons, inputs, and interactive divs

## 📊 Summary

| Severity | Count | Fixed |
|----------|-------|-------|
| Critical | 3 | 0 |
| High | 4 | 0 |
| Medium | 3 | 0 |
| Low | 4 | 0 |
| **Total** | **14** | **0** |

## 🎯 Recommended Priority Order

1. **Immediate:** Fix JSON.parse() crash (Bug #1)
2. **Immediate:** Add parseInt() validation (Bug #2)
3. **Today:** Fix SQL injection risk (Bug #3)
4. **Today:** Add useEffect cleanup (Bug #5)
5. **This Week:** Fix error handling (Bug #4)
6. **This Week:** Add XHR timeout (Bug #6)
7. **Next Sprint:** Remove console.logs in production (Bug #7)
8. **Next Sprint:** Optimize array operations (Bug #8)
9. **Backlog:** All low priority issues

## 🔧 Quick Wins
- Add try-catch to JSON.parse() calls (5 min)
- Add radix to parseInt() calls (10 min)
- Remove unused state variables (5 min)
- Extract magic numbers to constants (15 min)

## 🧪 Testing Recommendations
1. Add unit tests for parseBooleanQuery() function
2. Add integration tests for bulk upload with malformed JSON
3. Add E2E tests for document search with special characters
4. Load test bulk upload with 100 files
5. Test XHR cancellation on component unmount

---
**Note:** This report was generated through automated code analysis. Manual testing recommended for verification.

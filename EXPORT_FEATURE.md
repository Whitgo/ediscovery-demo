# Document Export Feature

## Overview
The export tool bundles selected documents from a case into a single ZIP archive with an auto-generated audit-ready index page.

## Features

### Backend (`/backend/src/api/export.js`)
- **POST /api/export/case/:caseId/documents** - Export selected documents
- **POST /api/export/case/:caseId/preview** - Preview export details before downloading

### Export Package Contents
1. **00_EXPORT_INDEX.pdf** - Auto-generated index page with:
   - Export metadata (date, time, user, timestamp)
   - Case information (number, name, status, assignment)
   - Document inventory table with:
     - Sequential numbering
     - Document names
     - File types
     - File sizes
     - Creation dates
     - Legal metadata (category, evidence type, witness, tags)
   - Chain of custody information
   - Page numbers on all pages

2. **Document Files** - Sequentially numbered with sanitized names:
   - Format: `001_document_name.pdf`, `002_report.docx`, etc.
   - Original files preserved with secure hashed storage names
   - Maximum 500 documents per export

3. **00_METADATA.json** (optional) - Complete metadata in JSON format:
   - Export information (timestamp, user, case details)
   - Full document metadata (categories, tags, custom fields)
   - Audit-ready structured data

### Security & Audit Features
- **Authentication Required** - JWT token validation
- **Audit Logging** - All exports logged to `audit_logs` table
- **Timestamps** - ISO 8601 format (UTC) for legal compliance
- **Chain of Custody** - Exported by username and timestamp in index
- **File Validation** - Checks for missing/corrupted files
- **Size Limits** - Maximum 500 documents per export

### API Request Format
```json
POST /api/export/case/:caseId/documents
{
  "documentIds": [1, 2, 3, 4],
  "format": "zip",
  "includeMetadata": true
}
```

### API Response
- **Success**: ZIP file download (Content-Type: application/zip)
- **Filename**: `case_CASE123_export_1700000000000.zip`
- **Error Codes**:
  - 400: Invalid input (bad IDs, empty array, >500 docs)
  - 404: Case or documents not found
  - 500: Server error during export

### Frontend Component (`ExportModal.jsx`)
- **Document Selection** - Checkbox list with select all/deselect all
- **Preview Function** - Shows document count, total size, missing files
- **Metadata Toggle** - Option to include/exclude metadata JSON
- **Progress Indicator** - Loading spinner during export
- **Error Handling** - User-friendly error messages
- **Auto-download** - Browser downloads ZIP automatically

## Usage Flow

1. User clicks "📦 Export" button on Case Detail page
2. Export modal opens showing all documents in the case
3. User selects documents to include (or select all)
4. User optionally clicks "👁 Preview" to see export details
5. User toggles "Include Metadata" option if needed
6. User clicks "📦 Export ZIP"
7. Backend:
   - Validates request
   - Generates PDF index with audit information
   - Creates ZIP archive with documents
   - Logs export to audit trail
   - Streams ZIP to client
8. Browser automatically downloads the ZIP file
9. Modal closes on success

## Technical Details

### Dependencies
- **Backend**: `archiver` (ZIP creation), `pdf-lib` (PDF generation)
- **Frontend**: Native fetch API, Blob handling

### PDF Generation
- Letter size (612 x 792 points)
- Times Roman font family
- Professional formatting with headers, tables, footers
- Multi-page support with automatic page breaks
- Page numbering

### ZIP Compression
- Level 9 (maximum compression)
- Streaming to response (memory efficient)
- Sanitized filenames (no special characters)

### File Naming Convention
- Index: `00_EXPORT_INDEX.pdf`
- Metadata: `00_METADATA.json`
- Documents: `001_filename.ext`, `002_filename.ext`, etc.

## Error Handling

### Backend Validation
- Case ID must be numeric
- Document IDs array required and non-empty
- Maximum 500 documents per export
- All IDs must be valid numbers
- Case must exist
- Documents must belong to specified case

### Frontend Validation
- At least one document must be selected
- Disabled state during export
- Network error handling
- Blob download error handling

### Recovery
- Failed exports logged but don't crash server
- Partial failures reported in console
- Missing files skipped with warnings
- Audit log failures don't block export

## Compliance Features

### Legal Requirements Met
- ✅ Audit-ready formatting
- ✅ Timestamps in UTC (ISO 8601)
- ✅ Chain of custody documentation
- ✅ User attribution (exported by)
- ✅ Document inventory with metadata
- ✅ Sequential numbering for reference
- ✅ Complete audit trail in database

### Discovery Production Standards
- Professional PDF index suitable for court submission
- Consistent numbering system (Bates-style)
- Metadata preservation in structured format
- Original file integrity maintained
- Export process logged for verification

## Future Enhancements (Potential)
- Bates numbering stamps on documents
- Redaction tools before export
- Password-protected ZIP files
- Export templates (different formats)
- Scheduled/automated exports
- Export to cloud storage (S3, etc.)
- Email delivery of exports
- Custom cover sheets
- OCR text extraction included
- Hash verification for documents

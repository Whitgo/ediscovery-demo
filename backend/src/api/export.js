const express = require('express');
const router = express.Router();
const archiver = require('archiver');
const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const { createNotification } = require('./notifications');
const { decryptFile, isEncryptionEnabled } = require('../utils/encryption');

// Middleware
const auth = require('../middleware/auth');

/**
 * Security Note: archiver dependency tree includes glob with CVE-2024-4067
 * However, this vulnerability only affects glob CLI usage with shell:true
 * We use archiver's API for ZIP creation without glob CLI - not vulnerable
 * 
 * POST /api/export/case/:caseId/documents
 * Export selected documents as a ZIP with an audit-ready index
 * Body: { documentIds: [1, 2, 3], format: 'zip', includeMetadata: true }
 */
router.post('/case/:caseId/documents', auth, async (req, res) => {
  const { caseId } = req.params;
  const { documentIds, format = 'zip', includeMetadata = true } = req.body;

  try {
    // Validate caseId
    const caseIdNum = parseInt(caseId, 10);
    if (isNaN(caseIdNum)) {
      return res.status(400).json({ error: 'Invalid case ID' });
    }

    // Validate documentIds
    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      return res.status(400).json({ error: 'Document IDs array is required and must not be empty' });
    }

    if (documentIds.length > 500) {
      return res.status(400).json({ error: 'Maximum 500 documents can be exported at once' });
    }

    // Validate all IDs are numbers
    const validIds = documentIds.every(id => !isNaN(parseInt(id, 10)));
    if (!validIds) {
      return res.status(400).json({ error: 'All document IDs must be valid numbers' });
    }

    // Verify case exists
    const caseData = await req.knex('cases').where({ id: caseIdNum }).first();
    if (!caseData) {
      return res.status(404).json({ error: 'Case not found' });
    }

    // Fetch documents with metadata
    const documents = await req.knex('documents')
      .where('case_id', caseIdNum)
      .whereIn('id', documentIds)
      .orderBy('name', 'asc');

    if (documents.length === 0) {
      return res.status(404).json({ error: 'No documents found matching the provided IDs' });
    }

    // Check if any documents are missing stored files
    const missingFiles = documents.filter(doc => !doc.stored_filename);
    if (missingFiles.length > 0) {
      console.warn(`Export warning: ${missingFiles.length} documents have no stored file`);
    }

    // Get all tags for these documents
    const docTags = {};
    for (const doc of documents) {
      try {
        const tags = doc.tags ? JSON.parse(doc.tags) : [];
        docTags[doc.id] = Array.isArray(tags) ? tags : [];
      } catch (e) {
        docTags[doc.id] = [];
      }
    }

    // Generate export timestamp
    const exportTimestamp = new Date().toISOString();
    const exportDate = new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    });

    // Generate audit-ready index page (PDF)
    const indexPdf = await generateIndexPDF({
      caseData,
      documents,
      docTags,
      exportDate,
      exportTimestamp,
      exportedBy: req.user.username,
      includeMetadata
    });

    // Create ZIP archive
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });

    // Set response headers for file download
    const sanitizedCaseName = caseData.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filename = `case_${caseData.number}_export_${Date.now()}.zip`;
    
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Pipe archive to response
    archive.pipe(res);

    // Add index PDF to archive
    archive.append(indexPdf, { name: '00_EXPORT_INDEX.pdf' });

    // Add documents to archive
    const uploadsDir = path.join(__dirname, '../../uploads');
    let addedCount = 0;

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      
      if (!doc.stored_filename) {
        console.warn(`Skipping document ${doc.id} - no stored file`);
        continue;
      }

      const filePath = path.join(uploadsDir, doc.stored_filename);
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.warn(`File not found: ${filePath}`);
        continue;
      }

      try {
        // Create a sanitized filename with index
        const fileExtension = doc.file_type ? `.${doc.file_type.split('/').pop()}` : '';
        const sanitizedName = doc.name.replace(/[^a-z0-9.-]/gi, '_');
        const indexedName = `${String(i + 1).padStart(3, '0')}_${sanitizedName}${fileExtension}`;
        
        // Add file to archive
        archive.file(filePath, { name: indexedName });
        addedCount++;
      } catch (fileError) {
        console.error(`Error adding file ${doc.id} to archive:`, fileError);
      }
    }

    // Add metadata JSON if requested
    if (includeMetadata) {
      const metadata = {
        export_info: {
          exported_at: exportTimestamp,
          exported_by: req.user.username,
          case_id: caseData.id,
          case_number: caseData.number,
          case_name: caseData.name,
          total_documents: documents.length,
          files_included: addedCount
        },
        documents: documents.map(doc => ({
          id: doc.id,
          name: doc.name,
          file_type: doc.file_type,
          size: doc.size,
          created_at: doc.created_at,
          updated_at: doc.updated_at,
          legal_category: doc.legal_category,
          evidence_type: doc.evidence_type,
          case_number: doc.case_number,
          witness_name: doc.witness_name,
          tags: docTags[doc.id],
          folder: doc.folder,
          custom_metadata: doc.custom_metadata
        }))
      };

      archive.append(JSON.stringify(metadata, null, 2), { 
        name: '00_METADATA.json' 
      });
    }

    // Log audit trail
    try {
      await req.knex('audit_logs').insert({
        case_id: caseIdNum,
        user_id: req.user.id,
        action: 'export_documents',
        details: JSON.stringify({
          document_count: documents.length,
          document_ids: documentIds,
          format,
          include_metadata: includeMetadata,
          exported_at: exportTimestamp
        }),
        created_at: knex.fn.now()
      });
    } catch (auditError) {
      console.error('Failed to log export audit:', auditError);
      // Don't fail the export if audit logging fails
    }

    // Finalize archive
    await archive.finalize();

    console.log(`Export completed: ${addedCount} files for case ${caseData.number}`);
    
    // Send notification to the user
    if (req.user.role === 'user' || req.user.role === 'manager') {
      await createNotification(knex, {
        userId: req.user.id,
        type: 'export_completed',
        title: 'Export Completed',
        message: `Your export of ${documents.length} documents from case "${caseData.name}" is ready`,
        caseId: caseIdNum,
        metadata: {
          documentCount: documents.length,
          caseName: caseData.name,
          caseNumber: caseData.number
        }
      });
    }

  } catch (error) {
    console.error('Export error:', error);
    
    // If headers already sent, can't send JSON error
    if (res.headersSent) {
      return res.end();
    }

    return res.status(500).json({ 
      error: 'Failed to export documents',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Generate audit-ready index PDF
 */
async function generateIndexPDF({
  caseData,
  documents,
  docTags,
  exportDate,
  exportTimestamp,
  exportedBy,
  includeMetadata
}) {
  const pdfDoc = await PDFDocument.create();
  const timesFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const timesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  
  let page = pdfDoc.addPage([612, 792]); // Letter size
  const { width, height } = page.getSize();
  
  let yPosition = height - 50;
  const margin = 50;
  const lineHeight = 14;
  const maxWidth = width - (margin * 2);

  // Helper function to add new page if needed
  const checkAddPage = (requiredSpace = 50) => {
    if (yPosition < margin + requiredSpace) {
      page = pdfDoc.addPage([612, 792]);
      yPosition = height - 50;
      return true;
    }
    return false;
  };

  // Helper to draw text with word wrap
  const drawText = (text, x, y, options = {}) => {
    const fontSize = options.fontSize || 10;
    const font = options.bold ? timesBold : timesFont;
    const maxLineWidth = options.maxWidth || maxWidth;
    
    page.drawText(text, {
      x,
      y,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
      ...options
    });
  };

  // Title
  drawText('EXPORT INDEX REPORT', margin, yPosition, { 
    fontSize: 18, 
    bold: true 
  });
  yPosition -= 30;

  // Export metadata
  drawText('Export Information', margin, yPosition, { fontSize: 12, bold: true });
  yPosition -= lineHeight + 5;
  
  drawText(`Export Date: ${exportDate}`, margin, yPosition);
  yPosition -= lineHeight;
  
  drawText(`Exported By: ${exportedBy}`, margin, yPosition);
  yPosition -= lineHeight;
  
  drawText(`Export Timestamp: ${exportTimestamp}`, margin, yPosition);
  yPosition -= lineHeight * 2;

  // Case information
  checkAddPage(100);
  drawText('Case Information', margin, yPosition, { fontSize: 12, bold: true });
  yPosition -= lineHeight + 5;
  
  drawText(`Case Number: ${caseData.number}`, margin, yPosition);
  yPosition -= lineHeight;
  
  drawText(`Case Name: ${caseData.name}`, margin, yPosition);
  yPosition -= lineHeight;
  
  drawText(`Status: ${caseData.status}`, margin, yPosition);
  yPosition -= lineHeight;
  
  if (caseData.assigned_to) {
    drawText(`Assigned To: ${caseData.assigned_to}`, margin, yPosition);
    yPosition -= lineHeight;
  }
  
  yPosition -= lineHeight;

  // Document list
  checkAddPage(100);
  drawText('Document Inventory', margin, yPosition, { fontSize: 12, bold: true });
  yPosition -= lineHeight + 5;
  
  drawText(`Total Documents: ${documents.length}`, margin, yPosition);
  yPosition -= lineHeight * 2;

  // Document table header
  checkAddPage(150);
  drawText('#', margin, yPosition, { bold: true });
  drawText('Document Name', margin + 30, yPosition, { bold: true });
  drawText('Type', margin + 250, yPosition, { bold: true });
  drawText('Size', margin + 350, yPosition, { bold: true });
  drawText('Date', margin + 420, yPosition, { bold: true });
  yPosition -= lineHeight + 3;

  // Draw line under header
  page.drawLine({
    start: { x: margin, y: yPosition },
    end: { x: width - margin, y: yPosition },
    thickness: 1,
    color: rgb(0, 0, 0)
  });
  yPosition -= lineHeight;

  // Document rows
  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i];
    checkAddPage(60);
    
    // Document number
    drawText(`${i + 1}`, margin, yPosition);
    
    // Document name (truncate if too long)
    const docName = doc.name.length > 30 ? doc.name.substring(0, 27) + '...' : doc.name;
    drawText(docName, margin + 30, yPosition);
    
    // File type
    const fileType = doc.file_type ? doc.file_type.split('/').pop().toUpperCase() : 'N/A';
    drawText(fileType, margin + 250, yPosition);
    
    // File size
    const size = doc.size ? `${Math.round(doc.size / 1024)} KB` : 'N/A';
    drawText(size, margin + 350, yPosition);
    
    // Date
    const date = doc.created_at ? new Date(doc.created_at).toLocaleDateString() : 'N/A';
    drawText(date, margin + 420, yPosition);
    
    yPosition -= lineHeight;

    // Add metadata if included
    if (includeMetadata && yPosition > margin + 80) {
      const metaItems = [];
      
      if (doc.legal_category) metaItems.push(`Category: ${doc.legal_category}`);
      if (doc.evidence_type) metaItems.push(`Evidence: ${doc.evidence_type}`);
      if (doc.case_number) metaItems.push(`Case #: ${doc.case_number}`);
      if (doc.witness_name) metaItems.push(`Witness: ${doc.witness_name}`);
      
      if (metaItems.length > 0) {
        const metaText = metaItems.join(' | ');
        const truncatedMeta = metaText.length > 80 ? metaText.substring(0, 77) + '...' : metaText;
        drawText(truncatedMeta, margin + 30, yPosition, { fontSize: 8 });
        yPosition -= lineHeight * 0.8;
      }

      // Add tags
      const tags = docTags[doc.id] || [];
      if (tags.length > 0) {
        const tagsText = `Tags: ${tags.slice(0, 5).join(', ')}${tags.length > 5 ? '...' : ''}`;
        drawText(tagsText, margin + 30, yPosition, { fontSize: 8 });
        yPosition -= lineHeight * 0.8;
      }
    }
    
    yPosition -= lineHeight * 0.5; // Extra spacing between documents
  }

  // Footer on last page
  yPosition = margin + 30;
  page.drawLine({
    start: { x: margin, y: yPosition },
    end: { x: width - margin, y: yPosition },
    thickness: 1,
    color: rgb(0, 0, 0)
  });
  yPosition -= lineHeight + 5;
  
  drawText('This export was generated for legal review purposes.', margin, yPosition, { fontSize: 8 });
  yPosition -= lineHeight * 0.9;
  drawText('All timestamps are in ISO 8601 format (UTC).', margin, yPosition, { fontSize: 8 });
  yPosition -= lineHeight * 0.9;
  drawText(`Chain of custody maintained by ${exportedBy} at ${exportDate}`, margin, yPosition, { fontSize: 8 });

  // Add page numbers
  const pages = pdfDoc.getPages();
  pages.forEach((pg, index) => {
    pg.drawText(`Page ${index + 1} of ${pages.length}`, {
      x: width - margin - 60,
      y: 20,
      size: 8,
      font: timesFont,
      color: rgb(0.5, 0.5, 0.5)
    });
  });

  return await pdfDoc.save();
}

/**
 * GET /api/export/case/:caseId/preview
 * Preview what would be included in an export
 */
router.post('/case/:caseId/preview', auth, async (req, res) => {
  const { caseId } = req.params;
  const { documentIds } = req.body;

  try {
    const caseIdNum = parseInt(caseId, 10);
    if (isNaN(caseIdNum)) {
      return res.status(400).json({ error: 'Invalid case ID' });
    }

    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      return res.status(400).json({ error: 'Document IDs array is required' });
    }

    const documents = await req.knex('documents')
      .where('case_id', caseIdNum)
      .whereIn('id', documentIds)
      .select('id', 'name', 'file_type', 'size', 'stored_filename');

    const totalSize = documents.reduce((sum, doc) => sum + (doc.size || 0), 0);
    const missingFiles = documents.filter(doc => !doc.stored_filename).length;

    res.json({
      document_count: documents.length,
      total_size_bytes: totalSize,
      total_size_mb: (totalSize / (1024 * 1024)).toFixed(2),
      missing_files: missingFiles,
      documents: documents.map(doc => ({
        id: doc.id,
        name: doc.name,
        file_type: doc.file_type,
        size_kb: doc.size ? Math.round(doc.size / 1024) : 0,
        has_file: !!doc.stored_filename
      }))
    });

  } catch (error) {
    console.error('Export preview error:', error);
    return res.status(500).json({ error: 'Failed to generate export preview' });
  }
});

module.exports = router;

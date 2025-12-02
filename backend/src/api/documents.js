const express = require('express');
const router = express.Router({ mergeParams: true });
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const audit = require('../middleware/audit');
const { upload, encryptUploadedFile } = require('../middleware/upload');
const { notifyUsersInCase } = require('./notifications');
const { decryptFile, isEncryptionEnabled } = require('../utils/encryption');
const { getCachedThumbnail } = require('../utils/pdfThumbnail');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

router.get('/case/:caseId/documents', auth, async (req, res) => {
  const knex = req.knex;
  try {
    const docs = await knex('documents').where({ case_id: req.params.caseId });
    res.json(docs);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Advanced search endpoint with Boolean operators and metadata filters
router.get('/documents/search', auth, async (req, res) => {
  const knex = req.knex;
  try {
    const {
      q,
      case_id,
      file_type,
      custodian,
      date_from,
      date_to,
      tags,
      min_size,
      max_size
    } = req.query;

    // Start building query
    let query = knex('documents').select('documents.*');

    // Parse Boolean search query
    if (q) {
      const terms = parseBooleanQuery(q);
      
      // Build search conditions
      if (terms.and && terms.and.length > 0) {
        terms.and.forEach(term => {
          query = query.where(function() {
            this.where('name', 'ilike', `%${term}%`)
                .orWhere('file_type', 'ilike', `%${term}%`)
                .orWhere('category', 'ilike', `%${term}%`)
                .orWhere('evidence_type', 'ilike', `%${term}%`)
                .orWhere('legal_category', 'ilike', `%${term}%`);
          });
        });
      }
      
      if (terms.or && terms.or.length > 0) {
        query = query.where(function() {
          terms.or.forEach((term, index) => {
            const method = index === 0 ? 'where' : 'orWhere';
            this[method](function() {
              this.where('name', 'ilike', `%${term}%`)
                  .orWhere('file_type', 'ilike', `%${term}%`)
                  .orWhere('category', 'ilike', `%${term}%`)
                  .orWhere('evidence_type', 'ilike', `%${term}%`)
                  .orWhere('legal_category', 'ilike', `%${term}%`);
            });
          });
        });
      }
      
      if (terms.not && terms.not.length > 0) {
        terms.not.forEach(term => {
          query = query.whereNot(function() {
            this.where('name', 'ilike', `%${term}%`)
                .orWhere('file_type', 'ilike', `%${term}%`)
                .orWhere('category', 'ilike', `%${term}%`)
                .orWhere('evidence_type', 'ilike', `%${term}%`)
                .orWhere('legal_category', 'ilike', `%${term}%`);
          });
        });
      }
    }

    // Apply metadata filters
    if (case_id) {
      query = query.where('case_id', case_id);
    }

    if (file_type) {
      query = query.where('file_type', 'ilike', `%${file_type}%`);
    }

    if (custodian) {
      query = query.where('uploaded_by', 'ilike', `%${custodian}%`);
    }

    if (date_from) {
      query = query.where('created_at', '>=', date_from);
    }

    if (date_to) {
      query = query.where('created_at', '<=', date_to);
    }

    if (tags) {
      const tagArray = tags.split(',').map(t => t.trim().toLowerCase());
      tagArray.forEach(tag => {
        query = query.whereRaw('LOWER(tags::text) LIKE ?', [`%${tag}%`]);
      });
    }

    if (min_size) {
      query = query.where('size', '>=', parseInt(min_size) * 1024 * 1024); // Convert MB to bytes
    }

    if (max_size) {
      query = query.where('size', '<=', parseInt(max_size) * 1024 * 1024); // Convert MB to bytes
    }

    const documents = await query;

    res.json({
      documents,
      total: documents.length,
      query: req.query
    });
  } catch (e) {
    logger.error('Advanced search error', { error: e.message, stack: e.stack, query: req.query, userId: req.user?.id });
    res.status(500).json({ error: e.message });
  }
});

// Helper function to parse Boolean search queries
function parseBooleanQuery(query) {
  const result = { and: [], or: [], not: [] };
  
  // Remove parentheses for simplicity (basic parser)
  const cleaned = query.replace(/[()]/g, '');
  
  // Split by AND first
  const andParts = cleaned.split(/\sAND\s/i);
  
  andParts.forEach(part => {
    // Check for OR
    if (/\sOR\s/i.test(part)) {
      const orTerms = part.split(/\sOR\s/i);
      orTerms.forEach(term => {
        const trimmed = term.trim().replace(/^["']|["']$/g, '');
        if (trimmed && !/^NOT\s/i.test(trimmed)) {
          result.or.push(trimmed);
        }
      });
    }
    // Check for NOT
    else if (/^NOT\s/i.test(part.trim())) {
      const term = part.trim().replace(/^NOT\s/i, '').replace(/^["']|["']$/g, '');
      if (term) {
        result.not.push(term);
      }
    }
    // Regular AND term
    else {
      const trimmed = part.trim().replace(/^["']|["']$/g, '');
      if (trimmed) {
        result.and.push(trimmed);
      }
    }
  });
  
  return result;
}

// Get single document metadata
router.get('/case/:caseId/documents/:docId', auth, async (req, res) => {
  const knex = req.knex;
  try {
    const doc = await knex('documents')
      .where({ id: req.params.docId, case_id: req.params.caseId })
      .first();
    
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    res.json(doc);
  } catch (e) {
    logger.error('Get document error', { error: e.message, stack: e.stack, docId: req.params.docId, caseId: req.params.caseId, userId: req.user?.id });
    res.status(500).json({ error: e.message });
  }
});

// Log document view for audit trail
router.post('/case/:caseId/documents/:docId/view', auth, async (req, res) => {
  const knex = req.knex;
  try {
    const doc = await knex('documents')
      .where({ id: req.params.docId, case_id: req.params.caseId })
      .first();
    
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    // Log to audit trail
    await knex('audit_logs').insert({
      case_id: req.params.caseId,
      user: req.user.name,
      action: 'view_document',
      details: JSON.stringify({
        document_id: req.params.docId,
        document_name: doc.name,
        file_type: doc.file_type
      }),
      timestamp: knex.fn.now()
    });
    
    res.json({ success: true, message: 'Document view logged' });
  } catch (e) {
    logger.error('View logging error', { error: e.message, stack: e.stack, docId: req.params.docId, caseId: req.params.caseId, userId: req.user?.id });
    // Don't fail if logging fails
    res.status(500).json({ error: 'Failed to log view', details: e.message });
  }
});

// New secure file upload endpoint
router.post('/case/:caseId/documents/upload', auth, upload.single('file'), encryptUploadedFile, async (req, res) => {
  const knex = req.knex;
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { 
      category, 
      folder, 
      tags,
      case_number,
      witness_name,
      evidence_type,
      legal_category,
      custom_metadata
    } = req.body;
    
    const parsedTags = tags ? (typeof tags === 'string' ? JSON.parse(tags) : tags) : [];
    
    // Deduplicate tags
    const uniqueTags = [...new Set(
      parsedTags.map(tag => tag.trim().toLowerCase()).filter(tag => tag.length > 0)
    )];
    
    // Prepare document data
    const documentData = {
      case_id: req.params.caseId,
      name: req.originalFilename,
      size: req.file.size,
      file_type: req.file.mimetype,
      stored_filename: req.hashedFilename,
      category: category || 'general',
      folder: folder || '',
      case_number: case_number || null,
      witness_name: witness_name || null,
      evidence_type: evidence_type || null,
      legal_category: legal_category || null,
      custom_metadata: custom_metadata ? JSON.stringify(custom_metadata) : '{}',
      uploaded_by: req.user.name,
      tags: JSON.stringify(uniqueTags),
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    };

    // Add encryption metadata if file was encrypted
    if (req.fileEncrypted && req.encryptionMetadata) {
      documentData.encrypted = true;
      documentData.encryption_iv = req.encryptionMetadata.iv;
      documentData.encryption_auth_tag = req.encryptionMetadata.authTag;
      documentData.encryption_salt = req.encryptionMetadata.salt;
      documentData.encryption_algorithm = req.encryptionMetadata.algorithm;
    }
    
    const [id] = await knex('documents').insert(documentData).returning('id');
    
    await audit({
      action: 'upload',
      user: req.user.name,
      objectType: 'document',
      objectId: id,
      caseId: req.params.caseId,
      details: { 
        name: req.originalFilename, 
        category: category || 'general', 
        folder: folder || '',
        size: req.file.size,
        type: req.file.mimetype,
        legal_category: legal_category || null,
        evidence_type: evidence_type || null
      }
    });
    
    // Send notification to all users and managers
    const caseInfo = await knex('cases').where({ id: req.params.caseId }).first();
    await notifyUsersInCase(knex, req.params.caseId, {
      type: 'document_uploaded',
      title: 'New Document Uploaded',
      message: `${req.user.name} uploaded "${req.originalFilename}" to case ${caseInfo?.name || req.params.caseId}`,
      documentId: id,
      metadata: {
        fileName: req.originalFilename,
        uploadedBy: req.user.name,
        caseName: caseInfo?.name
      }
    });
    
    res.status(201).json({ 
      id, 
      name: req.originalFilename,
      size: req.file.size,
      file_type: req.file.mimetype,
      category: category || 'general',
      folder: folder || '',
      case_number,
      witness_name,
      evidence_type,
      legal_category,
      tags: uniqueTags
    });
  } catch (e) {
    // Clean up uploaded file if database insert fails
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, () => {});
    }
    res.status(500).json({ error: e.message });
  }
});

// Legacy endpoint for backward compatibility
router.post('/case/:caseId/documents', auth, async (req, res) => {
  const knex = req.knex;
  const { name, size, category, folder, file_url, tags } = req.body;
  try {
    const [id] = await knex('documents').insert({
      case_id: req.params.caseId,
      name,
      size,
      category,
      folder,
      file_url,
      uploaded_by: req.user.name,
      tags: JSON.stringify(tags),
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    }).returning('id');
    await audit({
      action: 'create',
      user: req.user.name,
      objectType: 'document',
      objectId: id,
      caseId: req.params.caseId,
      details: { name, category, folder }
    });
    res.status(201).json({ id, name, size, category, folder, file_url, tags });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Secure file serving endpoint with decryption support
router.get('/case/:caseId/documents/:docId/download', auth, async (req, res) => {
  const knex = req.knex;
  const tempFiles = [];
  
  try {
    const doc = await knex('documents')
      .where({ id: req.params.docId, case_id: req.params.caseId })
      .first();
    
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // If it's a legacy file_url document
    if (doc.file_url && !doc.stored_filename) {
      return res.redirect(doc.file_url);
    }

    // Serve stored file
    if (doc.stored_filename) {
      // Validate filename to prevent path traversal
      const sanitizedFilename = path.basename(doc.stored_filename);
      if (sanitizedFilename !== doc.stored_filename || sanitizedFilename.includes('..')) {
        return res.status(400).json({ error: 'Invalid filename' });
      }
      
      const uploadsDir = path.resolve(__dirname, '../../uploads');
      const filePath = path.join(uploadsDir, sanitizedFilename);
      const normalizedPath = path.resolve(filePath);
      
      // Ensure file is within uploads directory
      if (!normalizedPath.startsWith(uploadsDir)) {
        return res.status(400).json({ error: 'Invalid file path' });
      }
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found on server' });
      }

      // If file is encrypted, decrypt it before serving
      if (doc.encrypted && isEncryptionEnabled()) {
        try {
          const tempDecryptedPath = path.join(__dirname, '../../uploads', `temp_${Date.now()}_${doc.stored_filename}`);
          tempFiles.push(tempDecryptedPath);

          // Decrypt file to temporary location
          await decryptFile(filePath, tempDecryptedPath, {
            iv: doc.encryption_iv,
            authTag: doc.encryption_auth_tag
          });

          res.setHeader('Content-Disposition', `attachment; filename="${doc.name}"`);
          res.setHeader('Content-Type', doc.file_type || 'application/octet-stream');
          
          // Send decrypted file
          const fileStream = fs.createReadStream(tempDecryptedPath);
          
          fileStream.on('end', () => {
            // Clean up temp file after sending
            tempFiles.forEach(file => {
              if (fs.existsSync(file)) {
                fs.unlinkSync(file);
              }
            });
          });

          fileStream.on('error', (err) => {
            logger.error('Stream error', { error: err.message, stack: err.stack, docId: req.params.docId, caseId: req.params.caseId, userId: req.user?.id });
            // Clean up on error
            tempFiles.forEach(file => {
              if (fs.existsSync(file)) {
                fs.unlinkSync(file);
              }
            });
          });

          return fileStream.pipe(res);
        } catch (decryptError) {
          logger.error('Decryption error', { error: decryptError.message, stack: decryptError.stack, docId: req.params.docId, caseId: req.params.caseId, userId: req.user?.id, filePath });
          return res.status(500).json({ 
            error: 'Failed to decrypt file', 
            details: decryptError.message 
          });
        }
      }

      // Serve unencrypted file normally
      res.setHeader('Content-Disposition', `attachment; filename="${doc.name}"`);
      res.setHeader('Content-Type', doc.file_type || 'application/octet-stream');
      
      return res.sendFile(filePath);
    }

    res.status(404).json({ error: 'No file available' });
  } catch (e) {
    // Clean up temp files on error
    tempFiles.forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });
    res.status(500).json({ error: e.message });
  }
});

router.delete('/case/:caseId/documents/:docId', auth, async (req, res) => {
  const knex = req.knex;
  try {
    const doc = await knex('documents')
      .where({ id: req.params.docId, case_id: req.params.caseId })
      .first();
    
    if (doc && doc.stored_filename) {
      // Delete physical file
      const filePath = path.join(__dirname, '../../uploads', doc.stored_filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    
    await knex('documents').where({ id: req.params.docId, case_id: req.params.caseId }).del();
    await audit({
      action: "delete",
      user: req.user.name,
      objectType: "document",
      objectId: req.params.docId,
      caseId: req.params.caseId,
      details: { name: doc?.name }
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get document thumbnail/preview
router.get('/case/:caseId/documents/:docId/thumbnail', auth, async (req, res) => {
  const knex = req.knex;
  try {
    const doc = await knex('documents')
      .where({ id: req.params.docId, case_id: req.params.caseId })
      .first();
    
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Only generate thumbnails for PDF files
    if (!doc.file_name || !doc.file_name.toLowerCase().endsWith('.pdf')) {
      return res.status(400).json({ 
        error: 'Thumbnail only available for PDF documents',
        fileType: doc.file_type 
      });
    }

    // Check if stored file exists
    if (!doc.stored_filename) {
      return res.status(404).json({ error: 'Document file not found' });
    }

    const filePath = path.join(__dirname, '../../uploads', doc.stored_filename);
    
    // Verify file exists
    if (!fs.existsSync(filePath)) {
      logger.error('Document file not found on disk', { 
        docId: req.params.docId, 
        storedFilename: doc.stored_filename 
      });
      return res.status(404).json({ error: 'Document file not found on disk' });
    }

    // Get or generate thumbnail
    const cacheDir = path.join(__dirname, '../../temp/thumbnails');
    const thumbnailData = await getCachedThumbnail(filePath, cacheDir, {
      width: 200,
      height: 260
    });

    // Return SVG preview
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    res.send(thumbnailData.svgPreview);

  } catch (e) {
    logger.error('Thumbnail generation error', { 
      error: e.message, 
      stack: e.stack,
      docId: req.params.docId, 
      caseId: req.params.caseId, 
      userId: req.user?.id 
    });
    res.status(500).json({ error: 'Failed to generate thumbnail' });
  }
});

module.exports = router;
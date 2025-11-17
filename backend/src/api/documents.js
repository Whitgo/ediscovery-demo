const express = require('express');
const router = express.Router({ mergeParams: true });
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const audit = require('../middleware/audit');
const { upload, encryptUploadedFile } = require('../middleware/upload');
const { notifyUsersInCase } = require('./notifications');
const { decryptFile, isEncryptionEnabled } = require('../utils/encryption');
const path = require('path');
const fs = require('fs');

router.get('/case/:caseId/documents', auth, async (req, res) => {
  const knex = req.knex;
  try {
    const docs = await knex('documents').where({ case_id: req.params.caseId });
    res.json(docs);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

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
    console.error('Get document error:', e);
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
      user_id: req.user.id,
      action: 'view_document',
      details: JSON.stringify({
        document_id: req.params.docId,
        document_name: doc.name,
        file_type: doc.file_type
      }),
      created_at: knex.fn.now()
    });
    
    res.json({ success: true, message: 'Document view logged' });
  } catch (e) {
    console.error('View logging error:', e);
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
      const filePath = path.join(__dirname, '../../uploads', doc.stored_filename);
      
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
            console.error('Stream error:', err);
            // Clean up on error
            tempFiles.forEach(file => {
              if (fs.existsSync(file)) {
                fs.unlinkSync(file);
              }
            });
          });

          return fileStream.pipe(res);
        } catch (decryptError) {
          console.error('Decryption error:', decryptError);
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

module.exports = router;
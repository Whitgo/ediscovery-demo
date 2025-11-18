const express = require('express');
const router = express.Router({ mergeParams: true });
const auth = require('../middleware/auth');
const logger = require('../utils/logger');

// Legal document categories
const LEGAL_CATEGORIES = [
  'Law Enforcement Report',
  'Complaint',
  'Motion',
  'Court Order',
  'Restitution',
  'Evidence',
  'Correspondence',
  'Contract',
  'Deposition',
  'Interrogatory',
  'Request for Production',
  'Affidavit',
  'Exhibit',
  'Brief',
  'Pleading',
  'Discovery Response',
  'Expert Report',
  'Medical Record',
  'Financial Record',
  'Other'
];

// Evidence types
const EVIDENCE_TYPES = [
  'Physical Evidence',
  'Documentary Evidence',
  'Testimonial Evidence',
  'Digital Evidence',
  'Photographic Evidence',
  'Audio Recording',
  'Video Recording',
  'Forensic Evidence',
  'Chain of Custody',
  'Expert Opinion',
  'Other'
];

// Get all available categories and evidence types
router.get('/metadata/options', auth, (req, res) => {
  res.json({
    legalCategories: LEGAL_CATEGORIES,
    evidenceTypes: EVIDENCE_TYPES
  });
});

// Get all unique tags from documents in a case
router.get('/case/:caseId/tags', auth, async (req, res) => {
  const knex = req.knex;
  
  // Validate caseId
  if (!req.params.caseId || isNaN(req.params.caseId)) {
    return res.status(400).json({ error: 'Invalid case ID provided' });
  }
  
  try {
    // Verify case exists and user has access
    const caseExists = await knex('cases')
      .where({ id: req.params.caseId })
      .first();
    
    if (!caseExists) {
      return res.status(404).json({ error: 'Case not found' });
    }
    
    const docs = await knex('documents')
      .where({ case_id: req.params.caseId })
      .select('tags');
    
    const allTags = new Set();
    docs.forEach(doc => {
      if (doc.tags) {
        try {
          const tags = typeof doc.tags === 'string' ? JSON.parse(doc.tags) : doc.tags;
          if (Array.isArray(tags)) {
            tags.forEach(tag => {
              if (tag && typeof tag === 'string') {
                allTags.add(tag);
              }
            });
          }
        } catch (parseError) {
          logger.error('Failed to parse tags for document', { error: parseError.message, stack: parseError.stack, documentId: doc.id, caseId: req.params.caseId });
        }
      }
    });
    
    res.json({ tags: Array.from(allTags).sort() });
  } catch (e) {
    logger.error('Error fetching tags', { error: e.message, stack: e.stack, caseId: req.params.caseId, userId: req.user?.id });
    res.status(500).json({ 
      error: 'Failed to retrieve tags', 
      details: process.env.NODE_ENV === 'development' ? e.message : undefined 
    });
  }
});

// Get all unique witnesses from documents in a case
router.get('/case/:caseId/witnesses', auth, async (req, res) => {
  const knex = req.knex;
  
  // Validate caseId
  if (!req.params.caseId || isNaN(req.params.caseId)) {
    return res.status(400).json({ error: 'Invalid case ID provided' });
  }
  
  try {
    // Verify case exists
    const caseExists = await knex('cases')
      .where({ id: req.params.caseId })
      .first();
    
    if (!caseExists) {
      return res.status(404).json({ error: 'Case not found' });
    }
    
    const witnesses = await knex('documents')
      .where({ case_id: req.params.caseId })
      .whereNotNull('witness_name')
      .where('witness_name', '!=', '')
      .distinct('witness_name')
      .select('witness_name');
    
    res.json({ 
      witnesses: witnesses
        .map(w => w.witness_name)
        .filter(name => name && typeof name === 'string' && name.trim().length > 0)
        .sort() 
    });
  } catch (e) {
    logger.error('Error fetching witnesses', { error: e.message, stack: e.stack, caseId: req.params.caseId, userId: req.user?.id });
    res.status(500).json({ 
      error: 'Failed to retrieve witnesses', 
      details: process.env.NODE_ENV === 'development' ? e.message : undefined 
    });
  }
});

// Bulk update metadata for multiple documents
// NOTE: This route MUST come before the single document update route
// to prevent Express from matching "bulk" as a :docId parameter
router.patch('/case/:caseId/documents/bulk/metadata', auth, async (req, res) => {
  const knex = req.knex;
  const { document_ids, metadata } = req.body;

  // Validate caseId
  if (!req.params.caseId || isNaN(req.params.caseId)) {
    return res.status(400).json({ error: 'Invalid case ID provided' });
  }

  // Validate document_ids
  if (!document_ids || !Array.isArray(document_ids) || document_ids.length === 0) {
    return res.status(400).json({ 
      error: 'document_ids array is required and must not be empty' 
    });
  }

  if (document_ids.length > 100) {
    return res.status(400).json({ 
      error: 'Maximum 100 documents can be updated at once' 
    });
  }

  // Validate all IDs are numbers
  if (!document_ids.every(id => typeof id === 'number' || !isNaN(id))) {
    return res.status(400).json({ error: 'All document IDs must be valid numbers' });
  }

  // Validate metadata object
  if (!metadata || typeof metadata !== 'object') {
    return res.status(400).json({ error: 'metadata object is required' });
  }

  try {
    // Verify all documents exist and belong to the case
    const existingDocs = await knex('documents')
      .whereIn('id', document_ids)
      .where({ case_id: req.params.caseId })
      .select('id');
    
    if (existingDocs.length !== document_ids.length) {
      return res.status(400).json({ 
        error: 'Some documents not found or do not belong to this case',
        found: existingDocs.length,
        requested: document_ids.length
      });
    }

    // Validate metadata fields
    if (metadata.legal_category && !LEGAL_CATEGORIES.includes(metadata.legal_category)) {
      return res.status(400).json({ 
        error: 'Invalid legal category',
        validOptions: LEGAL_CATEGORIES
      });
    }

    if (metadata.evidence_type && !EVIDENCE_TYPES.includes(metadata.evidence_type)) {
      return res.status(400).json({ 
        error: 'Invalid evidence type',
        validOptions: EVIDENCE_TYPES
      });
    }

    const updateData = { updated_at: knex.fn.now() };
    
    if (metadata.case_number !== undefined) updateData.case_number = metadata.case_number || null;
    if (metadata.witness_name !== undefined) updateData.witness_name = metadata.witness_name || null;
    if (metadata.evidence_type !== undefined) updateData.evidence_type = metadata.evidence_type || null;
    if (metadata.legal_category !== undefined) updateData.legal_category = metadata.legal_category || null;
    
    if (metadata.tags !== undefined) {
      if (!Array.isArray(metadata.tags)) {
        return res.status(400).json({ error: 'Tags must be an array' });
      }
      
      const uniqueTags = [...new Set(
        metadata.tags
          .filter(tag => typeof tag === 'string')
          .map(tag => tag.trim().toLowerCase())
          .filter(tag => tag.length > 0 && tag.length <= 50)
      )];
      
      if (uniqueTags.length > 50) {
        return res.status(400).json({ error: 'Maximum 50 tags allowed' });
      }
      
      updateData.tags = JSON.stringify(uniqueTags);
    }

    // Check if there's actually something to update
    if (Object.keys(updateData).length === 1) {
      return res.status(400).json({ 
        error: 'No metadata fields provided to update' 
      });
    }

    const updated = await knex('documents')
      .whereIn('id', document_ids)
      .where({ case_id: req.params.caseId })
      .update(updateData);

    res.json({
      success: true,
      updated_count: updated
    });
  } catch (e) {
    logger.error('Error bulk updating metadata', { error: e.message, stack: e.stack, documentIds: req.body.document_ids, caseId: req.params.caseId, userId: req.user?.id });
    res.status(500).json({ 
      error: 'Failed to update document metadata', 
      details: process.env.NODE_ENV === 'development' ? e.message : undefined 
    });
  }
});

// Update document metadata
router.patch('/case/:caseId/documents/:docId/metadata', auth, async (req, res) => {
  const knex = req.knex;
  const { 
    case_number, 
    witness_name, 
    evidence_type, 
    legal_category,
    tags,
    custom_metadata 
  } = req.body;

  // Validate IDs
  if (!req.params.caseId || isNaN(req.params.caseId)) {
    return res.status(400).json({ error: 'Invalid case ID provided' });
  }
  if (!req.params.docId || isNaN(req.params.docId)) {
    return res.status(400).json({ error: 'Invalid document ID provided' });
  }

  try {
    // Check if document exists and belongs to case
    const doc = await knex('documents')
      .where({ id: req.params.docId, case_id: req.params.caseId })
      .first();
    
    if (!doc) {
      return res.status(404).json({ 
        error: 'Document not found or does not belong to this case' 
      });
    }

    // Validate legal category if provided
    if (legal_category && legal_category !== '' && !LEGAL_CATEGORIES.includes(legal_category)) {
      return res.status(400).json({ 
        error: 'Invalid legal category',
        validOptions: LEGAL_CATEGORIES
      });
    }

    // Validate evidence type if provided
    if (evidence_type && evidence_type !== '' && !EVIDENCE_TYPES.includes(evidence_type)) {
      return res.status(400).json({ 
        error: 'Invalid evidence type',
        validOptions: EVIDENCE_TYPES
      });
    }

    // Validate witness name length
    if (witness_name && witness_name.length > 255) {
      return res.status(400).json({ 
        error: 'Witness name must be less than 255 characters' 
      });
    }

    // Validate case number format
    if (case_number && case_number.length > 100) {
      return res.status(400).json({ 
        error: 'Case number must be less than 100 characters' 
      });
    }

    // Validate and deduplicate tags
    let processedTags = null;
    if (tags !== undefined) {
      try {
        const tagArray = Array.isArray(tags) ? tags : JSON.parse(tags);
        
        if (!Array.isArray(tagArray)) {
          return res.status(400).json({ error: 'Tags must be an array' });
        }
        
        // Validate tag count
        if (tagArray.length > 50) {
          return res.status(400).json({ 
            error: 'Maximum 50 tags allowed per document' 
          });
        }
        
        // Remove duplicates and empty strings, trim whitespace
        const uniqueTags = [...new Set(
          tagArray
            .filter(tag => typeof tag === 'string')
            .map(tag => tag.trim().toLowerCase())
            .filter(tag => tag.length > 0 && tag.length <= 50)
        )];
        
        processedTags = JSON.stringify(uniqueTags);
      } catch (parseError) {
        return res.status(400).json({ 
          error: 'Invalid tags format', 
          details: 'Tags must be a valid JSON array of strings' 
        });
      }
    }

    // Validate custom metadata
    if (custom_metadata !== undefined) {
      try {
        if (typeof custom_metadata !== 'object') {
          return res.status(400).json({ 
            error: 'Custom metadata must be an object' 
          });
        }
        JSON.stringify(custom_metadata); // Test if serializable
      } catch (e) {
        return res.status(400).json({ 
          error: 'Invalid custom metadata format' 
        });
      }
    }

    const updateData = {};
    if (case_number !== undefined) updateData.case_number = case_number || null;
    if (witness_name !== undefined) updateData.witness_name = witness_name || null;
    if (evidence_type !== undefined) updateData.evidence_type = evidence_type || null;
    if (legal_category !== undefined) updateData.legal_category = legal_category || null;
    if (processedTags !== null) updateData.tags = processedTags;
    if (custom_metadata !== undefined) {
      updateData.custom_metadata = JSON.stringify(custom_metadata);
    }
    updateData.updated_at = knex.fn.now();

    // Check if there's actually something to update
    if (Object.keys(updateData).length === 1) { // only updated_at
      return res.status(400).json({ 
        error: 'No metadata fields provided to update' 
      });
    }

    const updateCount = await knex('documents')
      .where({ id: req.params.docId, case_id: req.params.caseId })
      .update(updateData);

    if (updateCount === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const updated = await knex('documents')
      .where({ id: req.params.docId })
      .first();

    res.json({
      success: true,
      document: updated
    });
  } catch (e) {
    logger.error('Error updating document metadata', { error: e.message, stack: e.stack, docId: req.params.docId, caseId: req.params.caseId, userId: req.user?.id });
    res.status(500).json({ 
      error: 'Failed to update document metadata', 
      details: process.env.NODE_ENV === 'development' ? e.message : undefined 
    });
  }
});

// Search documents by metadata
router.post('/case/:caseId/documents/search', auth, async (req, res) => {
  const knex = req.knex;
  const { 
    legal_category, 
    evidence_type, 
    witness_name, 
    tags,
    case_number,
    name_keyword,
    file_type,
    size_min,
    size_max,
    date_from,
    date_to,
    sort_by = 'created_at',
    sort_order = 'desc',
    limit = 100,
    offset = 0
  } = req.body;

  // Validate caseId
  if (!req.params.caseId || isNaN(req.params.caseId)) {
    return res.status(400).json({ error: 'Invalid case ID provided' });
  }

  try {
    // Verify case exists
    const caseExists = await knex('cases')
      .where({ id: req.params.caseId })
      .first();
    
    if (!caseExists) {
      return res.status(404).json({ error: 'Case not found' });
    }

    // Validate search parameters
    if (legal_category && typeof legal_category !== 'string') {
      return res.status(400).json({ error: 'legal_category must be a string' });
    }
    
    if (evidence_type && typeof evidence_type !== 'string') {
      return res.status(400).json({ error: 'evidence_type must be a string' });
    }
    
    if (witness_name && typeof witness_name !== 'string') {
      return res.status(400).json({ error: 'witness_name must be a string' });
    }
    
    if (case_number && typeof case_number !== 'string') {
      return res.status(400).json({ error: 'case_number must be a string' });
    }
    
    if (tags !== undefined) {
      if (!Array.isArray(tags)) {
        return res.status(400).json({ error: 'tags must be an array' });
      }
      if (tags.length > 20) {
        return res.status(400).json({ 
          error: 'Maximum 20 tags allowed in search query' 
        });
      }
      if (!tags.every(tag => typeof tag === 'string')) {
        return res.status(400).json({ error: 'All tags must be strings' });
      }
    }

    // Validate pagination
    const parsedLimit = parseInt(limit);
    const parsedOffset = parseInt(offset);
    
    if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 1000) {
      return res.status(400).json({ 
        error: 'limit must be a number between 1 and 1000' 
      });
    }
    
    if (isNaN(parsedOffset) || parsedOffset < 0) {
      return res.status(400).json({ 
        error: 'offset must be a non-negative number' 
      });
    }

    // Validate sort parameters
    const allowedSortFields = ['name', 'created_at', 'updated_at', 'size', 'legal_category'];
    const allowedSortOrders = ['asc', 'desc'];
    
    if (!allowedSortFields.includes(sort_by)) {
      return res.status(400).json({ 
        error: 'Invalid sort_by field',
        validOptions: allowedSortFields
      });
    }
    
    if (!allowedSortOrders.includes(sort_order.toLowerCase())) {
      return res.status(400).json({ 
        error: 'Invalid sort_order',
        validOptions: allowedSortOrders
      });
    }

    // Check if at least one search criterion is provided
    const hasSearchCriteria = legal_category || evidence_type || witness_name || 
                             case_number || (tags && tags.length > 0) || name_keyword ||
                             file_type || size_min !== undefined || size_max !== undefined ||
                             date_from || date_to;
    
    if (!hasSearchCriteria) {
      return res.status(400).json({ 
        error: 'At least one search criterion is required',
        validFields: ['legal_category', 'evidence_type', 'witness_name', 'case_number', 'tags', 'name_keyword', 'file_type', 'size_min', 'size_max', 'date_from', 'date_to']
      });
    }

    let query = knex('documents').where({ case_id: req.params.caseId });

    if (legal_category) {
      query = query.where({ legal_category });
    }
    if (evidence_type) {
      query = query.where({ evidence_type });
    }
    if (witness_name) {
      // Case-insensitive search for witness name
      query = query.whereRaw('LOWER(witness_name) = LOWER(?)', [witness_name]);
    }
    if (case_number) {
      // Case-insensitive partial match for case number
      query = query.whereRaw('LOWER(case_number) LIKE LOWER(?)', [`%${case_number}%`]);
    }
    if (name_keyword) {
      // Case-insensitive partial match for document name
      query = query.whereRaw('LOWER(name) LIKE LOWER(?)', [`%${name_keyword}%`]);
    }
    if (file_type) {
      query = query.where({ file_type });
    }
    if (size_min !== undefined && size_min !== null) {
      query = query.where('size', '>=', size_min);
    }
    if (size_max !== undefined && size_max !== null) {
      query = query.where('size', '<=', size_max);
    }
    if (date_from) {
      query = query.where('created_at', '>=', date_from);
    }
    if (date_to) {
      // Include the entire day by adding time
      query = query.where('created_at', '<=', `${date_to} 23:59:59`);
    }
    if (tags && tags.length > 0) {
      // Search for documents that have ANY of the specified tags
      query = query.where(function() {
        tags.forEach(tag => {
          this.orWhereRaw('tags::jsonb @> ?', [JSON.stringify([tag.toLowerCase()])]);
        });
      });
    }

    // Get total count before pagination
    const countQuery = query.clone().count('* as total');
    const [{ total }] = await countQuery;

    // Apply sorting and pagination
    const results = await query
      .orderBy(sort_by, sort_order)
      .limit(parsedLimit)
      .offset(parsedOffset);

    res.json({ 
      documents: results,
      pagination: {
        total: parseInt(total),
        limit: parsedLimit,
        offset: parsedOffset,
        returned: results.length
      }
    });
  } catch (e) {
    logger.error('Error searching documents', { error: e.message, stack: e.stack, caseId: req.params.caseId, searchParams: req.body, userId: req.user?.id });
    res.status(500).json({ 
      error: 'Failed to search documents', 
      details: process.env.NODE_ENV === 'development' ? e.message : undefined 
    });
  }
});

module.exports = router;

/**
 * GDPR/CCPA Privacy Compliance API
 * Endpoints for data export, deletion requests, and consent management
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

// GDPR Art. 15 / CCPA § 1798.110 - Right to Access
// Export all user data in machine-readable format
router.get('/export', auth, async (req, res) => {
  const knex = req.knex;
  const userId = req.user.id;

  try {
    // Get user profile
    const user = await knex('users')
      .where({ id: userId })
      .select('id', 'name', 'email', 'role', 'created_at')
      .first();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get all cases user is assigned to or created
    const cases = await knex('cases')
      .where('assigned_to', user.name)
      .whereNull('deleted_at')
      .select('id', 'case_number', 'case_name', 'status', 'disposition', 'created_at', 'updated_at');

    // Get all documents uploaded by this user
    const documents = await knex('documents')
      .where('uploaded_by', user.name)
      .whereNull('deleted_at')
      .select('id', 'name', 'file_type', 'file_size', 'case_id', 'uploaded_at', 'tags', 'notes');

    // Get audit logs related to this user
    const auditLogs = await knex('audit_logs')
      .where('user', user.name)
      .whereNot('anonymized', true)
      .orderBy('timestamp', 'desc')
      .limit(1000) // Limit to recent 1000 actions
      .select('action', 'object_type', 'object_id', 'details', 'timestamp');

    // Get notifications for this user
    const notifications = await knex('notifications')
      .where('user_id', userId)
      .orderBy('created_at', 'desc')
      .select('type', 'message', 'case_id', 'read', 'created_at');

    // Get notification preferences
    const notificationPrefs = await knex('notification_preferences')
      .where('user_id', userId)
      .first();

    // Get any data subject requests
    const dataRequests = await knex('data_subject_requests')
      .where('user_id', userId)
      .select('request_type', 'status', 'user_reason', 'requested_at', 'processed_at', 'completed_at');

    // Get consent history
    const consentHistory = await knex('consent_log')
      .where('user_id', userId)
      .orderBy('timestamp', 'desc')
      .select('consent_type', 'granted', 'version', 'timestamp');

    // Build complete export
    const exportData = {
      export_metadata: {
        export_date: new Date().toISOString(),
        export_format: 'JSON',
        user_id: userId,
        export_purpose: 'GDPR/CCPA Right to Access',
        data_controller: 'eDiscovery Case Management System'
      },
      personal_information: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        account_created: user.created_at
      },
      cases: cases.map(c => ({
        case_id: c.id,
        case_number: c.case_number,
        case_name: c.case_name,
        status: c.status,
        disposition: c.disposition,
        created_at: c.created_at,
        updated_at: c.updated_at
      })),
      documents: documents.map(d => ({
        document_id: d.id,
        filename: d.name,
        file_type: d.file_type,
        file_size_bytes: d.file_size,
        case_id: d.case_id,
        uploaded_at: d.uploaded_at,
        tags: d.tags ? JSON.parse(d.tags) : [],
        notes: d.notes
      })),
      activity_logs: auditLogs.map(log => ({
        action: log.action,
        object_type: log.object_type,
        object_id: log.object_id,
        details: log.details,
        timestamp: log.timestamp
      })),
      notifications: notifications.map(n => ({
        type: n.type,
        message: n.message,
        case_id: n.case_id,
        read: n.read,
        created_at: n.created_at
      })),
      notification_preferences: notificationPrefs || {},
      data_subject_requests: dataRequests,
      consent_history: consentHistory,
      statistics: {
        total_cases: cases.length,
        total_documents: documents.length,
        total_notifications: notifications.length,
        account_age_days: Math.floor((new Date() - new Date(user.created_at)) / (1000 * 60 * 60 * 24))
      }
    };

    // Log the export request
    await knex('data_subject_requests').insert({
      user_id: userId,
      request_type: 'export',
      status: 'completed',
      requested_at: knex.fn.now(),
      completed_at: knex.fn.now(),
      export_data: JSON.stringify({ exported: true, records: documents.length + cases.length })
    });

    await knex('audit_logs').insert({
      user: user.name,
      action: 'data_export',
      object_type: 'user',
      object_id: userId,
      details: JSON.stringify({ cases: cases.length, documents: documents.length }),
      timestamp: knex.fn.now()
    });

    // Set headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="user_data_export_${userId}_${Date.now()}.json"`);
    res.json(exportData);

  } catch (err) {
    console.error('Data export error:', err);
    res.status(500).json({ error: 'Failed to export user data', details: err.message });
  }
});

// GDPR Art. 17 / CCPA § 1798.105 - Right to Deletion
// Request account and data deletion
router.post('/delete-request', auth, async (req, res) => {
  const knex = req.knex;
  const userId = req.user.id;
  const { reason } = req.body;

  try {
    // Check if user already has a pending deletion request
    const existingRequest = await knex('data_subject_requests')
      .where({
        user_id: userId,
        request_type: 'deletion',
        status: 'pending'
      })
      .first();

    if (existingRequest) {
      return res.status(400).json({
        error: 'You already have a pending deletion request',
        request_id: existingRequest.id,
        requested_at: existingRequest.requested_at
      });
    }

    // Create deletion request
    const [requestId] = await knex('data_subject_requests').insert({
      user_id: userId,
      request_type: 'deletion',
      status: 'pending',
      user_reason: reason || 'User requested account deletion',
      requested_at: knex.fn.now()
    }).returning('id');

    // Log the request
    await knex('audit_logs').insert({
      user: req.user.name,
      action: 'deletion_request',
      object_type: 'user',
      object_id: userId,
      details: JSON.stringify({ request_id: requestId, reason }),
      timestamp: knex.fn.now()
    });

    res.json({
      message: 'Deletion request submitted successfully',
      request_id: requestId,
      status: 'pending',
      note: 'Your request will be reviewed by an administrator. You will be notified once processed.'
    });

  } catch (err) {
    console.error('Deletion request error:', err);
    res.status(500).json({ error: 'Failed to submit deletion request', details: err.message });
  }
});

// Get user's own data subject requests
router.get('/my-requests', auth, async (req, res) => {
  const knex = req.knex;
  const userId = req.user.id;

  try {
    const requests = await knex('data_subject_requests')
      .where({ user_id: userId })
      .orderBy('requested_at', 'desc')
      .select('id', 'request_type', 'status', 'user_reason', 'admin_notes', 'requested_at', 'processed_at', 'completed_at');

    res.json({
      total: requests.length,
      requests
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Record privacy policy acceptance
router.post('/consent/privacy-policy', auth, async (req, res) => {
  const knex = req.knex;
  const userId = req.user.id;
  const { version, ip_address, user_agent } = req.body;

  try {
    // Update user record
    await knex('users')
      .where({ id: userId })
      .update({
        privacy_policy_accepted: true,
        privacy_policy_accepted_at: knex.fn.now(),
        privacy_policy_version: version || '1.0'
      });

    // Log consent
    await knex('consent_log').insert({
      user_id: userId,
      consent_type: 'privacy_policy',
      granted: true,
      version: version || '1.0',
      ip_address: ip_address || req.ip,
      user_agent: user_agent || req.headers['user-agent'],
      timestamp: knex.fn.now()
    });

    res.json({
      message: 'Privacy policy acceptance recorded',
      version: version || '1.0',
      accepted_at: new Date().toISOString()
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- ADMIN/MANAGER ENDPOINTS ---

// Get all data subject requests (admins and managers only)
router.get('/admin/requests', auth, requireRole('admin', 'manager'), async (req, res) => {
  const knex = req.knex;
  const { status, type } = req.query;

  try {
    let query = knex('data_subject_requests')
      .join('users', 'data_subject_requests.user_id', 'users.id')
      .select(
        'data_subject_requests.*',
        'users.name as user_name',
        'users.email as user_email'
      )
      .orderBy('data_subject_requests.requested_at', 'desc');

    if (status) {
      query = query.where('data_subject_requests.status', status);
    }

    if (type) {
      query = query.where('data_subject_requests.request_type', type);
    }

    const requests = await query;

    res.json({
      total: requests.length,
      requests
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Process data subject request (approve/reject) (admins and managers only)
router.patch('/admin/requests/:requestId', auth, requireRole('admin', 'manager'), async (req, res) => {
  const knex = req.knex;
  const { requestId } = req.params;
  const { status, admin_notes } = req.body;

  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Status must be "approved" or "rejected"' });
  }

  try {
    const request = await knex('data_subject_requests')
      .where({ id: requestId })
      .first();

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Request already processed' });
    }

    // Update request
    await knex('data_subject_requests')
      .where({ id: requestId })
      .update({
        status,
        admin_notes,
        processed_by_user_id: req.user.id,
        processed_at: knex.fn.now()
      });

    // If approved deletion request, mark for completion
    if (status === 'approved' && request.request_type === 'deletion') {
      // Actual deletion happens via separate endpoint for safety
      await knex('audit_logs').insert({
        user: req.user.name,
        action: 'deletion_request_approved',
        object_type: 'user',
        object_id: request.user_id,
        details: JSON.stringify({ request_id: requestId, admin_notes }),
        timestamp: knex.fn.now()
      });
    }

    res.json({
      message: `Request ${status}`,
      request_id: requestId,
      status
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Execute approved deletion request (admins only - most sensitive operation)
router.delete('/admin/requests/:requestId/execute', auth, requireRole('admin', 'manager'), async (req, res) => {
  const knex = req.knex;
  const { requestId } = req.params;

  try {
    const request = await knex('data_subject_requests')
      .where({ id: requestId })
      .first();

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.request_type !== 'deletion') {
      return res.status(400).json({ error: 'Only deletion requests can be executed' });
    }

    if (request.status !== 'approved') {
      return res.status(400).json({ error: 'Request must be approved before execution' });
    }

    const userId = request.user_id;

    // Get user name before deletion
    const user = await knex('users').where({ id: userId }).first();
    const userName = user.name;

    // Soft delete user
    await knex('users')
      .where({ id: userId })
      .update({
        deleted_at: knex.fn.now(),
        deletion_reason: 'user_request'
      });

    // Anonymize audit logs
    await knex('audit_logs')
      .where(function() {
        this.where('user_id', userId)
          .orWhere('user', userName);
      })
      .update({
        user: '[DELETED USER]',
        anonymized: true
      });

    // Mark request as completed
    await knex('data_subject_requests')
      .where({ id: requestId })
      .update({
        status: 'completed',
        completed_at: knex.fn.now()
      });

    // Log action
    await knex('data_retention_log').insert({
      action: 'user_deleted',
      user_id: userId,
      details: JSON.stringify({ request_id: requestId, trigger: 'gdpr_deletion_request' }),
      triggered_by: 'user_request',
      performed_by_user: req.user.name,
      executed_at: knex.fn.now()
    });

    res.json({
      message: 'User data deleted successfully',
      user_id: userId,
      request_id: requestId
    });

  } catch (err) {
    console.error('Deletion execution error:', err);
    res.status(500).json({ error: 'Failed to execute deletion', details: err.message });
  }
});

module.exports = router;

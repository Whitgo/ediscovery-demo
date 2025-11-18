const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const logger = require('../utils/logger');

// Get user's notifications (users and managers only)
router.get('/', auth, requireRole('admin', 'manager', 'user'), async (req, res) => {
  const knex = req.knex;

  try {
    const notifications = await knex('notifications')
      .where({ user_id: req.user.id })
      .orderBy('created_at', 'desc')
      .limit(50);
    
    res.json(notifications);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get unread count (users and managers only)
router.get('/unread/count', auth, requireRole('admin', 'manager', 'user'), async (req, res) => {
  const knex = req.knex;

  try {
    const result = await knex('notifications')
      .where({ user_id: req.user.id, read: false })
      .count('id as count')
      .first();
    
    res.json({ count: parseInt(result.count) || 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Mark notification as read (users and managers only)
router.patch('/:id/read', auth, requireRole('admin', 'manager', 'user'), async (req, res) => {
  const knex = req.knex;

  try {
    const notification = await knex('notifications')
      .where({ id: req.params.id, user_id: req.user.id })
      .first();
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    await knex('notifications')
      .where({ id: req.params.id })
      .update({ read: true });
    
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Mark all notifications as read (users and managers only)
router.patch('/read-all', auth, requireRole('admin', 'manager', 'user'), async (req, res) => {
  const knex = req.knex;

  try {
    await knex('notifications')
      .where({ user_id: req.user.id, read: false })
      .update({ read: true });
    
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get user's notification preferences (users and managers only)
router.get('/preferences', auth, requireRole('admin', 'manager', 'user'), async (req, res) => {
  const knex = req.knex;

  try {
    let prefs = await knex('notification_preferences')
      .where({ user_id: req.user.id })
      .first();
    
    // Create default preferences if none exist
    if (!prefs) {
      await knex('notification_preferences').insert({
        user_id: req.user.id,
        document_uploads_enabled: true,
        exports_enabled: true,
        case_updates_enabled: true,
        only_assigned_cases: true,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      });
      
      prefs = await knex('notification_preferences')
        .where({ user_id: req.user.id })
        .first();
    }
    
    res.json(prefs);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update user's notification preferences (users and managers only)
router.patch('/preferences', auth, requireRole('admin', 'manager', 'user'), async (req, res) => {
  const knex = req.knex;

  const { document_uploads_enabled, exports_enabled, case_updates_enabled, only_assigned_cases } = req.body;

  try {
    // Check if preferences exist
    const existing = await knex('notification_preferences')
      .where({ user_id: req.user.id })
      .first();
    
    if (existing) {
      // Update existing preferences
      await knex('notification_preferences')
        .where({ user_id: req.user.id })
        .update({
          document_uploads_enabled: document_uploads_enabled !== undefined ? document_uploads_enabled : existing.document_uploads_enabled,
          exports_enabled: exports_enabled !== undefined ? exports_enabled : existing.exports_enabled,
          case_updates_enabled: case_updates_enabled !== undefined ? case_updates_enabled : existing.case_updates_enabled,
          only_assigned_cases: only_assigned_cases !== undefined ? only_assigned_cases : existing.only_assigned_cases,
          updated_at: knex.fn.now()
        });
    } else {
      // Create new preferences
      await knex('notification_preferences').insert({
        user_id: req.user.id,
        document_uploads_enabled: document_uploads_enabled !== undefined ? document_uploads_enabled : true,
        exports_enabled: exports_enabled !== undefined ? exports_enabled : true,
        case_updates_enabled: case_updates_enabled !== undefined ? case_updates_enabled : true,
        only_assigned_cases: only_assigned_cases !== undefined ? only_assigned_cases : true,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      });
    }
    
    res.json({ success: true, message: 'Preferences updated' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Delete a notification (users and managers only)
router.delete('/:id', auth, requireRole('admin', 'manager', 'user'), async (req, res) => {
  const knex = req.knex;

  try {
    const notification = await knex('notifications')
      .where({ id: req.params.id, user_id: req.user.id })
      .first();
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    await knex('notifications').where({ id: req.params.id }).del();
    
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Helper function to create notification (used by other APIs)
async function createNotification(knex, { userId, type, title, message, caseId, documentId, metadata }) {
  try {
    await knex('notifications').insert({
      user_id: userId,
      type,
      title,
      message,
      case_id: caseId || null,
      document_id: documentId || null,
      metadata: metadata ? JSON.stringify(metadata) : null,
      read: false,
      created_at: knex.fn.now()
    });
  } catch (e) {
    logger.error('Failed to create notification', { error: e.message, stack: e.stack, userId, type, caseId, documentId });
  }
}

// Helper to notify users assigned to a case
async function notifyUsersInCase(knex, caseId, notification) {
  try {
    // Get case info to find assigned user
    const caseInfo = await knex('cases').where({ id: caseId }).first();
    if (!caseInfo) return;

    // Get all users and managers with their preferences
    const usersWithPrefs = await knex('users')
      .leftJoin('notification_preferences', 'users.id', 'notification_preferences.user_id')
      .whereIn('users.role', ['user', 'manager'])
      .select(
        'users.id',
        'users.name',
        'users.role',
        'notification_preferences.document_uploads_enabled',
        'notification_preferences.exports_enabled',
        'notification_preferences.case_updates_enabled',
        'notification_preferences.only_assigned_cases'
      );
    
    const notifications = [];
    
    for (const user of usersWithPrefs) {
      // Default to enabled if no preferences set
      const documentUploadsEnabled = user.document_uploads_enabled !== false;
      const exportsEnabled = user.exports_enabled !== false;
      const caseUpdatesEnabled = user.case_updates_enabled !== false;
      const onlyAssignedCases = user.only_assigned_cases !== false;
      
      // Check if user wants notifications for this type
      let shouldNotify = false;
      if (notification.type === 'document_uploaded' && documentUploadsEnabled) {
        shouldNotify = true;
      } else if (notification.type === 'export_completed' && exportsEnabled) {
        shouldNotify = true;
      } else if (notification.type === 'case_updated' && caseUpdatesEnabled) {
        shouldNotify = true;
      }
      
      if (!shouldNotify) continue;
      
      // If only_assigned_cases is enabled, check if this case is assigned to them
      if (onlyAssignedCases) {
        if (caseInfo.assigned_to !== user.name) {
          continue; // Skip this user
        }
      }
      
      notifications.push({
        user_id: user.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        case_id: caseId,
        document_id: notification.documentId || null,
        metadata: notification.metadata ? JSON.stringify(notification.metadata) : null,
        read: false,
        created_at: knex.fn.now()
      });
    }
    
    if (notifications.length > 0) {
      await knex('notifications').insert(notifications);
    }
  } catch (e) {
    logger.error('Failed to notify users', { error: e.message, stack: e.stack, caseId, notificationType: notification.type });
  }
}

module.exports = router;
module.exports.createNotification = createNotification;
module.exports.notifyUsersInCase = notifyUsersInCase;

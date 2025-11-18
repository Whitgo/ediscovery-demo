/**
 * Incident Response API
 * GDPR Article 33 - 72-hour breach notification compliance
 */

const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { 
  createIncident, 
  updateIncidentStatus,
  checkNotificationDeadlines 
} = require('../utils/incidentDetection');
const { 
  sendRegulatoryBreachNotification,
  sendUserBreachNotification 
} = require('../utils/emailService');
const logger = require('../utils/logger');

/**
 * Helper to log audit events
 */
async function logAuditEvent(knex, { user, action, object_type, object_id, details }) {
  await knex('audit_logs').insert({
    user,
    action,
    object_type,
    object_id,
    details,
    timestamp: new Date()
  });
}

/**
 * GET /api/incidents
 * List all incidents with filtering
 */
router.get('/', authenticate, requireRole('manager', 'admin'), async (req, res) => {
  const knex = req.knex;
  const { status, severity, is_data_breach, requires_notification, page = 1, limit = 50 } = req.query;
  
  try {
    let query = knex('incidents')
      .leftJoin('incident_types', 'incidents.type_id', 'incident_types.id')
      .leftJoin('users as reported_by', 'incidents.reported_by_user_id', 'reported_by.id')
      .leftJoin('users as assigned_to', 'incidents.assigned_to_user_id', 'assigned_to.id')
      .select(
        'incidents.*',
        'incident_types.name as type_name',
        'incident_types.category as type_category',
        'reported_by.name as reported_by_name',
        'reported_by.email as reported_by_email',
        'assigned_to.name as assigned_to_name',
        'assigned_to.email as assigned_to_email'
      );
    
    if (status) query = query.where('incidents.status', status);
    if (severity) query = query.where('incidents.severity', severity);
    if (is_data_breach !== undefined) query = query.where('incidents.is_data_breach', is_data_breach === 'true');
    if (requires_notification !== undefined) query = query.where('incidents.requires_notification', requires_notification === 'true');
    
    const offset = (page - 1) * limit;
    const incidents = await query
      .orderBy('incidents.detected_at', 'desc')
      .limit(limit)
      .offset(offset);
    
    // Get total count
    const countQuery = knex('incidents').count('* as count');
    if (status) countQuery.where('status', status);
    if (severity) countQuery.where('severity', severity);
    if (is_data_breach !== undefined) countQuery.where('is_data_breach', is_data_breach === 'true');
    if (requires_notification !== undefined) countQuery.where('requires_notification', requires_notification === 'true');
    
    const [{ count: total }] = await countQuery;
    
    // Calculate notification status for each incident
    const now = new Date();
    const enrichedIncidents = incidents.map(incident => {
      let notification_status = null;
      let hours_until_deadline = null;
      let deadline_passed = false;
      
      if (incident.requires_notification && incident.notification_deadline) {
        const deadline = new Date(incident.notification_deadline);
        hours_until_deadline = Math.floor((deadline - now) / (60 * 60 * 1000));
        deadline_passed = hours_until_deadline < 0;
        
        if (incident.notification_completed) {
          notification_status = 'completed';
        } else if (deadline_passed) {
          notification_status = 'overdue';
        } else if (hours_until_deadline <= 12) {
          notification_status = 'urgent';
        } else {
          notification_status = 'pending';
        }
      }
      
      return {
        ...incident,
        notification_status,
        hours_until_deadline,
        deadline_passed
      };
    });
    
    res.json({
      incidents: enrichedIncidents,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(total),
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    logger.error('Error fetching incidents', { error: error.message, stack: error.stack, query: req.query, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to fetch incidents' });
  }
});

/**
 * GET /api/incidents/dashboard
 * Get incident dashboard statistics
 */
router.get('/dashboard', authenticate, requireRole('manager', 'admin'), async (req, res) => {
  const knex = req.knex;
  
  try {
    const [stats] = await knex.raw(`
      SELECT
        COUNT(*) as total_incidents,
        COUNT(CASE WHEN status IN ('open', 'investigating') THEN 1 END) as active_incidents,
        COUNT(CASE WHEN is_data_breach = true THEN 1 END) as data_breaches,
        COUNT(CASE WHEN requires_notification = true AND notification_completed = false THEN 1 END) as pending_notifications,
        COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_incidents,
        COUNT(CASE WHEN severity = 'high' THEN 1 END) as high_incidents,
        COUNT(CASE WHEN notification_deadline < NOW() AND notification_completed = false THEN 1 END) as overdue_notifications
      FROM incidents
    `);
    
    // Get recent incidents
    const recentIncidents = await knex('incidents')
      .select('id', 'incident_number', 'title', 'severity', 'status', 'detected_at')
      .orderBy('detected_at', 'desc')
      .limit(5);
    
    // Get urgent notifications
    const urgentNotifications = await knex('incidents')
      .where('requires_notification', true)
      .where('notification_completed', false)
      .whereNotNull('notification_deadline')
      .where('notification_deadline', '>', knex.fn.now())
      .select('id', 'incident_number', 'title', 'notification_deadline')
      .orderBy('notification_deadline', 'asc')
      .limit(5);
    
    res.json({
      statistics: stats.rows[0],
      recent_incidents: recentIncidents,
      urgent_notifications: urgentNotifications
    });
    
  } catch (error) {
    logger.error('Error fetching dashboard', { error: error.message, stack: error.stack, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

/**
 * GET /api/incidents/:id
 * Get incident details
 */
router.get('/:id', authenticate, requireRole('manager', 'admin'), async (req, res) => {
  const knex = req.knex;
  const { id } = req.params;
  
  try {
    const incident = await knex('incidents')
      .leftJoin('incident_types', 'incidents.type_id', 'incident_types.id')
      .leftJoin('users as reported_by', 'incidents.reported_by_user_id', 'reported_by.id')
      .leftJoin('users as assigned_to', 'incidents.assigned_to_user_id', 'assigned_to.id')
      .where('incidents.id', id)
      .select(
        'incidents.*',
        'incident_types.name as type_name',
        'incident_types.description as type_description',
        'incident_types.response_template',
        'reported_by.name as reported_by_name',
        'reported_by.email as reported_by_email',
        'assigned_to.name as assigned_to_name',
        'assigned_to.email as assigned_to_email'
      )
      .first();
    
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }
    
    // Get activity timeline
    const activities = await knex('incident_activities')
      .leftJoin('users', 'incident_activities.user_id', 'users.id')
      .where('incident_id', id)
      .select(
        'incident_activities.*',
        'users.name as user_name',
        'users.email as user_email'
      )
      .orderBy('created_at', 'desc');
    
    // Get notifications
    const notifications = await knex('incident_notifications')
      .where('incident_id', id)
      .orderBy('created_at', 'desc');
    
    res.json({
      incident,
      activities,
      notifications
    });
    
  } catch (error) {
    logger.error('Error fetching incident', { error: error.message, stack: error.stack, incidentId: req.params.id, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to fetch incident' });
  }
});

/**
 * POST /api/incidents
 * Create a new incident (manual reporting)
 */
router.post('/', authenticate, requireRole('manager', 'admin'), async (req, res) => {
  const knex = req.knex;
  const userId = req.user.id;
  const {
    type_name,
    title,
    description,
    severity,
    category,
    is_data_breach = false,
    affected_users_count = 0,
    affected_records_count = 0,
    data_types_affected = null,
    metadata = {}
  } = req.body;
  
  try {
    const incident = await createIncident(knex, {
      type_name,
      title,
      description,
      severity,
      category,
      detected_by: 'manual',
      reported_by_user_id: userId,
      is_data_breach,
      requires_notification: is_data_breach, // Auto-require notification for data breaches
      metadata: {
        ...metadata,
        affected_users_count,
        affected_records_count,
        data_types_affected
      }
    });
    
    if (incident) {
      await knex('incidents').where({ id: incident.id }).update({
        affected_users_count,
        affected_records_count,
        data_types_affected
      });
    }
    
    await logAuditEvent(knex, {
      user: req.user.email,
      action: 'manual_incident_created',
      object_type: 'incident',
      object_id: incident.id,
      details: JSON.stringify({ title, severity, is_data_breach })
    });
    
    res.status(201).json({ incident, message: 'Incident created successfully' });
    
  } catch (error) {
    logger.error('Error creating incident', { error: error.message, stack: error.stack, body: req.body, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to create incident' });
  }
});

/**
 * PATCH /api/incidents/:id/status
 * Update incident status
 */
router.patch('/:id/status', authenticate, requireRole('manager', 'admin'), async (req, res) => {
  const knex = req.knex;
  const { id } = req.params;
  const { status, notes } = req.body;
  
  const validStatuses = ['open', 'investigating', 'contained', 'resolved', 'closed'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  
  try {
    const incident = await updateIncidentStatus(knex, id, status, req.user.id, notes);
    
    await logAuditEvent(knex, {
      user: req.user.email,
      action: 'incident_status_updated',
      object_type: 'incident',
      object_id: id,
      details: JSON.stringify({ status, notes })
    });
    
    res.json({ incident, message: 'Status updated successfully' });
    
  } catch (error) {
    logger.error('Error updating status', { error: error.message, stack: error.stack, incidentId: req.params.id, status: req.body.status, userId: req.user?.id });
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/incidents/:id/assign
 * Assign incident to user
 */
router.patch('/:id/assign', authenticate, requireRole('manager', 'admin'), async (req, res) => {
  const knex = req.knex;
  const { id } = req.params;
  const { user_id } = req.body;
  
  try {
    const assignedUser = await knex('users').where({ id: user_id }).first();
    if (!assignedUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    await knex('incidents').where({ id }).update({
      assigned_to_user_id: user_id,
      updated_at: knex.fn.now()
    });
    
    await knex('incident_activities').insert({
      incident_id: id,
      user_id: req.user.id,
      action_type: 'assignment',
      action_description: `Incident assigned to ${assignedUser.name}`,
      new_value: assignedUser.name
    });
    
    res.json({ message: 'Incident assigned successfully' });
    
  } catch (error) {
    logger.error('Error assigning incident', { error: error.message, stack: error.stack, incidentId: req.params.id, assignToUserId: req.body.user_id, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to assign incident' });
  }
});

/**
 * POST /api/incidents/:id/breach-notification
 * Send GDPR breach notification
 */
router.post('/:id/breach-notification', authenticate, requireRole('admin'), async (req, res) => {
  const knex = req.knex;
  const { id } = req.params;
  const {
    recipient_email,
    notification_type = 'regulatory', // regulatory, user, internal
    message,
    method = 'email'
  } = req.body;
  
  try {
    const incident = await knex('incidents').where({ id }).first();
    
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }
    
    if (!incident.requires_notification) {
      return res.status(400).json({ error: 'This incident does not require notification' });
    }
    
    // Create notification record
    const [notification] = await knex('incident_notifications').insert({
      incident_id: id,
      notification_type,
      recipient: recipient_email,
      method,
      message,
      status: 'sent',
      sent_at: knex.fn.now()
    }).returning('*');
    
    // Update notification sent timestamp if it's the first regulatory notification
    if (notification_type === 'regulatory' && !incident.notification_sent_at) {
      await knex('incidents').where({ id }).update({
        notification_sent_at: knex.fn.now(),
        notification_details: message,
        updated_at: knex.fn.now()
      });
    }
    
    await knex('incident_activities').insert({
      incident_id: id,
      user_id: req.user.id,
      action_type: 'notification',
      action_description: `${notification_type} notification sent to ${recipient_email}`,
      metadata: JSON.stringify({ notification_type, method })
    });
    
    // Send actual email based on notification type
    let emailResult;
    try {
      if (notification_type === 'regulatory') {
        emailResult = await sendRegulatoryBreachNotification({
          incident: incidentWithDetails,
          dpaEmail: recipient_email,
          dpaName: 'Data Protection Authority'
        });
      } else if (notification_type === 'user') {
        emailResult = await sendUserBreachNotification({
          incident: incidentWithDetails,
          userEmail: recipient_email,
          userName: 'User'
        });
      } else {
        // For internal/law_enforcement, use generic email format
        const emailService = require('../utils/emailService');
        emailResult = await emailService.sendEmail({
          to: recipient_email,
          subject: `Data Breach Notification - ${incidentWithDetails.incident_number}`,
          html: `<h1>Data Breach Notification</h1><p>${message || incidentWithDetails.description}</p>`
        });
      }
      
      if (emailResult.success) {
        logger.info('Email sent successfully', { recipient: recipient_email, notificationType: notification_type, incidentId: id, userId: req.user?.id });
        
        // Update notification record with delivery confirmation
        await knex('incident_notifications')
          .where({ id: notification.id })
          .update({
            status: 'sent',
            sent_at: new Date(),
            delivery_confirmation: JSON.stringify(emailResult)
          });
      } else {
        logger.warn('Email not sent', { message: emailResult.message || 'Email service not configured', recipient: recipient_email, notificationType: notification_type, incidentId: id });
      }
    } catch (emailError) {
      logger.error('Email sending error', { error: emailError.message, stack: emailError.stack, recipient: recipient_email, notificationType: notification_type, incidentId: id, userId: req.user?.id });
      // Continue even if email fails - record is already created
    }
    
    await logAuditEvent(knex, {
      user: req.user.email,
      action: 'breach_notification_sent',
      object_type: 'incident',
      object_id: id,
      details: JSON.stringify({ recipient: recipient_email, notification_type })
    });
    
    res.json({ 
      notification,
      message: 'Breach notification sent successfully'
    });
    
  } catch (error) {
    logger.error('Error sending notification', { error: error.message, stack: error.stack, incidentId: req.params.id, recipient: req.body.recipient_email, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

/**
 * POST /api/incidents/:id/complete-notification
 * Mark breach notification as complete
 */
router.post('/:id/complete-notification', authenticate, requireRole('admin'), async (req, res) => {
  const knex = req.knex;
  const { id } = req.params;
  const { completion_notes } = req.body;
  
  try {
    await knex('incidents').where({ id }).update({
      notification_completed: true,
      notification_details: knex.raw(`COALESCE(notification_details, '') || ? || ?`, ['\n\nCompletion Notes: ', completion_notes || '']),
      updated_at: knex.fn.now()
    });
    
    await knex('incident_activities').insert({
      incident_id: id,
      user_id: req.user.id,
      action_type: 'notification_completed',
      action_description: 'GDPR breach notification marked as complete',
      metadata: JSON.stringify({ completion_notes })
    });
    
    res.json({ message: 'Notification marked as complete' });
    
  } catch (error) {
    logger.error('Error completing notification', { error: error.message, stack: error.stack, incidentId: req.params.id, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to complete notification' });
  }
});

/**
 * POST /api/incidents/:id/comment
 * Add comment/note to incident
 */
router.post('/:id/comment', authenticate, requireRole('manager', 'admin'), async (req, res) => {
  const knex = req.knex;
  const { id } = req.params;
  const { comment } = req.body;
  
  try {
    await knex('incident_activities').insert({
      incident_id: id,
      user_id: req.user.id,
      action_type: 'comment',
      action_description: comment
    });
    
    res.json({ message: 'Comment added successfully' });
    
  } catch (error) {
    logger.error('Error adding comment', { error: error.message, stack: error.stack, incidentId: req.params.id, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

/**
 * GET /api/incidents/check-deadlines
 * Check for approaching notification deadlines (for scheduled job)
 */
router.get('/admin/check-deadlines', authenticate, requireRole('admin'), async (req, res) => {
  const knex = req.knex;
  
  try {
    const { urgentIncidents, overdueIncidents } = await checkNotificationDeadlines(knex);
    
    res.json({
      urgent_count: urgentIncidents.length,
      overdue_count: overdueIncidents.length,
      urgent_incidents: urgentIncidents,
      overdue_incidents: overdueIncidents
    });
    
  } catch (error) {
    logger.error('Error checking deadlines', { error: error.message, stack: error.stack, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to check deadlines' });
  }
});

module.exports = router;

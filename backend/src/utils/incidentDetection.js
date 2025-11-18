/**
const logger = require('./logger');
 * Incident Detection Utilities
 * Automatically detect security incidents and create incident records
 */

const { sendInternalIncidentAlert } = require('./emailService');

/**
 * Helper to log audit events
 */
async function logAuditEvent(knex, { user, action, object_type, object_id, details }) {
  await knex('audit_logs').insert({
    user,
    action,
    object_type,
    object_id,
    details: details ? JSON.stringify(details) : null,
    timestamp: new Date()
  });
}

/**
 * Detect potential brute force attacks based on failed login attempts
 */
async function detectBruteForce(knex, email, ip) {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  
  // Count failed attempts in last 5 minutes
  const failedAttempts = await knex('audit_logs')
    .where({
      action: 'failed_login',
      user: email
    })
    .where('timestamp', '>=', fiveMinutesAgo)
    .count('* as count');
  
  const count = parseInt(failedAttempts[0].count);
  
  // Threshold: 5 failed attempts in 5 minutes
  if (count >= 5) {
    await createIncident(knex, {
      type_name: 'Unauthorized Access Attempt - Failed',
      title: `Brute Force Attack Detected - ${email}`,
      description: `${count} failed login attempts detected for user ${email} from IP ${ip} in the last 5 minutes.`,
      severity: 'high',
      category: 'brute_force',
      detected_by: 'system',
      metadata: {
        email,
        ip,
        failed_attempts: count,
        detection_window: '5 minutes'
      }
    });
    
    return true;
  }
  
  return false;
}

/**
 * Detect suspicious access patterns (unusual data access)
 */
async function detectSuspiciousAccess(knex, userId, action, metadata = {}) {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  // Check for excessive document access
  if (action === 'document_access') {
    const accessCount = await knex('audit_logs')
      .where({
        user_id: userId,
        action: 'document_access'
      })
      .where('timestamp', '>=', oneHourAgo)
      .count('* as count');
    
    const count = parseInt(accessCount[0].count);
    
    // Threshold: 100 documents accessed in 1 hour
    if (count >= 100) {
      const user = await knex('users').where({ id: userId }).first();
      
      await createIncident(knex, {
        type_name: 'Insider Threat - Suspicious Activity',
        title: `Suspicious Data Access Pattern - User ${user.email}`,
        description: `User accessed ${count} documents in the last hour, which is unusual and may indicate data exfiltration.`,
        severity: 'high',
        category: 'suspicious_access',
        detected_by: 'system',
        reported_by_user_id: userId,
        metadata: {
          user_id: userId,
          user_email: user.email,
          access_count: count,
          detection_window: '1 hour',
          ...metadata
        }
      });
      
      return true;
    }
  }
  
  return false;
}

/**
 * Detect unauthorized access to sensitive data
 */
async function detectUnauthorizedAccess(knex, userId, resourceType, resourceId, requiredRole) {
  const user = await knex('users').where({ id: userId }).first();
  
  if (!user) {
    return false;
  }
  
  // Check if user has required role
  const hasAccess = checkRoleAccess(user.role, requiredRole);
  
  if (!hasAccess) {
    await createIncident(knex, {
      type_name: 'Data Breach - Unauthorized Access',
      title: `Unauthorized Access Attempt - ${user.email}`,
      description: `User with role "${user.role}" attempted to access ${resourceType} ${resourceId} which requires "${requiredRole}" role.`,
      severity: 'critical',
      category: 'unauthorized_access',
      detected_by: 'system',
      reported_by_user_id: userId,
      is_data_breach: true,
      requires_notification: true,
      metadata: {
        user_id: userId,
        user_email: user.email,
        user_role: user.role,
        required_role: requiredRole,
        resource_type: resourceType,
        resource_id: resourceId
      }
    });
    
    return true;
  }
  
  return false;
}

/**
 * Create an incident record
 */
async function createIncident(knex, incidentData) {
  const {
    type_name,
    title,
    description,
    severity,
    category,
    detected_by = 'system',
    reported_by_user_id = null,
    is_data_breach = false,
    requires_notification = false,
    metadata = {}
  } = incidentData;
  
  // Get incident type
  const incidentType = await knex('incident_types')
    .where({ name: type_name })
    .first();
  
  if (!incidentType) {
    logger.error('Incident type not found', { typeName: type_name });
    return null;
  }
  
  // Generate incident number
  const year = new Date().getFullYear();
  const lastIncident = await knex('incidents')
    .where('incident_number', 'like', `INC-${year}-%`)
    .orderBy('id', 'desc')
    .first();
  
  let incidentNumber;
  if (lastIncident) {
    const lastNumber = parseInt(lastIncident.incident_number.split('-')[2]);
    incidentNumber = `INC-${year}-${String(lastNumber + 1).padStart(4, '0')}`;
  } else {
    incidentNumber = `INC-${year}-0001`;
  }
  
  const now = new Date();
  const breachDiscoveredAt = is_data_breach ? now : null;
  const notificationDeadline = is_data_breach && incidentType.notification_deadline_hours
    ? new Date(now.getTime() + incidentType.notification_deadline_hours * 60 * 60 * 1000)
    : null;
  
  // Create incident
  const [incident] = await knex('incidents').insert({
    incident_number: incidentNumber,
    type_id: incidentType.id,
    title,
    description,
    severity,
    category,
    status: 'open',
    is_data_breach,
    requires_notification: requires_notification || incidentType.requires_breach_notification,
    breach_discovered_at: breachDiscoveredAt,
    notification_deadline: notificationDeadline,
    detected_by,
    detected_at: now,
    reported_by_user_id,
    metadata: JSON.stringify(metadata)
  }).returning('*');
  
  // Log activity
  await knex('incident_activities').insert({
    incident_id: incident.id,
    action_type: 'created',
    action_description: `Incident created: ${title}`,
    metadata: JSON.stringify({ detected_by, category })
  });
  
  // Log audit event
  await logAuditEvent(knex, {
    user: detected_by,
    action: 'incident_created',
    object_type: 'incident',
    object_id: incident.id,
    details: JSON.stringify({
      incident_number: incidentNumber,
      title,
      severity,
      is_data_breach,
      requires_notification
    })
  });
  
  logger.info('Incident created', { incidentNumber, title });
  
  // Send notifications if required
  if (requires_notification && notificationDeadline) {
    logger.warn('GDPR Notification deadline', { deadline: notificationDeadline.toISOString() });
    
    // Send email alert to incident response team
    const teamEmails = (process.env.INCIDENT_TEAM_EMAILS || '').split(',').filter(e => e.trim());
    if (teamEmails.length > 0) {
      try {
        await sendInternalIncidentAlert({ incident, teamEmails });
        logger.info('Incident alert sent', { recipientCount: teamEmails.length });
      } catch (emailError) {
        logger.error('Failed to send incident alert email', { error: emailError.message });
      }
    }
  }
  
  return incident;
}

/**
 * Update incident status
 */
async function updateIncidentStatus(knex, incidentId, newStatus, userId, notes = '') {
  const incident = await knex('incidents').where({ id: incidentId }).first();
  
  if (!incident) {
    throw new Error('Incident not found');
  }
  
  const oldStatus = incident.status;
  const now = new Date();
  
  const updateData = {
    status: newStatus,
    updated_at: now
  };
  
  // Set timestamps based on status
  if (newStatus === 'investigating' && !incident.response_started_at) {
    updateData.response_started_at = now;
  } else if (newStatus === 'contained' && !incident.contained_at) {
    updateData.contained_at = now;
  } else if (newStatus === 'resolved' && !incident.resolved_at) {
    updateData.resolved_at = now;
  } else if (newStatus === 'closed' && !incident.closed_at) {
    updateData.closed_at = now;
  }
  
  await knex('incidents').where({ id: incidentId }).update(updateData);
  
  // Log activity
  await knex('incident_activities').insert({
    incident_id: incidentId,
    user_id: userId,
    action_type: 'status_change',
    action_description: notes || `Status changed from ${oldStatus} to ${newStatus}`,
    old_value: oldStatus,
    new_value: newStatus
  });
  
  return await knex('incidents').where({ id: incidentId }).first();
}

/**
 * Check if incident notification deadline is approaching
 */
async function checkNotificationDeadlines(knex) {
  const { sendDeadlineReminder } = require('./emailService');
  const now = new Date();
  const twelveHoursFromNow = new Date(now.getTime() + 12 * 60 * 60 * 1000);
  
  // Find incidents with approaching deadlines
  const urgentIncidents = await knex('incidents')
    .where('requires_notification', true)
    .where('notification_completed', false)
    .where('notification_deadline', '<=', twelveHoursFromNow)
    .where('notification_deadline', '>=', now);
  
  for (const incident of urgentIncidents) {
    const hoursRemaining = Math.floor((new Date(incident.notification_deadline) - now) / (60 * 60 * 1000));
    console.warn(`⚠️  Incident ${incident.incident_number} - Notification deadline in ${hoursRemaining} hours!`);
    
    // Send email reminder to incident response team
    const reminderEmails = (process.env.INCIDENT_TEAM_EMAILS || '').split(',').filter(e => e.trim());
    if (reminderEmails.length > 0) {
      try {
        await sendDeadlineReminder({ incident, reminderEmails, hoursRemaining });
        logger.info('Deadline reminder sent', { incidentNumber: incident.incident_number });
      } catch (emailError) {
        logger.error('Failed to send deadline reminder', { error: emailError.message });
      }
    }
  }
  
  // Find overdue incidents
  const overdueIncidents = await knex('incidents')
    .where('requires_notification', true)
    .where('notification_completed', false)
    .where('notification_deadline', '<', now);
  
  for (const incident of overdueIncidents) {
    console.error(`🚨 OVERDUE: Incident ${incident.incident_number} - Notification deadline passed!`);
    
    // Send escalation email
    const escalationEmails = (process.env.ESCALATION_EMAILS || process.env.INCIDENT_TEAM_EMAILS || '').split(',').filter(e => e.trim());
    if (escalationEmails.length > 0) {
      try {
        await sendDeadlineReminder({ 
          incident, 
          reminderEmails: escalationEmails, 
          hoursRemaining: -Math.floor((now - new Date(incident.notification_deadline)) / (60 * 60 * 1000))
        });
        logger.info('Escalation email sent for overdue incident', { incidentNumber: incident.incident_number });
      } catch (emailError) {
        logger.error('Failed to send escalation email', { error: emailError.message });
      }
    }
  }
  
  return { urgentIncidents, overdueIncidents };
}

/**
 * Simple role access check
 */
function checkRoleAccess(userRole, requiredRole) {
  const roleHierarchy = {
    'viewer': 1,
    'contributor': 2,
    'manager': 3,
    'admin': 4
  };
  
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}

module.exports = {
  detectBruteForce,
  detectSuspiciousAccess,
  detectUnauthorizedAccess,
  createIncident,
  updateIncidentStatus,
  checkNotificationDeadlines
};

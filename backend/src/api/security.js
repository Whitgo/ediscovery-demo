/**
 * Security Monitoring API
 * Real-time security dashboard endpoints for admin monitoring
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

/**
 * GET /api/security/dashboard
 * Get comprehensive security dashboard data
 */
router.get('/dashboard', auth, requireRole('admin', 'manager'), async (req, res) => {
  const knex = req.knex;
  
  try {
    logger.logAudit('security_dashboard_accessed', req.user.id, { ip: req.ip });

    // Get failed login attempts (last 24 hours)
    const failedLogins = await knex('audit_logs')
      .where('action', 'failed_login')
      .where('timestamp', '>', knex.raw("NOW() - INTERVAL '24 hours'"))
      .orderBy('timestamp', 'desc')
      .limit(50);

    // Get failed login count by hour (last 24 hours)
    const failedLoginsByHour = await knex('audit_logs')
      .select(knex.raw("DATE_TRUNC('hour', timestamp) as hour"))
      .count('* as count')
      .where('action', 'failed_login')
      .where('timestamp', '>', knex.raw("NOW() - INTERVAL '24 hours'"))
      .groupBy(knex.raw("DATE_TRUNC('hour', timestamp)"))
      .orderBy('hour', 'asc');

    // Get recent successful logins (last 50)
    const recentLogins = await knex('audit_logs')
      .where('action', 'successful_login')
      .orderBy('timestamp', 'desc')
      .limit(50);

    // Get active sessions count (users logged in within last hour)
    const activeSessions = await knex('audit_logs')
      .select('user')
      .distinct()
      .where('action', 'successful_login')
      .where('timestamp', '>', knex.raw("NOW() - INTERVAL '1 hour'"));

    // Get recent audit activity (last 100 entries)
    const recentActivity = await knex('audit_logs')
      .select('audit_logs.*', 'users.name', 'users.email')
      .leftJoin('users', 'audit_logs.user', 'users.id')
      .orderBy('audit_logs.timestamp', 'desc')
      .limit(100);

    // Get security events (privilege escalation attempts, failed RBAC)
    const securityEvents = await knex('audit_logs')
      .where(function() {
        this.where('action', 'like', '%unauthorized%')
          .orWhere('action', 'like', '%denied%')
          .orWhere('action', 'like', '%forbidden%')
          .orWhereRaw("details::text like '%403%'")
          .orWhereRaw("details::text like '%unauthorized%'");
      })
      .where('timestamp', '>', knex.raw("NOW() - INTERVAL '7 days'"))
      .orderBy('timestamp', 'desc')
      .limit(50);

    // Get top users by activity (last 7 days)
    const topUsers = await knex('audit_logs')
      .select('user', 'users.name', 'users.email', 'users.role')
      .leftJoin('users', 'audit_logs.user', 'users.id')
      .count('* as activity_count')
      .where('audit_logs.timestamp', '>', knex.raw("NOW() - INTERVAL '7 days'"))
      .whereNotNull('user')
      .groupBy('user', 'users.name', 'users.email', 'users.role')
      .orderBy('activity_count', 'desc')
      .limit(10);

    // Get action breakdown (last 24 hours)
    const actionBreakdown = await knex('audit_logs')
      .select('action')
      .count('* as count')
      .where('timestamp', '>', knex.raw("NOW() - INTERVAL '24 hours'"))
      .groupBy('action')
      .orderBy('count', 'desc')
      .limit(15);

    // Get suspicious IPs (multiple failed logins)
    const suspiciousIPs = await knex('audit_logs')
      .select(knex.raw("details::json->>'ip' as ip"))
      .count('* as failed_attempts')
      .where('action', 'failed_login')
      .where('timestamp', '>', knex.raw("NOW() - INTERVAL '24 hours'"))
      .whereRaw("details::json->>'ip' IS NOT NULL")
      .groupBy(knex.raw("details::json->>'ip'"))
      .having(knex.raw('count(*) >= 5'))
      .orderBy('failed_attempts', 'desc');

    // Statistics
    const stats = {
      failedLoginCount24h: failedLogins.length,
      successfulLoginCount24h: recentLogins.length,
      activeSessionCount: activeSessions.length,
      securityEventCount7d: securityEvents.length,
      suspiciousIPCount: suspiciousIPs.length,
      totalActivityCount24h: await knex('audit_logs')
        .where('timestamp', '>', knex.raw("NOW() - INTERVAL '24 hours'"))
        .count('* as count')
        .first()
        .then(r => parseInt(r.count))
    };

    res.json({
      stats,
      failedLogins: failedLogins.slice(0, 20), // Return top 20 for UI
      failedLoginsByHour,
      recentLogins: recentLogins.slice(0, 20),
      recentActivity: recentActivity.slice(0, 50),
      securityEvents: securityEvents.slice(0, 20),
      topUsers,
      actionBreakdown,
      suspiciousIPs
    });

  } catch (error) {
    logger.error('Error fetching security dashboard', { 
      error: error.message, 
      userId: req.user.id 
    });
    res.status(500).json({ error: 'Failed to fetch security dashboard data' });
  }
});

/**
 * GET /api/security/failed-logins
 * Get detailed failed login history
 */
router.get('/failed-logins', auth, requireRole('admin', 'manager'), async (req, res) => {
  const knex = req.knex;
  const { limit = 100, offset = 0, hours = 24 } = req.query;
  
  try {
    // Validate and sanitize inputs
    const safeHours = Math.max(1, Math.min(parseInt(hours) || 24, 8760)); // 1 hour to 1 year max
    const safeLimit = Math.max(1, Math.min(parseInt(limit) || 100, 1000));
    const safeOffset = Math.max(0, parseInt(offset) || 0);
    
    const logs = await knex('audit_logs')
      .where('action', 'failed_login')
      .where('timestamp', '>', knex.raw(`NOW() - INTERVAL '${safeHours} hours'`))
      .orderBy('timestamp', 'desc')
      .limit(safeLimit)
      .offset(safeOffset);

    const total = await knex('audit_logs')
      .where('action', 'failed_login')
      .where('timestamp', '>', knex.raw(`NOW() - INTERVAL '${safeHours} hours'`))
      .count('* as count')
      .first();

    res.json({
      logs,
      total: parseInt(total.count),
      limit: safeLimit,
      offset: safeOffset
    });

  } catch (error) {
    logger.error('Error fetching failed logins', { error: error.message, userId: req.user.id });
    res.status(500).json({ error: 'Failed to fetch failed login data' });
  }
});

/**
 * GET /api/security/audit-logs
 * Get filtered audit logs
 */
router.get('/audit-logs', auth, requireRole('admin', 'manager', 'support'), async (req, res) => {
  const knex = req.knex;
  const { 
    limit = 100, 
    offset = 0, 
    action, 
    user, 
    hours = 24 
  } = req.query;
  
  try {
    // Validate and sanitize inputs
    const safeHours = Math.max(1, Math.min(parseInt(hours) || 24, 8760));
    const safeLimit = Math.max(1, Math.min(parseInt(limit) || 100, 1000));
    const safeOffset = Math.max(0, parseInt(offset) || 0);
    
    let query = knex('audit_logs')
      .select('audit_logs.*', 'users.name', 'users.email', 'users.role')
      .leftJoin('users', 'audit_logs.user', 'users.id')
      .where('audit_logs.timestamp', '>', knex.raw(`NOW() - INTERVAL '${safeHours} hours'`));

    if (action) {
      query = query.where('audit_logs.action', action);
    }

    if (user) {
      query = query.where('audit_logs.user', parseInt(user));
    }

    const logs = await query
      .orderBy('audit_logs.timestamp', 'desc')
      .limit(safeLimit)
      .offset(safeOffset);

    const total = await knex('audit_logs')
      .where('timestamp', '>', knex.raw(`NOW() - INTERVAL '${safeHours} hours'`))
      .modify(qb => {
        if (action) qb.where('action', action);
        if (user) qb.where('user', parseInt(user));
      })
      .count('* as count')
      .first();

    res.json({
      logs,
      total: parseInt(total.count),
      limit: safeLimit,
      offset: safeOffset
    });

  } catch (error) {
    logger.error('Error fetching audit logs', { error: error.message, userId: req.user.id });
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

/**
 * GET /api/security/active-sessions
 * Get list of currently active sessions
 */
router.get('/active-sessions', auth, requireRole('admin', 'manager'), async (req, res) => {
  const knex = req.knex;
  
  try {
    // Get most recent login for each user in the last hour
    const activeSessions = await knex('audit_logs')
      .select(
        'user',
        'users.name',
        'users.email',
        'users.role',
        knex.raw('MAX(audit_logs.timestamp) as last_activity')
      )
      .leftJoin('users', 'audit_logs.user', 'users.id')
      .where('audit_logs.action', 'successful_login')
      .where('audit_logs.timestamp', '>', knex.raw("NOW() - INTERVAL '1 hour'"))
      .whereNotNull('user')
      .groupBy('user', 'users.name', 'users.email', 'users.role')
      .orderBy('last_activity', 'desc');

    res.json({ sessions: activeSessions, count: activeSessions.length });

  } catch (error) {
    logger.error('Error fetching active sessions', { error: error.message, userId: req.user.id });
    res.status(500).json({ error: 'Failed to fetch active sessions' });
  }
});

/**
 * GET /api/security/alerts
 * Get security alerts (repeated failed logins, unauthorized attempts, etc.)
 */
router.get('/alerts', auth, requireRole('admin', 'manager'), async (req, res) => {
  const knex = req.knex;
  
  try {
    const alerts = [];

    // Check for repeated failed logins from same IP
    const suspiciousIPs = await knex('audit_logs')
      .select(knex.raw("details::json->>'ip' as ip"))
      .count('* as attempts')
      .where('action', 'failed_login')
      .where('timestamp', '>', knex.raw("NOW() - INTERVAL '1 hour'"))
      .whereRaw("details::json->>'ip' IS NOT NULL")
      .groupBy(knex.raw("details::json->>'ip'"))
      .having(knex.raw('count(*) >= 5'))
      .orderBy('attempts', 'desc');

    suspiciousIPs.forEach(ip => {
      alerts.push({
        id: `ip-${ip.ip}`,
        type: 'repeated_failed_login',
        severity: ip.attempts >= 10 ? 'high' : 'medium',
        message: `${ip.attempts} failed login attempts from IP ${ip.ip} in the last hour`,
        timestamp: new Date(),
        details: { ip: ip.ip, attempts: ip.attempts }
      });
    });

    // Check for unauthorized access attempts
    const unauthorizedAttempts = await knex('audit_logs')
      .where('timestamp', '>', knex.raw("NOW() - INTERVAL '24 hours'"))
      .where(function() {
        this.where('action', 'like', '%unauthorized%')
          .orWhere('action', 'like', '%denied%')
          .orWhereRaw("details::text like '%403%'");
      })
      .count('* as count')
      .first();

    if (parseInt(unauthorizedAttempts.count) > 20) {
      alerts.push({
        id: 'unauthorized-spike',
        type: 'unauthorized_access_spike',
        severity: 'medium',
        message: `${unauthorizedAttempts.count} unauthorized access attempts in the last 24 hours`,
        timestamp: new Date(),
        details: { count: unauthorizedAttempts.count }
      });
    }

    // Check for database restore operations (high-risk)
    const restoreOps = await knex('audit_logs')
      .where('action', 'like', '%restore%')
      .where('timestamp', '>', knex.raw("NOW() - INTERVAL '24 hours'"))
      .orderBy('timestamp', 'desc')
      .limit(5);

    restoreOps.forEach(op => {
      alerts.push({
        id: `restore-${op.id}`,
        type: 'database_restore',
        severity: 'high',
        message: `Database restore operation performed by ${op.user}`,
        timestamp: op.timestamp,
        details: { user: op.user, action: op.action }
      });
    });

    res.json({ alerts, count: alerts.length });

  } catch (error) {
    logger.error('Error fetching security alerts', { error: error.message, userId: req.user.id });
    res.status(500).json({ error: 'Failed to fetch security alerts' });
  }
});

module.exports = router;

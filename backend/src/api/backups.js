/**
 * Backup Management API
 * Endpoints for backup/restore operations
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const authenticate = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { performBackup, restoreBackup, listBackups, getBackupStats } = require('../utils/backup');
const { runManualBackup } = require('../jobs/backupScheduler');
const { testEmailConfig } = require('../utils/emailService');

/**
 * Get backup statistics
 * GET /api/backups/stats
 */
router.get('/stats', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const stats = await getBackupStats();
    res.json(stats);
  } catch (error) {
    logger.error('Error fetching backup stats', { error: error.message, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to fetch backup statistics' });
  }
});

/**
 * List all available backups
 * GET /api/backups
 */
router.get('/', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const backups = await listBackups();
    res.json({ backups });
  } catch (error) {
    logger.error('Error listing backups', { error: error.message, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to list backups' });
  }
});

/**
 * Create a manual backup
 * POST /api/backups
 */
router.post('/', authenticate, requireRole('admin'), async (req, res) => {
  try {
    logger.logAudit('manual_backup_requested', req.user.id, { timestamp: new Date() });
    
    const result = await runManualBackup();
    
    if (result.success) {
      res.json({
        message: 'Backup completed successfully',
        backup: result
      });
    } else {
      res.status(500).json({
        error: 'Backup failed',
        details: result.error
      });
    }
    
  } catch (error) {
    logger.error('Error creating backup', { error: error.message, userId: req.user.id });
    res.status(500).json({ error: 'Failed to create backup' });
  }
});

/**
 * Restore from latest backup
 * POST /api/backups/restore
 */
router.post('/restore', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { backup_file } = req.body;
    
    logger.logSecurity('database_restore_requested', { userId: req.user.id, backupFile: backup_file });
    
    const result = await restoreBackup(backup_file);
    
    if (result.success) {
      res.json({
        message: 'Database restored successfully',
        restore: result
      });
    } else {
      res.status(500).json({
        error: 'Restore failed',
        details: result.error
      });
    }
    
  } catch (error) {
    logger.error('Error restoring backup', { error: error.message, userId: req.user.id });
    res.status(500).json({ error: 'Failed to restore backup' });
  }
});

/**
 * Download a backup file
 * GET /api/backups/download/:filename
 */
router.get('/download/:filename', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { filename } = req.params;
    const backups = await listBackups();
    
    const backup = backups.find(b => b.filename === filename);
    
    if (!backup) {
      return res.status(404).json({ error: 'Backup file not found' });
    }
    
    res.download(backup.filepath, filename);
    
  } catch (error) {
    logger.error('Error downloading backup', { error: error.message, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to download backup' });
  }
});

/**
 * Test email configuration
 * GET /api/backups/test-email
 */
router.get('/test-email', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const result = await testEmailConfig();
    res.json(result);
  } catch (error) {
    logger.error('Error testing email config', { error: error.message, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to test email configuration' });
  }
});

module.exports = router;

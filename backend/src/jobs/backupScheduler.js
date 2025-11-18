/**
 * Backup Scheduler
 * Runs daily backups at 2 AM
 */

const cron = require('node-cron');
const logger = require('../utils/logger');
const { performBackup, getBackupStats } = require('../utils/backup');

// Run backup daily at 2:00 AM
const BACKUP_SCHEDULE = '0 2 * * *';

/**
 * Start the backup scheduler
 */
function startBackupScheduler() {
  logger.info('Backup scheduler started - Daily backups at 2:00 AM');
  
  // Schedule daily backups
  const task = cron.schedule(BACKUP_SCHEDULE, async () => {
    logger.info('Scheduled backup triggered');
    
    try {
      const result = await performBackup();
      
      if (result.success) {
        logger.info('Scheduled backup completed successfully');
        
        // Log backup statistics
        const stats = await getBackupStats();
        logger.info('Backup stats', { totalBackups: stats.total_backups, totalSizeMB: stats.total_size_mb });
      } else {
        logger.error('Scheduled backup failed', { error: result.error });
      }
      
    } catch (error) {
      logger.error('Scheduled backup error', { error: error.message });
    }
  });
  
  // Log next scheduled run
  logger.info('Next backup scheduled for: 2:00 AM');
  
  return task;
}

/**
 * Run backup immediately (manual trigger)
 */
async function runManualBackup() {
  logger.info('Manual backup triggered');
  
  try {
    const result = await performBackup();
    
    if (result.success) {
      logger.info('Manual backup completed successfully');
      return result;
    } else {
      logger.error('Manual backup failed', { error: result.error });
      throw new Error(result.error);
    }
    
  } catch (error) {
    logger.error('Manual backup error', { error: error.message });
    throw error;
  }
}

module.exports = {
  startBackupScheduler,
  runManualBackup
};

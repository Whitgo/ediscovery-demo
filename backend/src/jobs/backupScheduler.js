/**
 * Backup Scheduler
 * Runs daily backups at 2 AM
 */

const cron = require('node-cron');
const { performBackup, getBackupStats } = require('../utils/backup');

// Run backup daily at 2:00 AM
const BACKUP_SCHEDULE = '0 2 * * *';

/**
 * Start the backup scheduler
 */
function startBackupScheduler() {
  console.log('📅 Backup scheduler started - Daily backups at 2:00 AM');
  
  // Schedule daily backups
  const task = cron.schedule(BACKUP_SCHEDULE, async () => {
    console.log('\n⏰ Scheduled backup triggered...');
    
    try {
      const result = await performBackup();
      
      if (result.success) {
        console.log('✅ Scheduled backup completed successfully');
        
        // Log backup statistics
        const stats = await getBackupStats();
        console.log(`📊 Backup stats: ${stats.total_backups} backups, ${stats.total_size_mb} MB total`);
      } else {
        console.error('❌ Scheduled backup failed:', result.error);
      }
      
    } catch (error) {
      console.error('❌ Scheduled backup error:', error.message);
    }
  });
  
  // Log next scheduled run
  console.log('📅 Next backup scheduled for: 2:00 AM');
  
  return task;
}

/**
 * Run backup immediately (manual trigger)
 */
async function runManualBackup() {
  console.log('🔄 Manual backup triggered...');
  
  try {
    const result = await performBackup();
    
    if (result.success) {
      console.log('✅ Manual backup completed successfully');
      return result;
    } else {
      console.error('❌ Manual backup failed:', result.error);
      throw new Error(result.error);
    }
    
  } catch (error) {
    console.error('❌ Manual backup error:', error.message);
    throw error;
  }
}

module.exports = {
  startBackupScheduler,
  runManualBackup
};

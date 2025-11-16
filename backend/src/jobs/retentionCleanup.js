/**
 * Data Retention Cleanup Job
 * Runs daily at 2:00 AM to automatically delete expired cases
 */

const cron = require('node-cron');
const { runRetentionCleanup } = require('../utils/dataRetention');

let cleanupJob = null;

/**
 * Start the retention cleanup job
 * Runs every day at 2:00 AM
 */
function startRetentionJob(knex) {
  if (cleanupJob) {
    console.log('⚠️  Retention cleanup job already running');
    return;
  }
  
  // Schedule: Every day at 2:00 AM
  // Format: minute hour day month weekday
  cleanupJob = cron.schedule('0 2 * * *', async () => {
    console.log('🗑️  Starting automatic data retention cleanup...');
    
    try {
      const results = await runRetentionCleanup(knex);
      
      console.log('✅ Data retention cleanup completed:');
      console.log(`   - Cases checked: ${results.total_cases_checked}`);
      console.log(`   - Cases deleted: ${results.cases_deleted.length}`);
      console.log(`   - Errors: ${results.errors.length}`);
      
      if (results.cases_deleted.length > 0) {
        console.log('   Deleted cases:', results.cases_deleted.map(c => c.case_number).join(', '));
      }
      
      if (results.errors.length > 0) {
        console.error('   ⚠️  Errors during cleanup:', results.errors);
      }
      
    } catch (err) {
      console.error('❌ Error running retention cleanup:', err);
    }
  }, {
    scheduled: true,
    timezone: "UTC"
  });
  
  console.log('✅ Data retention cleanup job started (runs daily at 2:00 AM UTC)');
}

/**
 * Stop the retention cleanup job
 */
function stopRetentionJob() {
  if (cleanupJob) {
    cleanupJob.stop();
    cleanupJob = null;
    console.log('🛑 Data retention cleanup job stopped');
  }
}

/**
 * Check if job is running
 */
function isJobRunning() {
  return cleanupJob !== null;
}

module.exports = {
  startRetentionJob,
  stopRetentionJob,
  isJobRunning
};

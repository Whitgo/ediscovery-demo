/**
 * Data Retention Cleanup Job
 * Runs daily at 2:00 AM to automatically delete expired cases
 */

const cron = require('node-cron');
const logger = require('../utils/logger');
const { runRetentionCleanup } = require('../utils/dataRetention');

let cleanupJob = null;

/**
 * Start the retention cleanup job
 * Runs every day at 2:00 AM
 */
function startRetentionJob(knex) {
  if (cleanupJob) {
    logger.warn('Retention cleanup job already running');
    return;
  }
  
  // Schedule: Every day at 2:00 AM
  // Format: minute hour day month weekday
  cleanupJob = cron.schedule('0 2 * * *', async () => {
    logger.info('Starting automatic data retention cleanup');
    
    try {
      const results = await runRetentionCleanup(knex);
      
      logger.info('Data retention cleanup completed', {
        casesChecked: results.total_cases_checked,
        casesDeleted: results.cases_deleted.length,
        errors: results.errors.length
      });
      
      if (results.cases_deleted.length > 0) {
        logger.info('Deleted cases', { caseNumbers: results.cases_deleted.map(c => c.case_number) });
      }
      
      if (results.errors.length > 0) {
        logger.error('Errors during cleanup', { errors: results.errors });
      }
      
    } catch (err) {
      logger.error('Error running retention cleanup', { error: err.message, stack: err.stack });
    }
  }, {
    scheduled: true,
    timezone: "UTC"
  });
  
  logger.info('Data retention cleanup job started (runs daily at 2:00 AM UTC)');
}

/**
 * Stop the retention cleanup job
 */
function stopRetentionJob() {
  if (cleanupJob) {
    cleanupJob.stop();
    cleanupJob = null;
    logger.info('Data retention cleanup job stopped');
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

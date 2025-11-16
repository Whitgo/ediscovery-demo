/**
 * Data Retention Utilities
 * Purpose: GDPR/CCPA compliance - automatic data deletion and retention policies
 */

const fs = require('fs').promises;
const path = require('path');

/**
 * Retention policy configurations
 */
const RETENTION_POLICIES = {
  '10_years': 10 * 365,  // 10 years in days
  '7_years': 7 * 365,    // 7 years in days
  '5_years': 5 * 365,    // 5 years in days
  '3_years': 3 * 365,    // 3 years in days
  'indefinite': null,     // Never auto-delete
  'custom': null          // Custom date set manually
};

/**
 * Calculate retention date based on policy
 */
function calculateRetentionDate(createdAt, policy = '10_years') {
  if (!RETENTION_POLICIES[policy]) {
    return null; // indefinite or custom
  }
  
  const created = new Date(createdAt);
  const retentionDays = RETENTION_POLICIES[policy];
  const retentionDate = new Date(created);
  retentionDate.setDate(retentionDate.getDate() + retentionDays);
  
  return retentionDate;
}

/**
 * Check if case should be deleted based on retention policy
 */
function shouldDeleteCase(caseData) {
  // Never delete if on legal hold
  if (caseData.legal_hold) {
    return false;
  }
  
  // Never delete if indefinite retention
  if (caseData.retention_policy === 'indefinite') {
    return false;
  }
  
  // Check if retention date has passed
  if (caseData.retention_date) {
    const retentionDate = new Date(caseData.retention_date);
    const now = new Date();
    return now > retentionDate;
  }
  
  return false;
}

/**
 * Get cases eligible for deletion
 */
async function getExpiredCases(knex) {
  const now = new Date();
  
  return await knex('cases')
    .whereNull('deleted_at')  // Not already soft-deleted
    .where('legal_hold', false)  // Not on legal hold
    .whereNotNull('retention_date')
    .where('retention_date', '<', now)
    .whereNot('retention_policy', 'indefinite');
}

/**
 * Delete case and all associated data (cascade)
 */
async function deleteCaseData(knex, caseId, triggeredBy = 'auto_retention', performedByUser = null) {
  const trx = await knex.transaction();
  
  try {
    // Get case info for logging
    const caseInfo = await trx('cases')
      .where({ id: caseId })
      .first();
    
    if (!caseInfo) {
      await trx.rollback();
      return { success: false, error: 'Case not found' };
    }
    
    // Get all documents for this case (to delete files)
    const documents = await trx('documents')
      .where({ case_id: caseId })
      .whereNull('deleted_at');
    
    let filesDeleted = 0;
    let fileErrors = [];
    
    // Delete physical files
    for (const doc of documents) {
      try {
        const uploadsDir = path.join(__dirname, '../../uploads');
        const filePath = path.join(uploadsDir, doc.stored_filename);
        
        // Check if file exists before deleting
        try {
          await fs.access(filePath);
          await fs.unlink(filePath);
          filesDeleted++;
        } catch (err) {
          // File doesn't exist or can't access - log but continue
          fileErrors.push({ docId: doc.id, filename: doc.stored_filename, error: err.message });
        }
      } catch (err) {
        fileErrors.push({ docId: doc.id, error: err.message });
      }
    }
    
    // Soft delete documents
    await trx('documents')
      .where({ case_id: caseId })
      .update({ deleted_at: trx.fn.now() });
    
    // Delete tags (no PII, can hard delete)
    await trx('document_tags')
      .whereIn('document_id', documents.map(d => d.id))
      .del();
    
    // Anonymize audit logs instead of deleting (for compliance trail)
    await trx('audit_logs')
      .where({ case_id: caseId })
      .whereNot('anonymized', true)
      .update({
        user: '[DELETED USER]',
        details: '[ANONYMIZED]',
        anonymized: true
      });
    
    // Delete notifications
    const notificationsDeleted = await trx('notifications')
      .where({ case_id: caseId })
      .del();
    
    // Soft delete the case
    await trx('cases')
      .where({ id: caseId })
      .update({ deleted_at: trx.fn.now() });
    
    // Log retention action
    await trx('data_retention_log').insert({
      action: 'case_deleted',
      case_id: caseId,
      records_affected: documents.length,
      details: JSON.stringify({
        case_number: caseInfo.case_number,
        case_name: caseInfo.case_name,
        documents_deleted: documents.length,
        files_deleted: filesDeleted,
        file_errors: fileErrors,
        notifications_deleted: notificationsDeleted,
        audit_logs_anonymized: true
      }),
      triggered_by: triggeredBy,
      performed_by_user: performedByUser,
      executed_at: trx.fn.now()
    });
    
    await trx.commit();
    
    return {
      success: true,
      case_id: caseId,
      case_number: caseInfo.case_number,
      documents_deleted: documents.length,
      files_deleted: filesDeleted,
      file_errors: fileErrors,
      notifications_deleted: notificationsDeleted
    };
    
  } catch (err) {
    await trx.rollback();
    throw err;
  }
}

/**
 * Run automatic retention cleanup (called by cron job)
 */
async function runRetentionCleanup(knex) {
  const expiredCases = await getExpiredCases(knex);
  
  const results = {
    total_cases_checked: expiredCases.length,
    cases_deleted: [],
    errors: []
  };
  
  for (const caseData of expiredCases) {
    try {
      const result = await deleteCaseData(knex, caseData.id, 'auto_retention');
      if (result.success) {
        results.cases_deleted.push(result);
      } else {
        results.errors.push({ case_id: caseData.id, error: result.error });
      }
    } catch (err) {
      results.errors.push({ case_id: caseData.id, error: err.message });
    }
  }
  
  return results;
}

/**
 * Get cases approaching retention deadline (within 90 days)
 */
async function getCasesApproachingRetention(knex, daysThreshold = 90) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysThreshold);
  
  const now = new Date();
  
  return await knex('cases')
    .whereNull('deleted_at')
    .whereNotNull('retention_date')
    .where('retention_date', '>', now)
    .where('retention_date', '<=', futureDate)
    .whereNot('retention_policy', 'indefinite')
    .select('*');
}

/**
 * Update retention policy for a case
 */
async function updateCaseRetentionPolicy(knex, caseId, policy, customDate = null) {
  const validPolicies = Object.keys(RETENTION_POLICIES);
  
  if (!validPolicies.includes(policy)) {
    throw new Error(`Invalid retention policy. Must be one of: ${validPolicies.join(', ')}`);
  }
  
  const updateData = {
    retention_policy: policy
  };
  
  // Calculate retention date unless custom
  if (policy === 'custom' && customDate) {
    updateData.retention_date = customDate;
  } else if (policy !== 'custom' && policy !== 'indefinite') {
    const caseData = await knex('cases').where({ id: caseId }).first();
    if (caseData) {
      updateData.retention_date = calculateRetentionDate(caseData.created_at, policy);
    }
  } else if (policy === 'indefinite') {
    updateData.retention_date = null;
  }
  
  await knex('cases')
    .where({ id: caseId })
    .update(updateData);
  
  return updateData;
}

/**
 * Set or remove legal hold on a case
 */
async function setLegalHold(knex, caseId, isHold = true) {
  await knex('cases')
    .where({ id: caseId })
    .update({ legal_hold: isHold });
  
  return { case_id: caseId, legal_hold: isHold };
}

module.exports = {
  RETENTION_POLICIES,
  calculateRetentionDate,
  shouldDeleteCase,
  getExpiredCases,
  deleteCaseData,
  runRetentionCleanup,
  getCasesApproachingRetention,
  updateCaseRetentionPolicy,
  setLegalHold
};

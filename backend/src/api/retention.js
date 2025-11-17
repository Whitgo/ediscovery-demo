/**
 * Data Retention API Routes
 * Endpoints for managing data retention policies and cleanup
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { validationRules } = require('../middleware/validate');
const {
  RETENTION_POLICIES,
  getExpiredCases,
  deleteCaseData,
  runRetentionCleanup,
  getCasesApproachingRetention,
  updateCaseRetentionPolicy,
  setLegalHold
} = require('../utils/dataRetention');

// Get retention policy options (all users)
router.get('/policies', auth, async (req, res) => {
  res.json({
    policies: RETENTION_POLICIES,
    available_policies: Object.keys(RETENTION_POLICIES),
    descriptions: {
      '10_years': 'Data deleted 10 years after case creation',
      '7_years': 'Data deleted 7 years after case creation',
      '5_years': 'Data deleted 5 years after case creation',
      '3_years': 'Data deleted 3 years after case creation',
      'indefinite': 'Data never automatically deleted',
      'custom': 'Custom retention date set manually'
    }
  });
});

// Get cases approaching retention deadline (managers only)
router.get('/cases/approaching', auth, async (req, res) => {
  if (req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Access denied. Managers only.' });
  }

  const knex = req.knex;
  const daysThreshold = parseInt(req.query.days) || 90;

  try {
    const cases = await getCasesApproachingRetention(knex, daysThreshold);
    
    // Calculate days remaining for each case
    const now = new Date();
    const casesWithDays = cases.map(c => {
      const retentionDate = new Date(c.retention_date);
      const daysRemaining = Math.ceil((retentionDate - now) / (1000 * 60 * 60 * 24));
      return {
        ...c,
        days_remaining: daysRemaining
      };
    });
    
    res.json({
      total: casesWithDays.length,
      cases: casesWithDays
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get expired cases (managers only)
router.get('/cases/expired', auth, async (req, res) => {
  if (req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Access denied. Managers only.' });
  }

  const knex = req.knex;

  try {
    const cases = await getExpiredCases(knex);
    res.json({
      total: cases.length,
      cases
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update case retention policy (managers only)
router.patch('/cases/:caseId/policy', auth, validationRules.updateRetentionPolicy, async (req, res) => {
  if (req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Access denied. Managers only.' });
  }

  const knex = req.knex;
  const { policy, custom_date } = req.body;

  if (!policy) {
    return res.status(400).json({ error: 'Policy is required' });
  }

  try {
    const result = await updateCaseRetentionPolicy(knex, req.params.caseId, policy, custom_date);
    
    // Log audit
    await knex('audit_logs').insert({
      user: req.user.name,
      action: 'update_retention_policy',
      object_type: 'case',
      object_id: req.params.caseId,
      case_id: req.params.caseId,
      details: JSON.stringify({ policy, custom_date }),
      timestamp: knex.fn.now()
    });
    
    res.json({
      message: 'Retention policy updated',
      case_id: req.params.caseId,
      ...result
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Set or remove legal hold (managers only)
router.patch('/cases/:caseId/legal-hold', auth, validationRules.updateLegalHold, async (req, res) => {
  if (req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Access denied. Managers only.' });
  }

  const knex = req.knex;
  const { legal_hold } = req.body;

  if (typeof legal_hold !== 'boolean') {
    return res.status(400).json({ error: 'legal_hold must be a boolean' });
  }

  try {
    const result = await setLegalHold(knex, req.params.caseId, legal_hold);
    
    // Log audit
    await knex('audit_logs').insert({
      user: req.user.name,
      action: legal_hold ? 'set_legal_hold' : 'remove_legal_hold',
      object_type: 'case',
      object_id: req.params.caseId,
      case_id: req.params.caseId,
      details: JSON.stringify({ legal_hold }),
      timestamp: knex.fn.now()
    });
    
    res.json({
      message: legal_hold ? 'Legal hold activated' : 'Legal hold removed',
      ...result
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Manually delete a specific case (managers only)
router.delete('/cases/:caseId', auth, validationRules.validateCaseId, async (req, res) => {
  if (req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Access denied. Managers only.' });
  }

  const knex = req.knex;

  try {
    // Check if case is on legal hold
    const caseData = await knex('cases')
      .where({ id: req.params.caseId })
      .first();
    
    if (!caseData) {
      return res.status(404).json({ error: 'Case not found' });
    }
    
    if (caseData.legal_hold) {
      return res.status(400).json({ 
        error: 'Cannot delete case on legal hold. Remove legal hold first.' 
      });
    }
    
    const result = await deleteCaseData(
      knex, 
      req.params.caseId, 
      'manual_admin', 
      req.user.name
    );
    
    if (result.success) {
      res.json({
        message: 'Case and associated data deleted successfully',
        ...result
      });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Run retention cleanup manually (managers only)
router.post('/cleanup/run', auth, async (req, res) => {
  if (req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Access denied. Managers only.' });
  }

  const knex = req.knex;

  try {
    const results = await runRetentionCleanup(knex);
    
    // Log audit
    await knex('audit_logs').insert({
      user: req.user.name,
      action: 'manual_retention_cleanup',
      object_type: 'system',
      details: JSON.stringify(results),
      timestamp: knex.fn.now()
    });
    
    res.json({
      message: 'Retention cleanup completed',
      ...results
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get retention log (managers only)
router.get('/log', auth, async (req, res) => {
  if (req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Access denied. Managers only.' });
  }

  const knex = req.knex;
  const limit = parseInt(req.query.limit) || 100;
  const offset = parseInt(req.query.offset) || 0;

  try {
    const logs = await knex('data_retention_log')
      .orderBy('executed_at', 'desc')
      .limit(limit)
      .offset(offset);
    
    const total = await knex('data_retention_log').count('* as count').first();
    
    res.json({
      total: parseInt(total.count),
      limit,
      offset,
      logs
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get retention statistics (managers only)
router.get('/stats', auth, async (req, res) => {
  if (req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Access denied. Managers only.' });
  }

  const knex = req.knex;

  try {
    // Count cases by retention policy
    const policyStats = await knex('cases')
      .whereNull('deleted_at')
      .select('retention_policy')
      .count('* as count')
      .groupBy('retention_policy');
    
    // Count cases on legal hold
    const legalHoldCount = await knex('cases')
      .whereNull('deleted_at')
      .where('legal_hold', true)
      .count('* as count')
      .first();
    
    // Count expired cases
    const expiredCases = await getExpiredCases(knex);
    
    // Count approaching retention (90 days)
    const approachingCases = await getCasesApproachingRetention(knex, 90);
    
    // Total deleted cases
    const deletedCount = await knex('cases')
      .whereNotNull('deleted_at')
      .count('* as count')
      .first();
    
    res.json({
      by_policy: policyStats,
      legal_hold_count: parseInt(legalHoldCount.count),
      expired_count: expiredCases.length,
      approaching_count: approachingCases.length,
      deleted_count: parseInt(deletedCount.count)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

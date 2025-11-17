const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const audit = require('../middleware/audit');
const { calculateRetentionDate } = require('../utils/dataRetention');
const { validationRules } = require('../middleware/validate');

// Get disposition options
router.get('/meta/dispositions', auth, (req, res) => {
  res.json([
    { value: 'plea', label: 'Plea Agreement' },
    { value: 'settlement', label: 'Settlement' },
    { value: 'probation', label: 'Probation' },
    { value: 'dismissed', label: 'Dismissed' },
    { value: 'trial', label: 'Trial Verdict' },
    { value: 'pending', label: 'Pending' }
  ]);
});

router.get('/', auth, async (req, res) => {
  const knex = req.knex;
  try {
    // Filter out soft-deleted cases
    const cases = await knex('cases')
      .whereNull('deleted_at')
      .select();
    res.json(cases);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id', auth, validationRules.validateId, async (req, res) => {
  const knex = req.knex;
  try {
    const c = await knex('cases')
      .where({ id: req.params.id })
      .whereNull('deleted_at')
      .first();
    if (!c) return res.status(404).json({ error: 'Case not found' });
    res.json(c);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', auth, validationRules.createCase, async (req, res) => {
  const knex = req.knex;
  if (req.user.role !== "manager") return res.status(403).json({ error: "Access denied" });
  const { name, number, status, assigned_to, notes, disposition, disposition_notes } = req.body;
  try {
    // Calculate retention date (10 years from now)
    const retentionDate = calculateRetentionDate(new Date(), '10_years');
    
    const [id] = await knex('cases').insert({
      name, 
      number, 
      status, 
      assigned_to, 
      notes, 
      disposition, 
      disposition_notes,
      retention_policy: '10_years',
      retention_date: retentionDate,
      legal_hold: false,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    }).returning('id');
    await audit({
      action: 'create',
      user: req.user.name,
      objectType: 'case',
      objectId: id,
      caseId: id,
      details: { name, number, disposition, retention_policy: '10_years', retention_date: retentionDate }
    });
    res.status(201).json({ 
      id, 
      name, 
      number, 
      status, 
      assigned_to, 
      notes, 
      disposition, 
      disposition_notes,
      retention_policy: '10_years',
      retention_date: retentionDate
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/:id', auth, validationRules.updateCase, async (req, res) => {
  const knex = req.knex;
  if (req.user.role !== "manager") return res.status(403).json({ error: "Access denied" });
  try {
    await knex('cases').where({ id: req.params.id }).update({ ...req.body, updated_at: knex.fn.now() });
    await audit({
      action: "update",
      user: req.user.name,
      objectType: "case",
      objectId: req.params.id,
      caseId: req.params.id,
      details: req.body
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', auth, validationRules.validateId, async (req, res) => {
  const knex = req.knex;
  if (req.user.role !== "manager") return res.status(403).json({ error: "Access denied" });
  try {
    await knex('cases').where({ id: req.params.id }).first().del();
    await audit({
      action: "delete",
      user: req.user.name,
      objectType: "case",
      objectId: req.params.id,
      caseId: req.params.id,
      details: {}
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
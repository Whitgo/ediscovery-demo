const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

router.get('/case/:caseId', auth, requireRole('admin', 'manager', 'support'), async (req, res) => {
  const knex = req.knex;
  try {
    const logs = await knex('audit_logs')
      .where({ case_id: req.params.caseId })
      .orderBy('timestamp', 'desc');
    res.json(logs);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
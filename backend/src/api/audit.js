const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

router.get('/case/:caseId', auth, async (req, res) => {
  const knex = req.knex;
  if (!["manager", "support"].includes(req.user.role)) return res.sendStatus(403);
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
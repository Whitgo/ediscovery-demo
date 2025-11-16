const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

router.post('/login', async (req, res) => {
  const knex = req.knex;
  const { email, password } = req.body;
  try {
    const user = await knex('users').where({ email }).first();
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid email or password' });

    const payload = {
      id: user.id,
      name: user.name,
      role: user.role,
      email: user.email
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, user: payload });
  } catch (err) {
    res.status(500).json({ error: 'Login failed', details: err.message });
  }
});

module.exports = router;
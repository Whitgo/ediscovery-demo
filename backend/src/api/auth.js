const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { validationRules } = require('../middleware/validate');
const { detectBruteForce } = require('../utils/incidentDetection');

// Helper to log failed login attempts
async function logFailedLogin(knex, email, ip, userAgent) {
  try {
    await knex('audit_logs').insert({
      user: email || 'unknown',
      action: 'failed_login',
      object_type: 'auth',
      details: JSON.stringify({ 
        ip, 
        user_agent: userAgent,
        reason: 'Invalid credentials'
      }),
      timestamp: knex.fn.now()
    });
  } catch (err) {
    console.error('Failed to log failed login:', err);
  }
}

router.post('/login', validationRules.login, async (req, res) => {
  const knex = req.knex;
  const { email, password } = req.body;
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'];
  
  try {
    // Validate input
    if (!email || !password) {
      await logFailedLogin(knex, email, ip, userAgent);
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await knex('users').where({ email }).first();
    
    if (!user) {
      await logFailedLogin(knex, email, ip, userAgent);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    
    if (!match) {
      await logFailedLogin(knex, email, ip, userAgent);
      
      // Check for brute force attack
      await detectBruteForce(knex, email, ip);
      
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const payload = {
      id: user.id,
      name: user.name,
      role: user.role,
      email: user.email
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' });
    
    // Log successful login
    await knex('audit_logs').insert({
      user: user.email,
      action: 'successful_login',
      object_type: 'auth',
      details: JSON.stringify({ 
        ip, 
        user_agent: userAgent,
        user_id: user.id
      }),
      timestamp: knex.fn.now()
    });
    
    res.json({ token, user: payload });
  } catch (err) {
    console.error('Login error:', err);
    await logFailedLogin(knex, email, ip, userAgent);
    res.status(500).json({ error: 'Login failed', details: err.message });
  }
});

// Endpoint to check rate limit status (useful for debugging/monitoring)
router.get('/rate-limit-info', (req, res) => {
  res.json({
    message: 'Rate limit information',
    limits: {
      authentication: {
        window: '15 minutes',
        max_requests: 5,
        note: 'Only failed login attempts count toward limit'
      },
      general_api: {
        window: '15 minutes',
        max_requests: 100
      },
      uploads: {
        window: '1 hour',
        max_requests: 50
      },
      exports: {
        window: '1 hour',
        max_requests: 10
      }
    },
    headers: {
      'RateLimit-Limit': 'Total number of requests allowed in window',
      'RateLimit-Remaining': 'Number of requests remaining',
      'RateLimit-Reset': 'Timestamp when the rate limit resets'
    }
  });
});

module.exports = router;

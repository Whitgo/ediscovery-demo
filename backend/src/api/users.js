const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { validationRules } = require('../middleware/validate');

// Get all users (admins and managers only)
router.get('/', auth, requireRole('admin', 'manager'), async (req, res) => {
  const knex = req.knex;
  try {
    const users = await knex('users')
      .select('id', 'name', 'email', 'role', 'created_at')
      .orderBy('created_at', 'desc');
    res.json(users);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get single user (admins and managers only)
router.get('/:id', auth, requireRole('admin', 'manager'), validationRules.validateId, async (req, res) => {
  const knex = req.knex;
  try {
    const user = await knex('users')
      .select('id', 'name', 'email', 'role', 'created_at')
      .where({ id: req.params.id })
      .first();
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Create new user (admins and managers only)
router.post('/', auth, requireRole('admin', 'manager'), validationRules.createUser, async (req, res) => {
  const knex = req.knex;
  const { name, email, password, role } = req.body;

  // Validation
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Name, email, password, and role are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const validRoles = ['admin', 'manager', 'user', 'support', 'viewer'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  // Only admins can create other admins
  if (role === 'admin' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can create admin accounts' });
  }

  try {
    // Check if email already exists
    const existingUser = await knex('users').where({ email }).first();
    if (existingUser) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Create user
    const [id] = await knex('users').insert({
      name,
      email,
      password_hash,
      role,
      created_at: knex.fn.now()
    }).returning('id');

    // Log audit
    await knex('audit_logs').insert({
      user: req.user.name,
      action: 'create',
      object_type: 'user',
      object_id: id,
      details: JSON.stringify({ name, email, role }),
      timestamp: knex.fn.now()
    });

    res.status(201).json({
      id,
      name,
      email,
      role,
      message: 'User created successfully'
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update user (admins and managers only)
router.patch('/:id', auth, requireRole('admin', 'manager'), validationRules.updateUser, async (req, res) => {
  const knex = req.knex;
  const { name, email, password, role } = req.body;

  // Validation
  if (!name && !email && !password && !role) {
    return res.status(400).json({ error: 'At least one field is required' });
  }

  if (role) {
    const validRoles = ['admin', 'manager', 'user', 'support', 'viewer'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Only admins can assign/change admin role
    if (role === 'admin' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can assign admin role' });
    }
  }

  if (password && password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    // Check if user exists
    const user = await knex('users').where({ id: req.params.id }).first();
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if email is being changed and if it's already in use
    if (email && email !== user.email) {
      const existingUser = await knex('users').where({ email }).first();
      if (existingUser) {
        return res.status(400).json({ error: 'Email already in use' });
      }
    }

    // Build update object
    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (role) updateData.role = role;
    if (password) {
      updateData.password_hash = await bcrypt.hash(password, 10);
    }

    // Update user
    await knex('users')
      .where({ id: req.params.id })
      .update(updateData);

    // Log audit
    await knex('audit_logs').insert({
      user: req.user.name,
      action: 'update',
      object_type: 'user',
      object_id: req.params.id,
      details: JSON.stringify({ name, email, role, passwordChanged: !!password }),
      timestamp: knex.fn.now()
    });

    res.json({ message: 'User updated successfully' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Delete user (admins and managers only)
router.delete('/:id', auth, requireRole('admin', 'manager'), validationRules.validateId, async (req, res) => {
  const knex = req.knex;

  try {
    // Check if user exists
    const user = await knex('users').where({ id: req.params.id }).first();
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent self-deletion
    if (user.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Only admins can delete other admins
    if (user.role === 'admin' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can delete admin accounts' });
    }

    // Delete user
    await knex('users').where({ id: req.params.id }).del();

    // Log audit
    await knex('audit_logs').insert({
      user: req.user.name,
      action: 'delete',
      object_type: 'user',
      object_id: req.params.id,
      details: JSON.stringify({ name: user.name, email: user.email }),
      timestamp: knex.fn.now()
    });

    res.json({ message: 'User deleted successfully' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

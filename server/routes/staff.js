const express = require('express');
const router = express.Router();
const { queryAll, queryOne, run } = require('../db');

// GET /api/staff
// Get all staff members (Admins & Cashiers)
router.get('/', (req, res) => {
  try {
    const staff = queryAll(`
      SELECT id, name, email, username, role, pin, phone, is_active, created_at
      FROM users
      WHERE role IN ('admin', 'cashier')
      ORDER BY role ASC, name ASC
    `);
    res.json({ success: true, data: staff });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/staff
// Admin adds new cashier or admin with custom password and PIN
router.post('/', (req, res) => {
  try {
    const { name, email, username, password, pin, role = 'cashier', phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Name, email, and password are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = queryOne('SELECT * FROM users WHERE LOWER(email) = ?', [cleanEmail]);
    if (existing) {
      return res.status(400).json({ success: false, error: 'An account with this email already exists' });
    }

    const id = 'usr-staff-' + Date.now();
    const staffUsername = username ? username.trim().toLowerCase() : cleanEmail.split('@')[0];
    const now = new Date().toISOString();

    run(
      `INSERT INTO users (id, name, email, username, password_hash, pin, role, phone, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [id, name.trim(), cleanEmail, staffUsername, password.trim(), pin ? String(pin).trim() : '', role, phone || '', now]
    );

    const created = queryOne('SELECT id, name, email, username, role, pin, phone, is_active, created_at FROM users WHERE id = ?', [id]);
    res.status(201).json({ success: true, data: created, message: `${role.toUpperCase()} account created successfully` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/staff/:id/password
// Admin updates password or PIN of an admin or cashier
router.put('/:id/password', (req, res) => {
  try {
    const { password, pin } = req.body;
    const user = queryOne('SELECT * FROM users WHERE id = ?', [req.params.id]);

    if (!user) {
      return res.status(404).json({ success: false, error: 'Staff member not found' });
    }

    if (!password && !pin) {
      return res.status(400).json({ success: false, error: 'Either new password or new PIN must be provided' });
    }

    if (password) {
      run('UPDATE users SET password_hash = ? WHERE id = ?', [password.trim(), user.id]);
    }
    if (pin !== undefined) {
      run('UPDATE users SET pin = ? WHERE id = ?', [String(pin).trim(), user.id]);
    }

    res.json({
      success: true,
      message: `Password and credentials updated for ${user.name} (${user.role.toUpperCase()})`,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/staff/:id
// Admin updates staff details or role
router.put('/:id', (req, res) => {
  try {
    const { name, role, phone, is_active, pin } = req.body;
    const user = queryOne('SELECT * FROM users WHERE id = ?', [req.params.id]);

    if (!user) {
      return res.status(404).json({ success: false, error: 'Staff member not found' });
    }

    run(
      `UPDATE users SET
        name = ?, role = ?, phone = ?, is_active = ?, pin = ?
       WHERE id = ?`,
      [
        name !== undefined ? name.trim() : user.name,
        role || user.role,
        phone !== undefined ? phone : user.phone,
        is_active !== undefined ? (is_active ? 1 : 0) : user.is_active,
        pin !== undefined ? String(pin).trim() : user.pin,
        user.id
      ]
    );

    const updated = queryOne('SELECT id, name, email, username, role, pin, phone, is_active, created_at FROM users WHERE id = ?', [user.id]);
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/staff/:id
// Admin deletes staff account
router.delete('/:id', (req, res) => {
  try {
    const user = queryOne('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Staff member not found' });
    }

    // Prevent deleting the last admin
    if (user.role === 'admin') {
      const adminCount = queryOne('SELECT COUNT(*) as count FROM users WHERE role = "admin"');
      if (adminCount && adminCount.count <= 1) {
        return res.status(400).json({ success: false, error: 'Cannot delete the only remaining admin account' });
      }
    }

    run('DELETE FROM users WHERE id = ?', [user.id]);
    res.json({ success: true, message: `Staff account ${user.name} removed successfully` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

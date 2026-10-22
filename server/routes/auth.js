const express = require('express');
const router = express.Router();
const { queryAll, queryOne, run } = require('../db');

// POST /api/auth/login
// Supports login with email/username + password OR quick PIN (for staff terminals)
router.post('/login', (req, res) => {
  try {
    const { identifier, password, pin } = req.body;

    if (!identifier && !pin) {
      return res.status(400).json({ success: false, error: 'Username/Email or PIN is required' });
    }

    let user = null;

    if (pin) {
      user = queryOne('SELECT * FROM users WHERE pin = ? AND is_active = 1', [String(pin).trim()]);
    } else if (identifier) {
      const cleanIdent = String(identifier).trim().toLowerCase();
      user = queryOne(
        'SELECT * FROM users WHERE (LOWER(email) = ? OR LOWER(username) = ?) AND is_active = 1',
        [cleanIdent, cleanIdent]
      );

      if (user && user.password_hash !== password) {
        return res.status(401).json({ success: false, error: 'Incorrect password' });
      }
    }

    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials or user not found' });
    }

    // Return safe user object (omit password_hash)
    const { password_hash, ...safeUser } = user;
    res.json({
      success: true,
      data: safeUser,
      message: `Welcome back, ${user.name}!`,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/google
// One-click Google Sign-In for customers / users
router.post('/google', (req, res) => {
  try {
    const { email, name, google_id, avatar } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, error: 'Google email is required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    let user = queryOne('SELECT * FROM users WHERE LOWER(email) = ?', [cleanEmail]);

    if (!user) {
      // Auto-register new customer via Google
      const id = 'usr-google-' + Date.now();
      const userName = name || email.split('@')[0];
      const now = new Date().toISOString();
      const userAvatar = avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(userName)}`;

      run(
        `INSERT INTO users (id, name, email, username, password_hash, pin, role, phone, avatar, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, userName, cleanEmail, cleanEmail.split('@')[0], 'google_oauth', '', 'customer', '', userAvatar, 1, now]
      );

      user = queryOne('SELECT * FROM users WHERE id = ?', [id]);
    }

    const { password_hash, ...safeUser } = user;
    res.json({
      success: true,
      data: safeUser,
      message: `Signed in with Google as ${safeUser.name}`,
    });
  } catch (err) {
    console.error('Google auth error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/signup
// Customer signup with email & password
router.post('/signup', (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Name, email, and password are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = queryOne('SELECT * FROM users WHERE LOWER(email) = ?', [cleanEmail]);
    if (existing) {
      return res.status(400).json({ success: false, error: 'An account with this email already exists' });
    }

    const id = 'usr-cust-' + Date.now();
    const now = new Date().toISOString();
    const avatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name.trim())}`;

    run(
      `INSERT INTO users (id, name, email, username, password_hash, pin, role, phone, avatar, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name.trim(), cleanEmail, cleanEmail.split('@')[0], password, '', 'customer', phone || '', avatar, 1, now]
    );

    const created = queryOne('SELECT * FROM users WHERE id = ?', [id]);
    const { password_hash, ...safeUser } = created;
    res.status(201).json({
      success: true,
      data: safeUser,
      message: 'Account created successfully! Welcome to Loaf n Leaf.',
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/auth/users
// Fast list of staff accounts for cashier terminal quick switch
router.get('/users', (req, res) => {
  try {
    const users = queryAll('SELECT id, name, email, username, pin, role, avatar, is_active FROM users WHERE role IN ("admin", "cashier") AND is_active = 1');
    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { queryAll, queryOne, run, saveToDisk, seedInitialData } = require('../db');

// GET /api/settings
router.get('/', (req, res) => {
  try {
    const rows = queryAll('SELECT key, value FROM settings');
    const settings = {};
    for (const r of rows) {
      settings[r.key] = r.value;
    }
    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/settings
router.put('/', (req, res) => {
  try {
    const updates = req.body;
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ success: false, error: 'Settings object required' });
    }

    for (const [key, value] of Object.entries(updates)) {
      run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, String(value)]);
    }

    const rows = queryAll('SELECT key, value FROM settings');
    const settings = {};
    for (const r of rows) {
      settings[r.key] = r.value;
    }

    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/settings/reset-sales
// Resets all orders, order items, payments, and table occupation states to zero
router.post('/reset-sales', (req, res) => {
  try {
    run('DELETE FROM order_items');
    run('DELETE FROM payments');
    run('DELETE FROM orders');
    run("UPDATE restaurant_tables SET status = 'available', current_order_id = NULL");
    saveToDisk();

    res.json({ success: true, message: 'All orders, kitchen tickets, payments, and sales have been successfully reset to zero.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/settings/reset-demo
router.post('/reset-demo', (req, res) => {
  try {
    // Clear all tables and re-seed
    run('DELETE FROM order_items');
    run('DELETE FROM payments');
    run('DELETE FROM orders');
    run('DELETE FROM restaurant_tables');
    run('DELETE FROM products');
    run('DELETE FROM categories');
    run('DELETE FROM settings');

    seedInitialData();
    saveToDisk();

    res.json({ success: true, message: 'Database reset and re-seeded with clean system defaults.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { queryAll, queryOne, run } = require('../db');

// GET /api/categories
router.get('/', (req, res) => {
  try {
    const categories = queryAll('SELECT * FROM categories ORDER BY sort_order ASC, name ASC');
    res.json({ success: true, data: categories });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/categories
router.post('/', (req, res) => {
  try {
    const { name, slug } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: 'Category name is required' });
    }
    const catSlug = slug || name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const id = 'cat-' + Date.now();
    const maxOrder = queryOne('SELECT MAX(sort_order) as m FROM categories');
    const sortOrder = (maxOrder && maxOrder.m !== null) ? maxOrder.m + 1 : 1;

    run(
      'INSERT INTO categories (id, name, slug, sort_order) VALUES (?, ?, ?, ?)',
      [id, name.trim(), catSlug, sortOrder]
    );

    const created = queryOne('SELECT * FROM categories WHERE id = ?', [id]);
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

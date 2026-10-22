const express = require('express');
const router = express.Router();
const { queryAll, queryOne, run } = require('../db');

// GET /api/products
router.get('/', (req, res) => {
  try {
    const { category, search, available } = req.query;
    let sql = 'SELECT * FROM products WHERE 1=1';
    const params = [];

    if (category && category !== 'all') {
      sql += ' AND category = ?';
      params.push(category);
    }

    if (available !== undefined && available !== '') {
      sql += ' AND available = ?';
      params.push(available === 'true' || available === '1' ? 1 : 0);
    }

    if (search) {
      sql += ' AND (name LIKE ? OR code LIKE ? OR description LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    sql += ' ORDER BY category ASC, name ASC';
    const products = queryAll(sql, params);
    res.json({ success: true, data: products });
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/products/:id
router.get('/:id', (req, res) => {
  try {
    const product = queryOne('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    res.json({ success: true, data: product });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/products
router.post('/', (req, res) => {
  try {
    const { code, name, category, price, cost = 0, image = '', available = 1, description = '' } = req.body;
    if (!name || price === undefined || !category) {
      return res.status(400).json({ success: false, error: 'Name, category, and price are required' });
    }

    const id = 'prod-' + Date.now();
    const productCode = code || 'PRD-' + Math.floor(100 + Math.random() * 900);
    const now = new Date().toISOString();

    run(
      `INSERT INTO products (id, code, name, category, price, cost, image, available, description, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, productCode, name.trim(), category.trim(), Number(price), Number(cost), image.trim(), available ? 1 : 0, description.trim(), now]
    );

    const created = queryOne('SELECT * FROM products WHERE id = ?', [id]);
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    console.error('Error creating product:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/products/:id
router.put('/:id', (req, res) => {
  try {
    const { code, name, category, price, cost = 0, image = '', available = 1, description = '' } = req.body;
    const existing = queryOne('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    run(
      `UPDATE products 
       SET code = ?, name = ?, category = ?, price = ?, cost = ?, image = ?, available = ?, description = ?
       WHERE id = ?`,
      [
        code || existing.code,
        name !== undefined ? name.trim() : existing.name,
        category !== undefined ? category.trim() : existing.category,
        price !== undefined ? Number(price) : existing.price,
        cost !== undefined ? Number(cost) : existing.cost,
        image !== undefined ? image.trim() : existing.image,
        available !== undefined ? (available ? 1 : 0) : existing.available,
        description !== undefined ? description.trim() : existing.description,
        req.params.id
      ]
    );

    const updated = queryOne('SELECT * FROM products WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Error updating product:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/products/:id/toggle-availability
router.put('/:id/toggle-availability', (req, res) => {
  try {
    const existing = queryOne('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    const newStatus = existing.available === 1 ? 0 : 1;
    run('UPDATE products SET available = ? WHERE id = ?', [newStatus, req.params.id]);
    const updated = queryOne('SELECT * FROM products WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/products/:id
router.delete('/:id', (req, res) => {
  try {
    const existing = queryOne('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    run('DELETE FROM products WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

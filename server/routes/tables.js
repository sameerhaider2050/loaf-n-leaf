const express = require('express');
const router = express.Router();
const { queryAll, queryOne, run } = require('../db');

// GET /api/tables
router.get('/', (req, res) => {
  try {
    const tables = queryAll(`
      SELECT 
        t.*,
        o.order_number as active_order_number,
        o.grand_total as active_order_total,
        o.status as active_order_status,
        o.created_at as active_order_time
      FROM restaurant_tables t
      LEFT JOIN orders o ON t.current_order_id = o.id AND o.status IN ('pending', 'preparing', 'ready')
      ORDER BY t.table_number ASC
    `);
    res.json({ success: true, data: tables });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/tables/:id/status
router.put('/:id/status', (req, res) => {
  try {
    const { status, current_order_id } = req.body;
    const validStatuses = ['available', 'occupied', 'reserved'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid table status' });
    }

    const existing = queryOne('SELECT * FROM restaurant_tables WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Table not found' });
    }

    const now = new Date().toISOString();
    const orderIdToSet = status === 'available' ? null : (current_order_id !== undefined ? current_order_id : existing.current_order_id);

    run(
      'UPDATE restaurant_tables SET status = ?, current_order_id = ?, updated_at = ? WHERE id = ?',
      [status, orderIdToSet, now, req.params.id]
    );

    const updated = queryOne('SELECT * FROM restaurant_tables WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/tables
router.post('/', (req, res) => {
  try {
    const { table_number, name, capacity = 4, status = 'available' } = req.body;
    if (!table_number) {
      return res.status(400).json({ success: false, error: 'Table number is required' });
    }

    const existing = queryOne('SELECT * FROM restaurant_tables WHERE table_number = ?', [table_number.trim()]);
    if (existing) {
      return res.status(400).json({ success: false, error: 'Table number already exists' });
    }

    const id = 'tbl-' + Date.now();
    const tableName = name || `Table ${table_number.trim()}`;
    const now = new Date().toISOString();

    run(
      `INSERT INTO restaurant_tables (id, table_number, name, capacity, status, current_order_id, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, table_number.trim().toUpperCase(), tableName.trim(), Number(capacity), status, null, now]
    );

    const created = queryOne('SELECT * FROM restaurant_tables WHERE id = ?', [id]);
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/tables/:id
router.delete('/:id', (req, res) => {
  try {
    const existing = queryOne('SELECT * FROM restaurant_tables WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Table not found' });
    }
    if (existing.status === 'occupied') {
      return res.status(400).json({ success: false, error: 'Cannot delete an occupied table. Free or checkout order first.' });
    }
    run('DELETE FROM restaurant_tables WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Table deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

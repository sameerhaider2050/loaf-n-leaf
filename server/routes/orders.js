const express = require('express');
const router = express.Router();
const { queryAll, queryOne, run, transaction } = require('../db');

// Helper to get next order number
function getNextOrderNumber() {
  const row = queryOne('SELECT MAX(order_number) as max_num FROM orders');
  return (row && row.max_num) ? row.max_num + 1 : 1001;
}

// GET /api/orders
router.get('/', (req, res) => {
  try {
    const { status, type, search, date } = req.query;
    let sql = `
      SELECT 
        o.*,
        (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count,
        (SELECT GROUP_CONCAT(product_name, ', ') FROM (SELECT product_name FROM order_items WHERE order_id = o.id LIMIT 3)) as item_summary,
        p.payment_method,
        p.created_at as paid_at
      FROM orders o
      LEFT JOIN payments p ON p.order_id = o.id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'all') {
      sql += ' AND o.status = ?';
      params.push(status);
    }

    if (type && type !== 'all') {
      sql += ' AND o.order_type = ?';
      params.push(type);
    }

    if (date) {
      // Filter by YYYY-MM-DD
      sql += ' AND o.created_at LIKE ?';
      params.push(`${date}%`);
    }

    if (search) {
      sql += ` AND (
        o.order_number LIKE ? OR 
        o.table_number LIKE ? OR 
        o.customer_name LIKE ? OR 
        o.cashier_name LIKE ? OR 
        o.notes LIKE ?
      )`;
      const term = `%${search}%`;
      params.push(term, term, term, term, term);
    }

    sql += ' ORDER BY o.created_at DESC';
    const orders = queryAll(sql, params);
    res.json({ success: true, data: orders });
  } catch (err) {
    console.error('Error fetching orders:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/orders/:id
router.get('/:id', (req, res) => {
  try {
    const order = queryOne('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const items = queryAll('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
    const payments = queryAll('SELECT * FROM payments WHERE order_id = ?', [order.id]);

    res.json({
      success: true,
      data: {
        ...order,
        items,
        payments,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/orders (Create/Hold order)
router.post('/', (req, res) => {
  try {
    const {
      order_type = 'dine_in',
      table_number,
      items = [],
      subtotal = 0,
      discount = 0,
      discount_type = 'fixed',
      discount_value = 0,
      tax_rate = 13,
      tax_amount = 0,
      grand_total = 0,
      cashier_name = 'Ahmed Khan',
      customer_name = '',
      notes = '',
      status = 'pending', // 'pending' or 'preparing'
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Order must have at least one item' });
    }

    const result = transaction(() => {
      const orderNum = getNextOrderNumber();
      const orderId = 'ord-' + orderNum;
      const now = new Date().toISOString();

      // Recalculate totals server-side for integrity
      let calculatedSubtotal = 0;
      for (const item of items) {
        calculatedSubtotal += Number(item.unit_price) * Number(item.quantity);
      }

      let calculatedDiscount = Number(discount) || 0;
      if (discount_type === 'percent') {
        calculatedDiscount = Math.round((calculatedSubtotal * (Number(discount_value) || 0)) / 100);
      }
      calculatedDiscount = Math.min(calculatedSubtotal, Math.max(0, calculatedDiscount));

      const taxable = calculatedSubtotal - calculatedDiscount;
      const calculatedTax = Math.round(taxable * (Number(tax_rate) / 100));
      const calculatedGrandTotal = taxable + calculatedTax;

      run(
        `INSERT INTO orders (
          id, order_number, order_type, table_number, status, 
          subtotal, discount, discount_type, discount_value, 
          tax_rate, tax_amount, grand_total, cashier_name, 
          customer_name, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId, orderNum, order_type, table_number || null, status,
          calculatedSubtotal, calculatedDiscount, discount_type, Number(discount_value) || 0,
          Number(tax_rate), calculatedTax, calculatedGrandTotal, cashier_name,
          customer_name, notes, now, now
        ]
      );

      // Insert items
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const itemId = `item-${orderNum}-${i + 1}`;
        const itemTotal = Number(it.unit_price) * Number(it.quantity);
        run(
          `INSERT INTO order_items (id, order_id, product_id, product_name, unit_price, quantity, total_price, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [itemId, orderId, it.product_id || '', it.product_name, Number(it.unit_price), Number(it.quantity), itemTotal, it.notes || '']
        );
      }

      // If Dine In with table number, update table status to occupied
      if (order_type === 'dine_in' && table_number) {
        run(
          'UPDATE restaurant_tables SET status = ?, current_order_id = ?, updated_at = ? WHERE table_number = ?',
          ['occupied', orderId, now, table_number]
        );
      }

      const createdOrder = queryOne('SELECT * FROM orders WHERE id = ?', [orderId]);
      const createdItems = queryAll('SELECT * FROM order_items WHERE order_id = ?', [orderId]);

      return {
        ...createdOrder,
        items: createdItems,
      };
    });

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    console.error('Error creating order:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/orders/:id/status
router.put('/:id/status', (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'preparing', 'ready', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid order status' });
    }

    const order = queryOne('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const now = new Date().toISOString();

    transaction(() => {
      run('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?', [status, now, order.id]);

      // If order is completed or cancelled, free the table if Dine In
      if ((status === 'completed' || status === 'cancelled') && order.table_number) {
        run(
          'UPDATE restaurant_tables SET status = ?, current_order_id = ?, updated_at = ? WHERE current_order_id = ?',
          ['available', null, now, order.id]
        );
      }
    });

    const updated = queryOne('SELECT * FROM orders WHERE id = ?', [order.id]);
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/orders/:id (Update items or order details)
router.put('/:id', (req, res) => {
  try {
    const { items, order_type, table_number, discount, discount_type, discount_value, tax_rate, notes, status } = req.body;
    const existing = queryOne('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    if (existing.status === 'completed') {
      return res.status(400).json({ success: false, error: 'Cannot modify a completed order' });
    }

    const result = transaction(() => {
      const now = new Date().toISOString();
      let calculatedSubtotal = existing.subtotal;
      let effectiveTaxRate = tax_rate !== undefined ? Number(tax_rate) : existing.tax_rate;

      if (items && items.length > 0) {
        // Replace items
        run('DELETE FROM order_items WHERE order_id = ?', [existing.id]);
        calculatedSubtotal = 0;
        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          const itemId = `item-${existing.order_number}-${i + 1}-${Date.now().toString().slice(-4)}`;
          const itemTotal = Number(it.unit_price) * Number(it.quantity);
          calculatedSubtotal += itemTotal;
          run(
            `INSERT INTO order_items (id, order_id, product_id, product_name, unit_price, quantity, total_price, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [itemId, existing.id, it.product_id || '', it.product_name, Number(it.unit_price), Number(it.quantity), itemTotal, it.notes || '']
          );
        }
      }

      let calculatedDiscount = discount !== undefined ? Number(discount) : existing.discount;
      const dType = discount_type || existing.discount_type;
      const dVal = discount_value !== undefined ? Number(discount_value) : existing.discount_value;
      if (dType === 'percent') {
        calculatedDiscount = Math.round((calculatedSubtotal * dVal) / 100);
      }
      calculatedDiscount = Math.min(calculatedSubtotal, Math.max(0, calculatedDiscount));

      const taxable = calculatedSubtotal - calculatedDiscount;
      const calculatedTax = Math.round(taxable * (effectiveTaxRate / 100));
      const calculatedGrandTotal = taxable + calculatedTax;

      run(
        `UPDATE orders SET
          order_type = ?, table_number = ?, subtotal = ?, discount = ?,
          discount_type = ?, discount_value = ?, tax_rate = ?, tax_amount = ?,
          grand_total = ?, notes = ?, status = ?, updated_at = ?
         WHERE id = ?`,
        [
          order_type || existing.order_type,
          table_number !== undefined ? table_number : existing.table_number,
          calculatedSubtotal,
          calculatedDiscount,
          dType,
          dVal,
          effectiveTaxRate,
          calculatedTax,
          calculatedGrandTotal,
          notes !== undefined ? notes : existing.notes,
          status || existing.status,
          now,
          existing.id
        ]
      );

      // Handle table switch
      if (existing.table_number && existing.table_number !== table_number) {
        run('UPDATE restaurant_tables SET status = ?, current_order_id = ? WHERE table_number = ?', ['available', null, existing.table_number]);
      }
      if (table_number) {
        run('UPDATE restaurant_tables SET status = ?, current_order_id = ? WHERE table_number = ?', ['occupied', existing.id, table_number]);
      }

      const updatedOrder = queryOne('SELECT * FROM orders WHERE id = ?', [existing.id]);
      const updatedItems = queryAll('SELECT * FROM order_items WHERE order_id = ?', [existing.id]);
      return { ...updatedOrder, items: updatedItems };
    });

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/orders/:id (Cancel order)
router.delete('/:id', (req, res) => {
  try {
    const existing = queryOne('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const now = new Date().toISOString();
    transaction(() => {
      run('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?', ['cancelled', now, existing.id]);
      if (existing.table_number) {
        run('UPDATE restaurant_tables SET status = ?, current_order_id = ?, updated_at = ? WHERE current_order_id = ?', ['available', null, now, existing.id]);
      }
    });

    res.json({ success: true, message: 'Order cancelled successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

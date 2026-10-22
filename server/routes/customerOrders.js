const express = require('express');
const router = express.Router();
const { queryAll, queryOne, run, transaction } = require('../db');

function getNextOrderNumber() {
  const row = queryOne('SELECT MAX(order_number) as max_num FROM orders');
  return (row && row.max_num) ? row.max_num + 1 : 1001;
}

// POST /api/customer/orders
// Customer places an order via QR menu
router.post('/', (req, res) => {
  try {
    const {
      table_number,
      customer_name = 'Table Guest',
      customer_phone = '',
      items = [],
      notes = '',
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Cannot place an empty order' });
    }

    if (!table_number) {
      return res.status(400).json({ success: false, error: 'Table number is required for dine-in orders' });
    }

    const result = transaction(() => {
      const orderNum = getNextOrderNumber();
      const orderId = 'ord-cust-' + orderNum;
      const now = new Date().toISOString();

      let subtotal = 0;
      for (const item of items) {
        subtotal += Number(item.unit_price) * Number(item.quantity);
      }

      // Fetch default tax rate from settings
      const taxRow = queryOne('SELECT value FROM settings WHERE key = "tax_rate"');
      const taxRate = taxRow ? Number(taxRow.value) : 13;
      const taxAmount = Math.round(subtotal * (taxRate / 100));
      const grandTotal = subtotal + taxAmount;

      run(
        `INSERT INTO orders (
          id, order_number, order_type, table_number, status,
          subtotal, discount, discount_type, discount_value,
          tax_rate, tax_amount, grand_total, cashier_name,
          customer_name, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId, orderNum, 'dine_in', table_number, 'pending',
          subtotal, 0, 'fixed', 0,
          taxRate, taxAmount, grandTotal, 'Self Order (QR Menu)',
          customer_name, notes, now, now
        ]
      );

      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const itemId = `item-${orderNum}-${i + 1}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
        const total = Number(it.unit_price) * Number(it.quantity);
        run(
          `INSERT INTO order_items (id, order_id, product_id, product_name, unit_price, quantity, total_price, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [itemId, orderId, it.product_id || '', it.product_name, Number(it.unit_price), Number(it.quantity), total, it.notes || '']
        );
      }

      // Mark table as occupied
      run(
        'UPDATE restaurant_tables SET status = ?, current_order_id = ?, updated_at = ? WHERE table_number = ?',
        ['occupied', orderId, now, table_number]
      );

      return {
        order_id: orderId,
        order_number: orderNum,
        table_number,
        grand_total: grandTotal,
        status: 'pending',
        created_at: now,
      };
    });

    res.status(201).json({
      success: true,
      data: result,
      message: `Your order #${result.order_number} has been sent to the Loaf n Leaf kitchen!`,
    });
  } catch (err) {
    console.error('Customer order error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/customer/orders/table/:tableNumber
// Check order status for customer at table
router.get('/table/:tableNumber', (req, res) => {
  try {
    const tableNumber = req.params.tableNumber.toUpperCase();
    const table = queryOne('SELECT * FROM restaurant_tables WHERE table_number = ?', [tableNumber]);

    if (!table) {
      return res.status(404).json({ success: false, error: 'Table not found' });
    }

    if (!table.current_order_id) {
      return res.json({ success: true, active_order: null });
    }

    const order = queryOne('SELECT * FROM orders WHERE id = ?', [table.current_order_id]);
    const items = queryAll('SELECT * FROM order_items WHERE order_id = ?', [table.current_order_id]);

    res.json({
      success: true,
      active_order: {
        ...order,
        items,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

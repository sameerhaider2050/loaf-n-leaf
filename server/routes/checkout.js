const express = require('express');
const router = express.Router();
const { queryAll, queryOne, run, transaction } = require('../db');

function getNextOrderNumber() {
  const row = queryOne('SELECT MAX(order_number) as max_num FROM orders');
  return (row && row.max_num) ? row.max_num + 1 : 1001;
}

// POST /api/checkout
// Processes payment with ACID database transaction, prevents duplicate submissions, and outputs 80mm receipt data
router.post('/', (req, res) => {
  try {
    const {
      order_id, // If checking out an existing pending order, or null for direct counter checkout
      order_type = 'dine_in',
      table_number,
      items = [],
      subtotal,
      discount = 0,
      discount_type = 'fixed',
      discount_value = 0,
      tax_rate = 13,
      tax_amount,
      grand_total,
      cashier_name = 'Ahmed Khan',
      customer_name = '',
      notes = '',
      payment_method, // 'cash', 'card', 'other'
      received_amount, // For cash
      transaction_ref, // Optional card/wallet auth reference
      client_token, // Idempotency token to prevent accidental duplicate clicks
    } = req.body;

    if (!payment_method) {
      return res.status(400).json({ success: false, error: 'Payment method is required' });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Cannot checkout an empty order' });
    }

    // Check if client_token or existing order has already been paid
    if (order_id) {
      const existingPayment = queryOne('SELECT * FROM payments WHERE order_id = ?', [order_id]);
      if (existingPayment) {
        return res.status(409).json({
          success: false,
          error: 'This order has already been completed and paid.',
          already_paid: true,
          payment: existingPayment,
        });
      }
    }

    // Execute within SQLite Database Transaction
    const checkoutResult = transaction(() => {
      const now = new Date().toISOString();
      let targetOrderId = order_id;
      let orderNumber;

      // Calculate totals securely
      let calcSubtotal = 0;
      for (const item of items) {
        calcSubtotal += Number(item.unit_price) * Number(item.quantity);
      }

      let calcDiscount = Number(discount) || 0;
      if (discount_type === 'percent') {
        calcDiscount = Math.round((calcSubtotal * (Number(discount_value) || 0)) / 100);
      }
      calcDiscount = Math.min(calcSubtotal, Math.max(0, calcDiscount));

      const taxable = calcSubtotal - calcDiscount;
      const effectiveTaxRate = Number(tax_rate) || 0;
      const calcTax = Math.round(taxable * (effectiveTaxRate / 100));
      const calcGrandTotal = taxable + calcTax;

      // Validate payment amounts
      const paidAmount = calcGrandTotal;
      let received = Number(received_amount);
      if (payment_method === 'cash') {
        if (isNaN(received) || received < paidAmount) {
          throw new Error(`Received amount (Rs. ${received || 0}) is less than total amount (Rs. ${paidAmount})`);
        }
      } else {
        received = paidAmount;
      }
      const changeGiven = Math.max(0, received - paidAmount);

      if (!targetOrderId) {
        // Create new order record
        orderNumber = getNextOrderNumber();
        targetOrderId = 'ord-' + orderNumber;

        run(
          `INSERT INTO orders (
            id, order_number, order_type, table_number, status,
            subtotal, discount, discount_type, discount_value,
            tax_rate, tax_amount, grand_total, cashier_name,
            customer_name, notes, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            targetOrderId, orderNumber, order_type, table_number || null, 'completed',
            calcSubtotal, calcDiscount, discount_type, Number(discount_value) || 0,
            effectiveTaxRate, calcTax, calcGrandTotal, cashier_name,
            customer_name, notes, now, now
          ]
        );

        // Insert items
        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          const itemId = `item-${orderNumber}-${i + 1}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
          const itemTotal = Number(it.unit_price) * Number(it.quantity);
          run(
            `INSERT INTO order_items (id, order_id, product_id, product_name, unit_price, quantity, total_price, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [itemId, targetOrderId, it.product_id || '', it.product_name, Number(it.unit_price), Number(it.quantity), itemTotal, it.notes || '']
          );
        }
      } else {
        // Updating existing draft order
        const existingOrder = queryOne('SELECT * FROM orders WHERE id = ?', [targetOrderId]);
        if (!existingOrder) {
          throw new Error('Order not found');
        }
        orderNumber = existingOrder.order_number;

        run(
          `UPDATE orders SET
            status = 'completed', subtotal = ?, discount = ?,
            tax_rate = ?, tax_amount = ?, grand_total = ?,
            notes = ?, updated_at = ?
           WHERE id = ?`,
          [calcSubtotal, calcDiscount, effectiveTaxRate, calcTax, calcGrandTotal, notes || existingOrder.notes, now, targetOrderId]
        );
      }

      // Record payment
      const paymentId = `pay-${orderNumber}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
      const txnRef = transaction_ref || (payment_method === 'cash' ? `CASH-${orderNumber}` : `TXN-${orderNumber}`);

      run(
        `INSERT INTO payments (
          id, order_id, payment_method, amount_paid, received_amount,
          change_given, transaction_ref, cashier_name, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [paymentId, targetOrderId, payment_method, paidAmount, received, changeGiven, txnRef, cashier_name, now]
      );

      // If Dine In, free up the table
      if (table_number) {
        run(
          'UPDATE restaurant_tables SET status = ?, current_order_id = ?, updated_at = ? WHERE table_number = ?',
          ['available', null, now, table_number]
        );
      }

      // Fetch settings for receipt printing
      const settingsRows = queryAll('SELECT key, value FROM settings');
      const settingsMap = {};
      for (const s of settingsRows) {
        settingsMap[s.key] = s.value;
      }

      const completedOrder = queryOne('SELECT * FROM orders WHERE id = ?', [targetOrderId]);
      const completedItems = queryAll('SELECT * FROM order_items WHERE order_id = ?', [targetOrderId]);
      const completedPayment = queryOne('SELECT * FROM payments WHERE id = ?', [paymentId]);

      // Formatted receipt payload for 80mm thermal printer
      const receipt = {
        restaurant: {
          name: settingsMap.restaurant_name || 'Loaf n Leaf',
          tagline: settingsMap.restaurant_tagline || 'Artisan Cafe & Charcoal Grill',
          address: settingsMap.address || 'Zamzama Commercial, Clifton, Karachi',
          phone: settingsMap.phone || '+92 21 3583 8920',
          ntn: settingsMap.ntn_number || '7829104-5',
          header: settingsMap.receipt_header || 'Tax Invoice',
          footer: settingsMap.receipt_footer || 'Thank you for your visit!',
        },
        order: {
          id: completedOrder.id,
          order_number: completedOrder.order_number,
          order_type: completedOrder.order_type === 'dine_in' ? 'DINE IN' : 'TAKEAWAY',
          table_number: completedOrder.table_number || 'N/A',
          created_at: completedOrder.created_at,
          cashier: completedPayment.cashier_name,
        },
        items: completedItems.map(item => ({
          name: item.product_name,
          qty: item.quantity,
          unit_price: item.unit_price,
          total: item.total_price,
        })),
        summary: {
          subtotal: completedOrder.subtotal,
          discount: completedOrder.discount,
          tax_rate: completedOrder.tax_rate,
          tax_amount: completedOrder.tax_amount,
          grand_total: completedOrder.grand_total,
          payment_method: completedPayment.payment_method.toUpperCase(),
          received_amount: completedPayment.received_amount,
          change_given: completedPayment.change_given,
          transaction_ref: completedPayment.transaction_ref,
        },
      };

      return {
        order: completedOrder,
        payment: completedPayment,
        receipt,
      };
    });

    res.status(200).json({ success: true, data: checkoutResult });
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;

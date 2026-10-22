const express = require('express');
const router = express.Router();
const { queryAll, queryOne } = require('../db');

// Helper to calculate date ranges in local time (Asia/Karachi UTC+5)
function getDateBounds(period, fromDate, toDate) {
  const now = new Date();
  let start = new Date(now);
  let end = new Date(now);

  if (period === 'today') {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else if (period === 'yesterday') {
    start.setDate(start.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    end.setDate(end.getDate() - 1);
    end.setHours(23, 59, 59, 999);
  } else if (period === '7days') {
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else if (period === '30days') {
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else if (period === 'custom' && fromDate && toDate) {
    start = new Date(fromDate);
    start.setHours(0, 0, 0, 0);
    end = new Date(toDate);
    end.setHours(23, 59, 59, 999);
  } else {
    // Default to today
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  }

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

// GET /api/reports/summary
router.get('/summary', (req, res) => {
  try {
    const { period = 'today', from, to } = req.query;
    const { startIso, endIso } = getDateBounds(period, from, to);

    // Filter only completed orders in the range
    const orders = queryAll(
      `SELECT o.*, p.payment_method, p.amount_paid, p.created_at as paid_at
       FROM orders o
       JOIN payments p ON p.order_id = o.id
       WHERE o.status = 'completed' AND o.created_at >= ? AND o.created_at <= ?
       ORDER BY o.created_at DESC`,
      [startIso, endIso]
    );

    let totalSales = 0;
    let cashSales = 0;
    let cardSales = 0;
    let otherSales = 0;
    let totalTax = 0;
    let totalDiscount = 0;

    for (const order of orders) {
      totalSales += order.grand_total;
      totalTax += order.tax_amount;
      totalDiscount += order.discount;

      const method = (order.payment_method || '').toLowerCase();
      if (method === 'cash') {
        cashSales += order.grand_total;
      } else if (method === 'card') {
        cardSales += order.grand_total;
      } else {
        otherSales += order.grand_total;
      }
    }

    const totalOrders = orders.length;
    const averageOrderValue = totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0;

    // Trend grouping:
    // If today or yesterday: group by hour (00:00 to 23:00)
    // If 7 days or 30 days: group by day (YYYY-MM-DD)
    const trendMap = {};

    if (period === 'today' || period === 'yesterday') {
      // 24 hourly buckets
      for (let h = 0; h < 24; h++) {
        const hourLabel = `${h.toString().padStart(2, '0')}:00`;
        trendMap[hourLabel] = 0;
      }
      for (const order of orders) {
        const d = new Date(order.created_at);
        const hourLabel = `${d.getHours().toString().padStart(2, '0')}:00`;
        trendMap[hourLabel] = (trendMap[hourLabel] || 0) + order.grand_total;
      }
    } else {
      // Daily buckets
      for (const order of orders) {
        const d = order.created_at.slice(0, 10);
        trendMap[d] = (trendMap[d] || 0) + order.grand_total;
      }
    }

    const trend = Object.keys(trendMap).map(key => ({
      label: key,
      sales: trendMap[key],
    }));

    // Top selling products in this period
    const topItems = queryAll(
      `SELECT oi.product_name, SUM(oi.quantity) as total_qty, SUM(oi.total_price) as total_revenue
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       WHERE o.status = 'completed' AND o.created_at >= ? AND o.created_at <= ?
       GROUP BY oi.product_name
       ORDER BY total_qty DESC
       LIMIT 5`,
      [startIso, endIso]
    );

    res.json({
      success: true,
      data: {
        period,
        start: startIso,
        end: endIso,
        metrics: {
          totalSales,
          totalOrders,
          averageOrderValue,
          cashSales,
          cardSales,
          otherSales,
          totalTax,
          totalDiscount,
        },
        trend,
        topItems,
        recentOrders: orders.slice(0, 20),
      },
    });
  } catch (err) {
    console.error('Error generating sales report:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/reports/history
router.get('/history', (req, res) => {
  try {
    const { period = 'today', from, to, payment_method, search } = req.query;
    const { startIso, endIso } = getDateBounds(period, from, to);

    let sql = `
      SELECT 
        o.id,
        o.order_number,
        o.order_type,
        o.table_number,
        o.subtotal,
        o.discount,
        o.tax_amount,
        o.grand_total,
        o.cashier_name,
        o.created_at,
        p.payment_method,
        p.received_amount,
        p.change_given,
        p.transaction_ref
      FROM orders o
      JOIN payments p ON p.order_id = o.id
      WHERE o.status = 'completed' AND o.created_at >= ? AND o.created_at <= ?
    `;
    const params = [startIso, endIso];

    if (payment_method && payment_method !== 'all') {
      sql += ' AND p.payment_method = ?';
      params.push(payment_method);
    }

    if (search) {
      sql += ' AND (o.order_number LIKE ? OR o.table_number LIKE ? OR o.cashier_name LIKE ? OR p.transaction_ref LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    sql += ' ORDER BY o.created_at DESC';

    const history = queryAll(sql, params);
    res.json({ success: true, data: history });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

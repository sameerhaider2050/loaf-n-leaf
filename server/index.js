const express = require('express');
const cors = require('cors');
const path = require('path');
const { getDb } = require('./db');

const productsRouter = require('./routes/products');
const categoriesRouter = require('./routes/categories');
const tablesRouter = require('./routes/tables');
const ordersRouter = require('./routes/orders');
const checkoutRouter = require('./routes/checkout');
const reportsRouter = require('./routes/reports');
const settingsRouter = require('./routes/settings');
const authRouter = require('./routes/auth');
const staffRouter = require('./routes/staff');
const customerOrdersRouter = require('./routes/customerOrders');
const deviceAuthRouter = require('./routes/deviceAuth');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/products', productsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/tables', tablesRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/checkout', checkoutRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/auth', authRouter);
app.use('/api/staff', staffRouter);
app.use('/api/customer/orders', customerOrdersRouter);
app.use('/api/device', deviceAuthRouter);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    system: 'Loaf n Leaf Restaurant System',
    timestamp: new Date().toISOString(),
    timezone: 'Asia/Karachi',
    currency: 'PKR',
  });
});

// Serve static client assets in production
const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDistPath));

// Fallback to index.html for client-side routing
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    return res.sendFile(path.join(clientDistPath, 'index.html'), (err) => {
      if (err) {
        res.status(404).send('Loaf n Leaf API is active. Client build not found.');
      }
    });
  }
  next();
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ success: false, error: err.message || 'Internal server error' });
});

async function startServer() {
  try {
    await getDb();
    app.listen(PORT, () => {
      console.log(`[Server] Server running on http://localhost:${PORT}`);
      console.log(`[Server] SQLite database persisted at server/data/pos.sqlite`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();

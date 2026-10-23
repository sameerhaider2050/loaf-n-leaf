const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'pos.sqlite');

let db = null;
let SQL = null;

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function saveToDisk() {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_FILE, buffer);
  } catch (err) {
    console.error('Error saving SQLite database to disk:', err);
  }
}

async function getDb() {
  if (db) return db;

  if (!SQL) {
    SQL = await initSqlJs();
  }

  if (fs.existsSync(DB_FILE)) {
    try {
      const fileBuffer = fs.readFileSync(DB_FILE);
      db = new SQL.Database(fileBuffer);
      console.log('Loaded existing SQLite database from', DB_FILE);
    } catch (err) {
      console.error('Error reading existing DB file, creating new:', err);
      db = new SQL.Database();
    }
  } else {
    console.log('Initializing fresh SQLite database...');
    db = new SQL.Database();
  }

  initSchema();
  return db;
}

function initSchema() {
  // Execute schema creation
  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price REAL NOT NULL,
      cost REAL DEFAULT 0,
      image TEXT,
      available INTEGER DEFAULT 1,
      description TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS restaurant_tables (
      id TEXT PRIMARY KEY,
      table_number TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      capacity INTEGER DEFAULT 4,
      status TEXT DEFAULT 'available', -- 'available', 'occupied', 'reserved'
      current_order_id TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_number INTEGER NOT NULL,
      order_type TEXT NOT NULL DEFAULT 'dine_in', -- 'dine_in', 'takeaway'
      table_number TEXT,
      status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'preparing', 'ready', 'completed', 'cancelled'
      subtotal REAL NOT NULL DEFAULT 0,
      discount REAL NOT NULL DEFAULT 0,
      discount_type TEXT DEFAULT 'fixed', -- 'fixed' or 'percent'
      discount_value REAL DEFAULT 0,
      tax_rate REAL NOT NULL DEFAULT 13,
      tax_amount REAL NOT NULL DEFAULT 0,
      grand_total REAL NOT NULL DEFAULT 0,
      cashier_name TEXT NOT NULL DEFAULT 'Ahmed Khan',
      customer_name TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      unit_price REAL NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      total_price REAL NOT NULL,
      notes TEXT,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      payment_method TEXT NOT NULL, -- 'cash', 'card', 'other'
      amount_paid REAL NOT NULL,
      received_amount REAL NOT NULL,
      change_given REAL NOT NULL DEFAULT 0,
      transaction_ref TEXT,
      cashier_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      pin TEXT,
      role TEXT NOT NULL DEFAULT 'cashier', -- 'admin', 'cashier', 'order_taker'
      phone TEXT,
      avatar TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS authorized_devices (
      id TEXT PRIMARY KEY,
      device_fingerprint_hash TEXT UNIQUE NOT NULL,
      device_name TEXT NOT NULL,
      assigned_user_id TEXT,
      permitted_roles TEXT NOT NULL, -- JSON array string e.g. '["cashier"]'
      status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'revoked'
      device_info TEXT, -- JSON or string with OS, browser, user agent
      ip_address TEXT,
      last_active_at TEXT,
      approved_by TEXT,
      approved_at TEXT,
      revoked_by TEXT,
      revoked_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (assigned_user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS device_credentials (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      public_key_spki TEXT NOT NULL,
      algorithm TEXT NOT NULL DEFAULT 'ECDSA-P256',
      key_format TEXT NOT NULL DEFAULT 'spki',
      created_at TEXT NOT NULL,
      FOREIGN KEY (device_id) REFERENCES authorized_devices(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS device_approval_requests (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      requested_role TEXT NOT NULL,
      device_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
      admin_notes TEXT,
      reviewed_by TEXT,
      reviewed_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (device_id) REFERENCES authorized_devices(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS device_sessions (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      session_token TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      is_valid INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY (device_id) REFERENCES authorized_devices(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS device_audit_logs (
      id TEXT PRIMARY KEY,
      device_id TEXT,
      user_id TEXT,
      action TEXT NOT NULL,
      details TEXT,
      ip_address TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // Ensure default staff, waiter, and admin exist
  ensureDefaultUsers();

  // Check if initial categories and products exist
  const catCount = queryOne('SELECT COUNT(*) as count FROM categories');
  if (!catCount || catCount.count === 0) {
    seedInitialData();
  } else {
    saveToDisk();
  }
}

// Database helper functions
function queryAll(sql, params = []) {
  if (!db) throw new Error('Database not initialized');
  const stmt = db.prepare(sql);
  if (params && params.length > 0) {
    stmt.bind(params);
  }
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

let inTransaction = false;

function run(sql, params = []) {
  if (!db) throw new Error('Database not initialized');
  db.run(sql, params);
  if (!inTransaction) {
    saveToDisk();
  }
  return true;
}

function transaction(callback) {
  if (!db) throw new Error('Database not initialized');
  inTransaction = true;
  try {
    db.run('BEGIN TRANSACTION;');
    const result = callback();
    db.run('COMMIT;');
    inTransaction = false;
    saveToDisk();
    return result;
  } catch (err) {
    inTransaction = false;
    try {
      db.run('ROLLBACK;');
    } catch (e) {
      console.error('Rollback error:', e);
    }
    throw err;
  }
}

function ensureDefaultUsers() {
  const userCount = queryOne('SELECT COUNT(*) as count FROM users');
  const now = new Date().toISOString();
  
  if (!userCount || userCount.count === 0) {
    console.log('Seeding default Admin, Cashier, and Waiter accounts for Loaf n Leaf...');
    
    // Default Admin (password: admin123, pin: 1234)
    db.run(
      `INSERT INTO users (id, name, email, username, password_hash, pin, role, phone, avatar, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['usr-admin-1', 'Restaurant Admin', 'admin@loafnleaf.com', 'admin', 'admin123', '1234', 'admin', '+92 300 1234567', '', 1, now]
    );

    // Default Cashier 1 (password: cashier123, pin: 5678)
    db.run(
      `INSERT INTO users (id, name, email, username, password_hash, pin, role, phone, avatar, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['usr-cashier-1', 'Ahmed Khan (Cashier)', 'cashier@loafnleaf.com', 'cashier1', 'cashier123', '5678', 'cashier', '+92 301 9876543', '', 1, now]
    );

    // Default Cashier 2 (password: cashier123, pin: 4321)
    db.run(
      `INSERT INTO users (id, name, email, username, password_hash, pin, role, phone, avatar, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['usr-cashier-2', 'Sara Malik (Shift 2)', 'sara@loafnleaf.com', 'cashier2', 'cashier123', '4321', 'cashier', '+92 302 5551234', '', 1, now]
    );

    // Default Waiter / Order Taker (password: waiter123, pin: 7890)
    db.run(
      `INSERT INTO users (id, name, email, username, password_hash, pin, role, phone, avatar, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['usr-waiter-1', 'Hamza Tariq (Waiter)', 'waiter@loafnleaf.com', 'waiter1', 'waiter123', '7890', 'order_taker', '+92 333 1122334', '', 1, now]
    );

    saveToDisk();
  } else {
    // If database exists, verify waiter user is present
    const waiter = queryOne("SELECT id FROM users WHERE role = 'order_taker'");
    if (!waiter) {
      db.run(
        `INSERT INTO users (id, name, email, username, password_hash, pin, role, phone, avatar, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ['usr-waiter-1', 'Hamza Tariq (Waiter)', 'waiter@loafnleaf.com', 'waiter1', 'waiter123', '7890', 'order_taker', '+92 333 1122334', '', 1, now]
      );
      saveToDisk();
    }
  }

  // Ensure default device settings
  const maxDevSetting = queryOne("SELECT value FROM settings WHERE key = 'max_devices_per_employee'");
  if (!maxDevSetting) {
    db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('max_devices_per_employee', '2')");
    saveToDisk();
  }
}

function seedInitialData() {
  console.log('Seeding initial restaurant data for Loaf n Leaf...');
  const now = new Date().toISOString();

  // Categories
  const categories = [
    { id: 'cat-1', name: 'All Items', slug: 'all', sort_order: 0 },
    { id: 'cat-2', name: 'Burgers', slug: 'burgers', sort_order: 1 },
    { id: 'cat-3', name: 'Pizza', slug: 'pizza', sort_order: 2 },
    { id: 'cat-4', name: 'BBQ & Grills', slug: 'bbq', sort_order: 3 },
    { id: 'cat-5', name: 'Drinks', slug: 'drinks', sort_order: 4 },
    { id: 'cat-6', name: 'Desserts', slug: 'desserts', sort_order: 5 },
  ];

  for (const cat of categories) {
    db.run(
      'INSERT INTO categories (id, name, slug, sort_order) VALUES (?, ?, ?, ?)',
      [cat.id, cat.name, cat.slug, cat.sort_order]
    );
  }

  // Products: Initialized empty so restaurant Admin has full power to add custom items
  const products = [];

  // Tables
  const tables = [
    { id: 'tbl-1', number: 'T-01', name: 'Table 1', capacity: 2, status: 'available' },
    { id: 'tbl-2', number: 'T-02', name: 'Table 2', capacity: 2, status: 'available' },
    { id: 'tbl-3', number: 'T-03', name: 'Table 3', capacity: 4, status: 'available' },
    { id: 'tbl-4', number: 'T-04', name: 'Table 4', capacity: 4, status: 'available' },
    { id: 'tbl-5', number: 'T-05', name: 'Table 5', capacity: 4, status: 'available' },
    { id: 'tbl-6', number: 'T-06', name: 'Table 6', capacity: 6, status: 'available' },
    { id: 'tbl-7', number: 'T-07', name: 'Table 7', capacity: 6, status: 'available' },
    { id: 'tbl-8', number: 'T-08', name: 'Table 8', capacity: 8, status: 'available' },
    { id: 'tbl-9', number: 'T-09', name: 'Family Booth 1', capacity: 6, status: 'available' },
    { id: 'tbl-10', number: 'T-10', name: 'Family Booth 2', capacity: 6, status: 'available' },
    { id: 'tbl-11', number: 'T-11', name: 'Outdoor Terrace 1', capacity: 4, status: 'available' },
    { id: 'tbl-12', number: 'T-12', name: 'Outdoor Terrace 2', capacity: 4, status: 'available' },
  ];

  for (const tbl of tables) {
    db.run(
      `INSERT INTO restaurant_tables (id, table_number, name, capacity, status, current_order_id, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [tbl.id, tbl.number, tbl.name, tbl.capacity, tbl.status, null, now]
    );
  }

  // Restaurant Settings
  const settings = [
    { key: 'restaurant_name', value: 'Loaf n Leaf' },
    { key: 'restaurant_tagline', value: 'Artisan Cafe & Charcoal Grill' },
    { key: 'address', value: 'Plot 12-C, 7th Zamzama Commercial Lane, Clifton, Karachi' },
    { key: 'phone', value: '+92 21 3583 8920' },
    { key: 'ntn_number', value: '7829104-5' },
    { key: 'tax_name', value: 'Sindh Sales Tax (SRB)' },
    { key: 'tax_rate', value: '13' },
    { key: 'tax_enabled', value: 'true' },
    { key: 'currency_symbol', value: 'Rs.' },
    { key: 'receipt_header', value: 'LOAF N LEAF RESTAURANT\nTax Invoice' },
    { key: 'receipt_footer', value: 'Thank you for dining with Loaf n Leaf!\nArtisan Restaurant & Table Service' },
    { key: 'active_cashier', value: 'Ahmed Khan' },
    { key: 'active_shift', value: 'Evening Shift (04:00 PM - 12:00 AM)' },
  ];

  for (const s of settings) {
    db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [s.key, s.value]);
  }

  // Orders, kitchen queue, and sales start completely clean at zero
  // seedRealisticSampleOrders();

  saveToDisk();
}

function seedRealisticSampleOrders() {
  const today = new Date();
  
  // Create 6 completed sample orders throughout today and yesterday
  const sampleData = [
    {
      offsetHours: -6,
      type: 'dine_in',
      table: 'T-03',
      cashier: 'Ahmed Khan',
      items: [
        { name: 'Gourmet Beef Smash Burger', price: 950, qty: 2 },
        { name: 'Fresh Mint Lemonade', price: 340, qty: 2 },
      ],
      discount: 0,
      paymentMethod: 'card',
    },
    {
      offsetHours: -4.5,
      type: 'takeaway',
      table: null,
      cashier: 'Ahmed Khan',
      items: [
        { name: 'Smoked BBQ Tikka Pizza (Medium)', price: 1450, qty: 1 },
        { name: 'Cold Soft Drink (Can 350ml)', price: 140, qty: 2 },
        { name: 'Belgian Chocolate Fudge Brownie', price: 550, qty: 1 },
      ],
      discount: 100,
      paymentMethod: 'cash',
      received: 2500,
    },
    {
      offsetHours: -3,
      type: 'dine_in',
      table: 'T-06',
      cashier: 'Ahmed Khan',
      items: [
        { name: 'Chicken Malai Boti (8 pcs)', price: 920, qty: 2 },
        { name: 'Beef Seekh Kabab (4 pcs)', price: 880, qty: 1 },
        { name: 'Garlic Butter Roghni Naan', price: 120, qty: 4 },
        { name: 'Peach Iced Tea', price: 380, qty: 3 },
      ],
      discount: 0,
      paymentMethod: 'cash',
      received: 5000,
    },
    {
      offsetHours: -1.5,
      type: 'dine_in',
      table: 'T-08',
      cashier: 'Ahmed Khan',
      items: [
        { name: 'Pepperoni Feast Pizza (Medium)', price: 1650, qty: 2 },
        { name: 'Zinger Crispy Chicken Burger', price: 780, qty: 1 },
        { name: 'Blue Lagoon Soda Refresher', price: 420, qty: 3 },
        { name: 'Lotus Biscoff Cheesecake', price: 680, qty: 2 },
      ],
      discount: 250,
      paymentMethod: 'card',
    },
    {
      offsetHours: -0.5,
      type: 'takeaway',
      table: null,
      cashier: 'Ahmed Khan',
      items: [
        { name: 'Zinger Crispy Chicken Burger', price: 780, qty: 2 },
        { name: 'Cold Soft Drink (Can 350ml)', price: 140, qty: 2 },
      ],
      discount: 0,
      paymentMethod: 'other', // e.g. JazzCash
    },
  ];

  let orderNum = 1001;
  const taxRate = 13;

  for (const s of sampleData) {
    const orderDate = new Date(today.getTime() + s.offsetHours * 3600 * 1000);
    const orderId = 'ord-' + orderNum;
    
    let subtotal = 0;
    for (const it of s.items) {
      subtotal += it.price * it.qty;
    }
    const discount = s.discount || 0;
    const taxable = Math.max(0, subtotal - discount);
    const taxAmount = Math.round(taxable * (taxRate / 100));
    const grandTotal = taxable + taxAmount;

    db.run(
      `INSERT INTO orders (id, order_number, order_type, table_number, status, subtotal, discount, discount_type, discount_value, tax_rate, tax_amount, grand_total, cashier_name, customer_name, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [orderId, orderNum, s.type, s.table, 'completed', subtotal, discount, 'fixed', discount, taxRate, taxAmount, grandTotal, s.cashier, s.type === 'dine_in' ? 'Guest' : 'Takeaway Customer', '', orderDate.toISOString(), orderDate.toISOString()]
    );

    for (let i = 0; i < s.items.length; i++) {
      const it = s.items[i];
      db.run(
        `INSERT INTO order_items (id, order_id, product_id, product_name, unit_price, quantity, total_price, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [`item-${orderNum}-${i+1}`, orderId, 'p-sample', it.name, it.price, it.qty, it.price * it.qty, '']
      );
    }

    const payId = 'pay-' + orderNum;
    const received = s.received || grandTotal;
    const change = Math.max(0, received - grandTotal);
    db.run(
      `INSERT INTO payments (id, order_id, payment_method, amount_paid, received_amount, change_given, transaction_ref, cashier_name, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [payId, orderId, s.paymentMethod, grandTotal, received, change, 'TXN-' + orderNum, s.cashier, orderDate.toISOString()]
    );

    orderNum++;
  }
}

module.exports = {
  getDb,
  queryAll,
  queryOne,
  run,
  transaction,
  saveToDisk,
  seedInitialData,
};

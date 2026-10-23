const path = require('path');
const { getDb, queryAll, run, transaction } = require('../server/db');

async function authorizeCurrentDevices() {
  console.log('====================================================');
  console.log('  LOAF N LEAF - ADMIN TERMINAL AUTHORIZATION TOOL   ');
  console.log('====================================================\n');

  try {
    await getDb();

    const devices = queryAll('SELECT * FROM authorized_devices');
    if (devices.length === 0) {
      console.log('[INFO] No devices registered yet in the database.');
      console.log('Please open http://localhost:5000 in your browser and attempt login to register your device first.');
      process.exit(0);
    }

    console.log(`Found ${devices.length} registered terminal(s):`);
    devices.forEach((d, idx) => {
      console.log(`  [${idx + 1}] ID: ${d.id}`);
      console.log(`      Name: ${d.device_name}`);
      console.log(`      Fingerprint: ${d.device_fingerprint_hash}`);
      console.log(`      Current Status: ${d.status}`);
      console.log(`      Current Permitted Roles: ${d.permitted_roles}`);
      console.log(`      Assigned User: ${d.assigned_user_id || 'None (Shared)'}`);
      console.log('----------------------------------------------------');
    });

    const now = new Date().toISOString();
    const elevatedRoles = JSON.stringify(['admin', 'cashier', 'order_taker']);

    transaction(() => {
      for (const d of devices) {
        run(
          `UPDATE authorized_devices
           SET status = 'approved',
               permitted_roles = ?,
               assigned_user_id = NULL,
               approved_by = 'Restaurant Owner (Dev CLI)',
               approved_at = ?,
               revoked_by = NULL,
               revoked_at = NULL,
               last_active_at = ?
           WHERE id = ?`,
          [elevatedRoles, now, now, d.id]
        );

        run(
          `UPDATE device_approval_requests 
           SET status = 'approved', reviewed_by = 'Restaurant Owner (Dev CLI)', reviewed_at = ?
           WHERE device_id = ?`,
          [now, d.id]
        );

        const auditId = 'aud-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
        run(
          `INSERT INTO device_audit_logs (id, device_id, user_id, action, details, ip_address, created_at)
           VALUES (?, ?, NULL, 'DEV_ADMIN_AUTHORIZED', 'Elevated to [admin, cashier, order_taker] by Owner CLI tool', '127.0.0.1', ?)`,
          [auditId, d.id, now]
        );
      }
    });

    console.log('\n[SUCCESS] All registered terminal(s) have been successfully authorized for:');
    console.log('  -> ADMIN (Full administrative dashboard & settings)');
    console.log('  -> CASHIER (Cashier POS & settlements)');
    console.log('  -> ORDER_TAKER (Floor tables & waiter ordering)');
    console.log('\nAssigned user constraint cleared to allow shared multi-role testing on this PC.');
    console.log('Cryptographic keys, database records, employees, orders, and tables were fully preserved.');
    console.log('\nYou can now log in as Admin on this Windows PC without "Role Not Permitted on Terminal" error!');
    process.exit(0);
  } catch (err) {
    console.error('[ERROR] Failed to authorize devices:', err);
    process.exit(1);
  }
}

authorizeCurrentDevices();

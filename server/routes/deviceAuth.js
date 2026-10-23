const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { queryAll, queryOne, run, transaction } = require('../db');

// In-memory challenge store with 60-second TTL
// key: challengeId -> { nonce, fingerprint, createdAt }
const challengeStore = new Map();

// Periodic cleanup of expired challenges
setInterval(() => {
  const now = Date.now();
  for (const [id, challenge] of challengeStore.entries()) {
    if (now - challenge.createdAt > 60000) {
      challengeStore.delete(id);
    }
  }
}, 30000);

// Helper: parse permitted_roles string safely
function parseRoles(rolesStr) {
  if (!rolesStr) return [];
  try {
    const parsed = JSON.parse(rolesStr);
    return Array.isArray(parsed) ? parsed : [String(parsed)];
  } catch {
    return rolesStr.split(',').map(r => r.trim()).filter(Boolean);
  }
}

// Helper: log device audit action
function logDeviceAudit(deviceId, userId, action, details, ip) {
  try {
    const id = 'aud-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    const now = new Date().toISOString();
    run(
      `INSERT INTO device_audit_logs (id, device_id, user_id, action, details, ip_address, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, deviceId || null, userId || null, action, details ? String(details) : '', ip || '', now]
    );
  } catch (err) {
    console.error('Audit log error:', err);
  }
}

// -------------------------------------------------------------
// 1. POST /api/device/challenge
// Client requests a cryptographically random challenge to sign
// -------------------------------------------------------------
router.post('/challenge', (req, res) => {
  try {
    const { deviceFingerprint } = req.body;
    if (!deviceFingerprint) {
      return res.status(400).json({ success: false, error: 'deviceFingerprint is required' });
    }

    const challengeId = crypto.randomUUID();
    const nonce = crypto.randomBytes(32).toString('hex');
    const timestamp = Date.now();

    challengeStore.set(challengeId, {
      nonce,
      fingerprint: deviceFingerprint,
      createdAt: timestamp,
    });

    res.json({
      success: true,
      data: {
        challengeId,
        nonce,
        timestamp,
        expiresIn: 60,
      },
    });
  } catch (err) {
    console.error('Challenge error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 2. POST /api/device/verify-and-login
// Authenticates employee + checks device cryptographic authorization
// -------------------------------------------------------------
router.post('/verify-and-login', async (req, res) => {
  try {
    const {
      identifier,
      password,
      pin,
      deviceFingerprint,
      publicKeySpki,
      challengeId,
      signature,
      deviceName,
      deviceInfo,
      requestedRole,
    } = req.body;

    // A. Validate Challenge
    if (!challengeId || !challengeStore.has(challengeId)) {
      return res.status(400).json({
        success: false,
        code: 'CHALLENGE_EXPIRED',
        error: 'Authentication challenge has expired or is invalid. Please retry.',
      });
    }

    const challenge = challengeStore.get(challengeId);
    challengeStore.delete(challengeId); // Single-use challenge (prevent replay)

    if (challenge.fingerprint !== deviceFingerprint) {
      return res.status(400).json({ success: false, error: 'Challenge fingerprint mismatch' });
    }

    // B. Authenticate Employee Credentials (Username/Email + Password OR Quick PIN)
    if (!identifier && !pin) {
      return res.status(400).json({ success: false, error: 'Username/Email or PIN is required' });
    }

    let user = null;
    if (pin) {
      user = queryOne('SELECT * FROM users WHERE pin = ? AND is_active = 1', [String(pin).trim()]);
    } else if (identifier) {
      const cleanIdent = String(identifier).trim().toLowerCase();
      user = queryOne(
        'SELECT * FROM users WHERE (LOWER(email) = ? OR LOWER(username) = ?) AND is_active = 1',
        [cleanIdent, cleanIdent]
      );
      if (user && user.password_hash !== password) {
        return res.status(401).json({ success: false, error: 'Incorrect password' });
      }
    }

    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid employee credentials or account inactive' });
    }

    // C. Verify Cryptographic Proof of Device Possession
    if (!publicKeySpki || !signature) {
      return res.status(400).json({ success: false, error: 'Device public key and cryptographic signature required' });
    }

    let isSignatureValid = false;
    try {
      const pubKeyDer = Buffer.from(publicKeySpki, 'base64');
      const pubKey = crypto.createPublicKey({
        key: pubKeyDer,
        format: 'der',
        type: 'spki',
      });

      // Verify IEEE P1363 ECDSA signature over the challenge nonce
      isSignatureValid = crypto.verify(
        'SHA256',
        Buffer.from(challenge.nonce),
        { key: pubKey, dsaEncoding: 'ieee-p1363' },
        Buffer.from(signature, 'base64')
      );
    } catch (cryptoErr) {
      console.error('Device signature verification error:', cryptoErr);
      isSignatureValid = false;
    }

    if (!isSignatureValid) {
      logDeviceAudit(null, user.id, 'SIGNATURE_VERIFICATION_FAILED', `Device ${deviceFingerprint} failed signature check`, req.ip);
      return res.status(401).json({
        success: false,
        code: 'INVALID_DEVICE_SIGNATURE',
        error: 'Cryptographic device signature verification failed. Private key mismatch.',
      });
    }

    // D. Check Device Authorization Status in Database
    let device = queryOne('SELECT * FROM authorized_devices WHERE device_fingerprint_hash = ?', [deviceFingerprint]);
    const now = new Date().toISOString();

    // If device is completely new: Register as PENDING and notify administrator
    if (!device) {
      const newDeviceId = 'dev-' + Date.now();
      const finalDeviceName = (deviceName && deviceName.trim()) || 'Terminal ' + deviceFingerprint.substring(0, 6).toUpperCase();
      const infoStr = typeof deviceInfo === 'object' ? JSON.stringify(deviceInfo) : String(deviceInfo || '');
      const reqRole = requestedRole || user.role || 'order_taker';

      transaction(() => {
        // 1. Insert into authorized_devices with status 'pending'
        run(
          `INSERT INTO authorized_devices 
           (id, device_fingerprint_hash, device_name, assigned_user_id, permitted_roles, status, device_info, ip_address, created_at)
           VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
          [newDeviceId, deviceFingerprint, finalDeviceName, user.id, JSON.stringify([reqRole]), infoStr, req.ip, now]
        );

        // 2. Insert public key in device_credentials
        run(
          `INSERT INTO device_credentials (id, device_id, public_key_spki, algorithm, key_format, created_at)
           VALUES (?, ?, ?, 'ECDSA-P256', 'spki', ?)`,
          ['cred-' + Date.now(), newDeviceId, publicKeySpki, now]
        );

        // 3. Create approval request
        run(
          `INSERT INTO device_approval_requests (id, device_id, user_id, requested_role, device_name, status, created_at)
           VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
          ['req-' + Date.now(), newDeviceId, user.id, reqRole, finalDeviceName, now]
        );

        // 4. Audit log
        logDeviceAudit(newDeviceId, user.id, 'DEVICE_REGISTERED', `New device registration requested by ${user.name} for role ${reqRole}`, req.ip);
      });

      return res.status(403).json({
        success: false,
        code: 'DEVICE_UNAUTHORIZED',
        status: 'pending',
        deviceId: newDeviceId,
        deviceName: finalDeviceName,
        message: 'This device is not authorized. An approval request has been submitted to the restaurant administrator.',
      });
    }

    // E. Handle Existing Device Non-Approved States
    if (device.status === 'pending') {
      return res.status(403).json({
        success: false,
        code: 'DEVICE_PENDING_APPROVAL',
        status: 'pending',
        deviceId: device.id,
        deviceName: device.device_name,
        message: 'This device is awaiting administrator authorization.',
      });
    }

    if (device.status === 'rejected') {
      return res.status(403).json({
        success: false,
        code: 'DEVICE_REJECTED',
        status: 'rejected',
        deviceId: device.id,
        deviceName: device.device_name,
        message: 'This device has been rejected by the administrator. Contact management.',
      });
    }

    if (device.status === 'revoked') {
      return res.status(403).json({
        success: false,
        code: 'DEVICE_REVOKED',
        status: 'revoked',
        deviceId: device.id,
        deviceName: device.device_name,
        message: 'This device authorization was revoked by an administrator. All access is blocked.',
      });
    }

    // F. Role-Based Access Control (RBAC) + Device Access Control Matrix
    const permittedRoles = parseRoles(device.permitted_roles);
    const targetRole = requestedRole || user.role;

    // Admin accounts can access admin tools only if the device itself permits 'admin'
    // Cashier accounts can access POS only if the device permits 'cashier'
    // Waiters can access Order-Taker only if the device permits 'order_taker'
    const isRolePermittedOnDevice = permittedRoles.includes(targetRole) || permittedRoles.includes('*');

    if (!isRolePermittedOnDevice) {
      logDeviceAudit(
        device.id,
        user.id,
        'DEVICE_ROLE_RESTRICTED',
        `User ${user.name} (${user.role}) blocked: device only permits [${permittedRoles.join(', ')}]`,
        req.ip
      );
      return res.status(403).json({
        success: false,
        code: 'DEVICE_ROLE_MISMATCH',
        status: 'role_mismatch',
        permittedRoles,
        userRole: user.role,
        message: `This device is authorized only for [${permittedRoles.join(', ')}]. You cannot use role '${targetRole}' on this terminal.`,
      });
    }

    // G. Verify Assigned Employee Constraint (if device is assigned to a specific user)
    if (device.assigned_user_id && device.assigned_user_id !== user.id && user.role !== 'admin') {
      const assignedUser = queryOne('SELECT name FROM users WHERE id = ?', [device.assigned_user_id]);
      logDeviceAudit(
        device.id,
        user.id,
        'DEVICE_USER_MISMATCH',
        `User ${user.name} attempted login on device assigned to ${assignedUser ? assignedUser.name : device.assigned_user_id}`,
        req.ip
      );
      return res.status(403).json({
        success: false,
        code: 'DEVICE_ASSIGNED_TO_OTHER',
        message: `This device is reserved for ${assignedUser ? assignedUser.name : 'another employee'}. Please use your assigned terminal.`,
      });
    }

    // H. Issue Cryptographically Secure Session Token
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const sessionId = 'ses-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

    transaction(() => {
      // Invalidate old sessions for this user on this device
      run('UPDATE device_sessions SET is_valid = 0 WHERE device_id = ? AND user_id = ?', [device.id, user.id]);

      // Create new active session
      run(
        `INSERT INTO device_sessions (id, device_id, user_id, session_token, expires_at, last_seen_at, is_valid, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
        [sessionId, device.id, user.id, sessionToken, expiresAt, now, now]
      );

      // Update device last active timestamp
      run(
        'UPDATE authorized_devices SET last_active_at = ?, ip_address = ? WHERE id = ?',
        [now, req.ip, device.id]
      );

      logDeviceAudit(device.id, user.id, 'DEVICE_LOGIN_SUCCESS', `Login approved for ${user.name} on ${device.device_name}`, req.ip);
    });

    const { password_hash, ...safeUser } = user;
    res.json({
      success: true,
      data: {
        user: safeUser,
        sessionToken,
        device: {
          id: device.id,
          name: device.device_name,
          permittedRoles,
          status: 'approved',
          lastActiveAt: now,
        },
      },
      message: `Welcome, ${user.name}! Terminal '${device.device_name}' authorized.`,
    });
  } catch (err) {
    console.error('Verify and login error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 2b. POST /api/device/owner-authorize-terminal
// Owner / Administrator workflow to elevate or authorize roles on a terminal
// Requires verified Admin credentials + cryptographic device proof
// -------------------------------------------------------------
router.post('/owner-authorize-terminal', async (req, res) => {
  try {
    const {
      adminIdentifier,
      adminPassword,
      adminPin,
      deviceFingerprint,
      publicKeySpki,
      challengeId,
      signature,
      rolesToAuthorize,
      deviceName,
    } = req.body;

    // 1. Validate cryptographic challenge
    if (!challengeId || !challengeStore.has(challengeId)) {
      return res.status(400).json({
        success: false,
        code: 'CHALLENGE_EXPIRED',
        error: 'Authentication challenge expired or invalid. Please retry.',
      });
    }

    const challenge = challengeStore.get(challengeId);
    challengeStore.delete(challengeId);

    if (challenge.fingerprint !== deviceFingerprint) {
      return res.status(400).json({ success: false, error: 'Challenge fingerprint mismatch' });
    }

    // 2. Authenticate Admin Credentials
    if (!adminIdentifier && !adminPin) {
      return res.status(400).json({ success: false, error: 'Administrator Username/Password or Master PIN required' });
    }

    let adminUser = null;
    if (adminPin) {
      adminUser = queryOne('SELECT * FROM users WHERE pin = ? AND is_active = 1', [String(adminPin).trim()]);
    } else if (adminIdentifier) {
      const cleanIdent = String(adminIdentifier).trim().toLowerCase();
      adminUser = queryOne(
        'SELECT * FROM users WHERE (LOWER(email) = ? OR LOWER(username) = ?) AND is_active = 1',
        [cleanIdent, cleanIdent]
      );
      if (adminUser && adminUser.password_hash !== adminPassword) {
        return res.status(401).json({ success: false, error: 'Incorrect administrator password' });
      }
    }

    if (!adminUser) {
      return res.status(401).json({ success: false, error: 'Administrator credentials not found or invalid' });
    }

    // 3. STRICT RBAC CHECK: Caller MUST be role 'admin'
    if (adminUser.role !== 'admin') {
      logDeviceAudit(null, adminUser.id, 'UNAUTHORIZED_TERMINAL_ELEVATION_ATTEMPT', `User ${adminUser.name} (${adminUser.role}) attempted to elevate terminal without admin privileges`, req.ip);
      return res.status(403).json({
        success: false,
        error: 'Only an authorized administrator or restaurant owner can authorize terminal permissions.',
      });
    }

    // 4. Verify Cryptographic Proof of Device Possession
    if (!publicKeySpki || !signature) {
      return res.status(400).json({ success: false, error: 'Device public key and cryptographic signature required' });
    }

    let isSignatureValid = false;
    try {
      const pubKeyDer = Buffer.from(publicKeySpki, 'base64');
      const pubKey = crypto.createPublicKey({
        key: pubKeyDer,
        format: 'der',
        type: 'spki',
      });

      isSignatureValid = crypto.verify(
        'SHA256',
        Buffer.from(challenge.nonce),
        { key: pubKey, dsaEncoding: 'ieee-p1363' },
        Buffer.from(signature, 'base64')
      );
    } catch (cryptoErr) {
      console.error('Signature verification error:', cryptoErr);
      isSignatureValid = false;
    }

    if (!isSignatureValid) {
      return res.status(401).json({
        success: false,
        error: 'Cryptographic device signature verification failed.',
      });
    }

    // 5. Update Device Roles in Database
    let device = queryOne('SELECT * FROM authorized_devices WHERE device_fingerprint_hash = ?', [deviceFingerprint]);
    const now = new Date().toISOString();
    const finalRoles = Array.isArray(rolesToAuthorize) && rolesToAuthorize.length > 0
      ? rolesToAuthorize
      : ['admin', 'cashier', 'order_taker'];

    let deviceId = device ? device.id : 'dev-' + Date.now();
    const finalName = deviceName && deviceName.trim() ? deviceName.trim() : (device ? device.device_name : 'Admin Terminal');

    let refreshedRoles = finalRoles;
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const sessionId = 'ses-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    transaction(() => {
      if (device) {
        // Merge with existing roles to avoid losing prior permissions
        const existingRoles = parseRoles(device.permitted_roles);
        refreshedRoles = Array.from(new Set([...existingRoles, ...finalRoles]));

        run(
          `UPDATE authorized_devices 
           SET status = 'approved',
               permitted_roles = ?,
               device_name = COALESCE(?, device_name),
               assigned_user_id = NULL,
               approved_by = ?,
               approved_at = ?,
               revoked_by = NULL,
               revoked_at = NULL,
               last_active_at = ?
           WHERE id = ?`,
          [JSON.stringify(refreshedRoles), deviceName || null, adminUser.name, now, now, device.id]
        );
        logDeviceAudit(device.id, adminUser.id, 'DEVICE_OWNER_AUTHORIZED', `Terminal '${device.device_name}' elevated by Admin ${adminUser.name} to [${refreshedRoles.join(', ')}]`, req.ip);
      } else {
        run(
          `INSERT INTO authorized_devices 
           (id, device_fingerprint_hash, device_name, assigned_user_id, permitted_roles, status, approved_by, approved_at, last_active_at, created_at)
           VALUES (?, ?, ?, NULL, ?, 'approved', ?, ?, ?, ?)`,
          [deviceId, deviceFingerprint, finalName, JSON.stringify(finalRoles), adminUser.name, now, now, now]
        );
        run(
          `INSERT INTO device_credentials (id, device_id, public_key_spki, algorithm, key_format, created_at)
           VALUES (?, ?, ?, 'ECDSA-P256', 'spki', ?)`,
          ['cred-' + Date.now(), deviceId, publicKeySpki, now]
        );
        logDeviceAudit(deviceId, adminUser.id, 'DEVICE_OWNER_REGISTERED', `New terminal authorized directly by Admin ${adminUser.name} for [${finalRoles.join(', ')}]`, req.ip);
      }

      // Invalidate old sessions for this user on this device
      run('UPDATE device_sessions SET is_valid = 0 WHERE device_id = ? AND user_id = ?', [deviceId, adminUser.id]);

      // Create new active session
      run(
        `INSERT INTO device_sessions (id, device_id, user_id, session_token, expires_at, last_seen_at, is_valid, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
        [sessionId, deviceId, adminUser.id, sessionToken, expiresAt, now, now]
      );
    });

    const refreshed = queryOne('SELECT * FROM authorized_devices WHERE id = ?', [deviceId]);
    const { password_hash, ...safeAdmin } = adminUser;

    res.json({
      success: true,
      data: {
        user: safeAdmin,
        sessionToken,
        device: {
          id: refreshed.id,
          name: refreshed.device_name,
          permittedRoles: refreshedRoles,
          status: 'approved',
          lastActiveAt: now,
        },
      },
      message: `Terminal successfully authorized for Administrator access by ${adminUser.name}!`,
    });
  } catch (err) {
    console.error('Owner authorize error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 2c. POST /api/device/dev/authorize-local-terminal
// Development-Only local terminal authorization
// Disabled in production
// -------------------------------------------------------------
router.post('/dev/authorize-local-terminal', (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ success: false, error: 'Development endpoint is disabled in production' });
    }

    const { deviceFingerprint } = req.body;
    if (!deviceFingerprint) {
      return res.status(400).json({ success: false, error: 'deviceFingerprint is required' });
    }

    const device = queryOne('SELECT * FROM authorized_devices WHERE device_fingerprint_hash = ?', [deviceFingerprint]);
    if (!device) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }

    const now = new Date().toISOString();
    const elevatedRoles = ['admin', 'cashier', 'order_taker'];

    transaction(() => {
      run(
        `UPDATE authorized_devices 
         SET status = 'approved',
             permitted_roles = ?,
             assigned_user_id = NULL,
             approved_by = 'Dev Local Host',
             approved_at = ?,
             revoked_by = NULL,
             revoked_at = NULL,
             last_active_at = ?
         WHERE id = ?`,
        [JSON.stringify(elevatedRoles), now, now, device.id]
      );

      run(
        `UPDATE device_approval_requests 
         SET status = 'approved', reviewed_by = 'Dev Local Host', reviewed_at = ? 
         WHERE device_id = ?`,
        [now, device.id]
      );

      logDeviceAudit(device.id, null, 'DEV_LOCAL_AUTHORIZED', `Local terminal elevated to [${elevatedRoles.join(', ')}] in dev mode`, req.ip);
    });

    res.json({
      success: true,
      message: `Local terminal '${device.device_name}' authorized for [${elevatedRoles.join(', ')}].`,
      permittedRoles: elevatedRoles,
    });
  } catch (err) {
    console.error('Dev authorize error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 3. GET /api/device/status/:fingerprint
// Allows client to poll/check authorization state
// -------------------------------------------------------------
router.get('/status/:fingerprint', (req, res) => {
  try {
    const { fingerprint } = req.params;
    const device = queryOne(
      `SELECT d.*, u.name as assigned_employee_name 
       FROM authorized_devices d
       LEFT JOIN users u ON d.assigned_user_id = u.id
       WHERE d.device_fingerprint_hash = ?`,
      [fingerprint]
    );

    if (!device) {
      return res.json({
        success: true,
        data: { status: 'unregistered', message: 'Device has not been registered' },
      });
    }

    res.json({
      success: true,
      data: {
        id: device.id,
        name: device.device_name,
        status: device.status,
        permittedRoles: parseRoles(device.permitted_roles),
        assignedEmployee: device.assigned_employee_name || 'All Authorized Staff',
        assignedUserId: device.assigned_user_id,
        lastActiveAt: device.last_active_at,
        approvedAt: device.approved_at,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 4. POST /api/device/request-approval
// Updates custom label or notes for an existing device request
// -------------------------------------------------------------
router.post('/request-approval', (req, res) => {
  try {
    const { deviceFingerprint, deviceName, notes } = req.body;
    if (!deviceFingerprint) {
      return res.status(400).json({ success: false, error: 'deviceFingerprint is required' });
    }

    const device = queryOne('SELECT * FROM authorized_devices WHERE device_fingerprint_hash = ?', [deviceFingerprint]);
    if (!device) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }

    if (deviceName && deviceName.trim()) {
      run('UPDATE authorized_devices SET device_name = ? WHERE id = ?', [deviceName.trim(), device.id]);
    }

    if (notes && notes.trim()) {
      run('UPDATE device_approval_requests SET admin_notes = ? WHERE device_id = ?', [notes.trim(), device.id]);
    }

    logDeviceAudit(device.id, device.assigned_user_id, 'DEVICE_APPROVAL_DETAILS_UPDATED', `Details updated: ${deviceName || ''}`, req.ip);

    res.json({ success: true, message: 'Device details updated' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// =============================================================
// ADMIN-ONLY DEVICE MANAGEMENT ENDPOINTS
// =============================================================

// Helper: check admin permissions
function verifyAdminSession(req, res, next) {
  const sessionToken = req.headers['x-device-session-token'];
  if (!sessionToken) {
    // Check fallback dev / local bypass if configured
    return res.status(401).json({ success: false, error: 'Administrator session token required' });
  }

  const session = queryOne(
    `SELECT s.*, u.role as user_role, u.name as user_name, d.status as device_status, d.permitted_roles
     FROM device_sessions s
     JOIN users u ON s.user_id = u.id
     JOIN authorized_devices d ON s.device_id = d.id
     WHERE s.session_token = ? AND s.is_valid = 1`,
    [sessionToken]
  );

  if (!session) {
    return res.status(401).json({ success: false, error: 'Session invalid or expired' });
  }

  if (session.device_status !== 'approved') {
    return res.status(403).json({ success: false, error: 'Admin device is not authorized' });
  }

  const deviceRoles = parseRoles(session.permitted_roles);
  if (session.user_role !== 'admin' || (!deviceRoles.includes('admin') && !deviceRoles.includes('*'))) {
    return res.status(403).json({ success: false, error: 'Administrator role required' });
  }

  req.admin = {
    userId: session.user_id,
    name: session.user_name,
    deviceId: session.device_id,
  };
  next();
}

// -------------------------------------------------------------
// 5. GET /api/device/admin/devices
// List all registered devices
// -------------------------------------------------------------
router.get('/admin/devices', (req, res) => {
  try {
    const devices = queryAll(`
      SELECT 
        d.id,
        d.device_fingerprint_hash,
        d.device_name,
        d.assigned_user_id,
        d.permitted_roles,
        d.status,
        d.device_info,
        d.ip_address,
        d.last_active_at,
        d.approved_by,
        d.approved_at,
        d.revoked_by,
        d.revoked_at,
        d.created_at,
        u.name as assigned_employee_name,
        u.role as assigned_employee_role,
        (SELECT COUNT(*) FROM device_sessions s WHERE s.device_id = d.id AND s.is_valid = 1) as active_sessions_count
      FROM authorized_devices d
      LEFT JOIN users u ON d.assigned_user_id = u.id
      ORDER BY 
        CASE d.status
          WHEN 'pending' THEN 1
          WHEN 'approved' THEN 2
          WHEN 'rejected' THEN 3
          WHEN 'revoked' THEN 4
        END,
        d.created_at DESC
    `);

    const formatted = devices.map(d => ({
      ...d,
      permitted_roles: parseRoles(d.permitted_roles),
    }));

    res.json({ success: true, data: formatted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 6. POST /api/device/admin/devices/:id/approve
// Approve a device, set roles and employee assignment
// -------------------------------------------------------------
router.post('/admin/devices/:id/approve', (req, res) => {
  try {
    const { id } = req.params;
    const { assignedUserId, permittedRoles, adminName, deviceName } = req.body;

    const device = queryOne('SELECT * FROM authorized_devices WHERE id = ?', [id]);
    if (!device) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }

    const roles = Array.isArray(permittedRoles) && permittedRoles.length > 0 
      ? permittedRoles 
      : ['order_taker'];

    // Check device limit per employee
    if (assignedUserId) {
      const setting = queryOne("SELECT value FROM settings WHERE key = 'max_devices_per_employee'");
      const maxLimit = setting ? parseInt(setting.value, 10) : 2;

      const currentCount = queryOne(
        `SELECT COUNT(*) as count FROM authorized_devices 
         WHERE assigned_user_id = ? AND status = 'approved' AND id != ?`,
        [assignedUserId, id]
      );

      if (currentCount && currentCount.count >= maxLimit) {
        return res.status(400).json({
          success: false,
          error: `This employee already has ${currentCount.count} approved devices (maximum allowed is ${maxLimit}). Revoke an existing device before approving this one.`,
        });
      }
    }

    const now = new Date().toISOString();
    const reviewer = adminName || 'Admin';

    transaction(() => {
      run(
        `UPDATE authorized_devices 
         SET status = 'approved',
             assigned_user_id = ?,
             permitted_roles = ?,
             device_name = COALESCE(?, device_name),
             approved_by = ?,
             approved_at = ?,
             revoked_by = NULL,
             revoked_at = NULL
         WHERE id = ?`,
        [assignedUserId || null, JSON.stringify(roles), deviceName || null, reviewer, now, id]
      );

      run(
        `UPDATE device_approval_requests 
         SET status = 'approved', reviewed_by = ?, reviewed_at = ? 
         WHERE device_id = ? AND status = 'pending'`,
        [reviewer, now, id]
      );

      logDeviceAudit(id, assignedUserId, 'DEVICE_APPROVED', `Device approved by ${reviewer} with roles [${roles.join(', ')}]`, req.ip);
    });

    res.json({
      success: true,
      message: `Device '${device.device_name}' approved successfully for [${roles.join(', ')}]`,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 7. POST /api/device/admin/devices/:id/reject
// Reject a device request
// -------------------------------------------------------------
router.post('/admin/devices/:id/reject', (req, res) => {
  try {
    const { id } = req.params;
    const { reason, adminName } = req.body;

    const device = queryOne('SELECT * FROM authorized_devices WHERE id = ?', [id]);
    if (!device) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }

    const now = new Date().toISOString();
    const reviewer = adminName || 'Admin';

    transaction(() => {
      run(
        'UPDATE authorized_devices SET status = "rejected" WHERE id = ?',
        [id]
      );

      run(
        `UPDATE device_approval_requests 
         SET status = 'rejected', admin_notes = ?, reviewed_by = ?, reviewed_at = ? 
         WHERE device_id = ?`,
        [reason || 'Rejected by administrator', reviewer, now, id]
      );

      // Invalidate any sessions
      run('UPDATE device_sessions SET is_valid = 0 WHERE device_id = ?', [id]);

      logDeviceAudit(id, null, 'DEVICE_REJECTED', `Device rejected by ${reviewer}: ${reason || 'No reason specified'}`, req.ip);
    });

    res.json({ success: true, message: `Device '${device.device_name}' has been rejected.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 8. POST /api/device/admin/devices/:id/revoke
// Instantly revoke authorization and kill all sessions
// -------------------------------------------------------------
router.post('/admin/devices/:id/revoke', (req, res) => {
  try {
    const { id } = req.params;
    const { reason, adminName } = req.body;

    const device = queryOne('SELECT * FROM authorized_devices WHERE id = ?', [id]);
    if (!device) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }

    const now = new Date().toISOString();
    const revoker = adminName || 'Admin';

    transaction(() => {
      // 1. Mark device as revoked
      run(
        `UPDATE authorized_devices 
         SET status = 'revoked', revoked_by = ?, revoked_at = ? 
         WHERE id = ?`,
        [revoker, now, id]
      );

      // 2. Invalidate all active sessions for this device
      run('UPDATE device_sessions SET is_valid = 0 WHERE device_id = ?', [id]);

      // 3. Log audit
      logDeviceAudit(
        id,
        device.assigned_user_id,
        'DEVICE_REVOKED',
        `Device revoked by ${revoker}. All active sessions invalidated. Reason: ${reason || 'Administrator decision'}`,
        req.ip
      );
    });

    res.json({
      success: true,
      message: `Device '${device.device_name}' revoked. All sessions terminated immediately.`,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 9. DELETE /api/device/admin/devices/:id
// Completely remove device registration
// -------------------------------------------------------------
router.delete('/admin/devices/:id', (req, res) => {
  try {
    const { id } = req.params;
    const device = queryOne('SELECT * FROM authorized_devices WHERE id = ?', [id]);
    if (!device) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }

    transaction(() => {
      run('DELETE FROM device_sessions WHERE device_id = ?', [id]);
      run('DELETE FROM device_credentials WHERE device_id = ?', [id]);
      run('DELETE FROM device_approval_requests WHERE device_id = ?', [id]);
      run('DELETE FROM authorized_devices WHERE id = ?', [id]);
      logDeviceAudit(id, null, 'DEVICE_DELETED', `Device ${device.device_name} deleted from system`, req.ip);
    });

    res.json({ success: true, message: `Device '${device.device_name}' deleted` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 10. GET /api/device/admin/audit-logs
// View audit history
// -------------------------------------------------------------
router.get('/admin/audit-logs', (req, res) => {
  try {
    const logs = queryAll(`
      SELECT 
        l.id,
        l.device_id,
        l.user_id,
        l.action,
        l.details,
        l.ip_address,
        l.created_at,
        d.device_name,
        u.name as user_name
      FROM device_audit_logs l
      LEFT JOIN authorized_devices d ON l.device_id = d.id
      LEFT JOIN users u ON l.user_id = u.id
      ORDER BY l.created_at DESC
      LIMIT 100
    `);

    res.json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 11. GET / PUT /api/device/admin/settings
// Limit devices per employee configuration
// -------------------------------------------------------------
router.get('/admin/settings', (req, res) => {
  try {
    const row = queryOne("SELECT value FROM settings WHERE key = 'max_devices_per_employee'");
    const maxDevices = row ? parseInt(row.value, 10) : 2;
    res.json({ success: true, data: { maxDevicesPerEmployee: maxDevices } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/admin/settings', (req, res) => {
  try {
    const { maxDevicesPerEmployee } = req.body;
    const limit = Math.max(1, parseInt(maxDevicesPerEmployee, 10) || 2);
    run("INSERT OR REPLACE INTO settings (key, value) VALUES ('max_devices_per_employee', ?)", [String(limit)]);
    logDeviceAudit(null, null, 'DEVICE_POLICY_UPDATED', `Max devices per employee set to ${limit}`, req.ip);
    res.json({ success: true, message: `Max devices per employee set to ${limit}`, data: { maxDevicesPerEmployee: limit } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
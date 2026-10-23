// Comprehensive Integration Test for Loaf n Leaf Device Authorization
const crypto = require('crypto');
const { subtle } = crypto.webcrypto;

const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('=== STARTING DEVICE-BASED ACCESS CONTROL TESTS ===\n');

  // Helper fetch function
  async function apiPost(endpoint, body, headers = {}) {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return { status: res.status, data };
  }

  async function apiGet(endpoint, headers = {}) {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      headers: { 'Content-Type': 'application/json', ...headers },
    });
    const data = await res.json();
    return { status: res.status, data };
  }

  // 1. Generate Simulated Client Keypair (ECDSA P-256)
  console.log('Test 1: Generating WebCrypto ECDSA P-256 Keypair...');
  const keyPair = await subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify']
  );
  const spkiBuffer = await subtle.exportKey('spki', keyPair.publicKey);
  const publicKeySpki = Buffer.from(spkiBuffer).toString('base64');
  const fingerprint = crypto.createHash('sha256').update(Buffer.from(spkiBuffer)).digest('hex').substring(0, 32);
  console.log('  -> Fingerprint:', fingerprint);
  console.log('  -> Public Key SPKI Length:', publicKeySpki.length);

  // 2. Request Challenge Nonce
  console.log('\nTest 2: Requesting cryptographic challenge nonce from /api/device/challenge...');
  const chalRes = await apiPost('/device/challenge', { deviceFingerprint: fingerprint });
  console.log('  -> Challenge Status:', chalRes.status, chalRes.data.success);
  if (!chalRes.data.success) throw new Error('Challenge failed');
  const { challengeId, nonce } = chalRes.data.data;
  console.log('  -> Challenge ID:', challengeId);
  console.log('  -> Challenge Nonce:', nonce);

  // 3. Test Invalid Signature Rejection
  console.log('\nTest 3: Testing invalid signature rejection...');
  const bogusSignature = Buffer.alloc(64, 1).toString('base64');
  // Need a new challenge because challenges are single use
  const chalRes2 = await apiPost('/device/challenge', { deviceFingerprint: fingerprint });
  const bogusLogin = await apiPost('/device/verify-and-login', {
    identifier: 'cashier1',
    password: 'cashier123',
    deviceFingerprint: fingerprint,
    publicKeySpki,
    challengeId: chalRes2.data.data.challengeId,
    signature: bogusSignature,
    deviceName: 'Counter Test iPad',
  });
  console.log('  -> Bogus Signature HTTP Status:', bogusLogin.status, bogusLogin.data.code);
  if (bogusLogin.status !== 401 || bogusLogin.data.code !== 'INVALID_DEVICE_SIGNATURE') {
    throw new Error('Expected 401 INVALID_DEVICE_SIGNATURE, got: ' + JSON.stringify(bogusLogin));
  }
  console.log('  -> PASS: Tampered signature correctly rejected!');

  // 4. Test Unapproved Device Registration (Should return 403 DEVICE_UNAUTHORIZED with status pending)
  console.log('\nTest 4: Registering new device with valid signature...');
  const chalRes3 = await apiPost('/device/challenge', { deviceFingerprint: fingerprint });
  const sigBuffer = await subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    keyPair.privateKey,
    Buffer.from(chalRes3.data.data.nonce)
  );
  const validSignature = Buffer.from(sigBuffer).toString('base64');

  const pendingLogin = await apiPost('/device/verify-and-login', {
    identifier: 'cashier1',
    password: 'cashier123',
    deviceFingerprint: fingerprint,
    publicKeySpki,
    challengeId: chalRes3.data.data.challengeId,
    signature: validSignature,
    deviceName: 'Counter POS Station 1',
    requestedRole: 'cashier',
  });
  console.log('  -> Pending Login HTTP Status:', pendingLogin.status, pendingLogin.data.code);
  if (pendingLogin.status !== 403 || pendingLogin.data.status !== 'pending') {
    throw new Error('Expected 403 pending, got: ' + JSON.stringify(pendingLogin));
  }
  const deviceId = pendingLogin.data.deviceId;
  console.log('  -> PASS: Device registered as PENDING. Device ID:', deviceId);

  // 5. Admin Listing Registered Devices
  console.log('\nTest 5: Admin listing devices from /api/device/admin/devices...');
  const listRes = await apiGet('/device/admin/devices');
  const foundDev = listRes.data.data.find(d => d.device_fingerprint_hash === fingerprint);
  if (!foundDev) throw new Error('Registered device not found in admin list');
  console.log('  -> PASS: Found registered device in admin list, status:', foundDev.status);

  // 6. Admin Approves Device (Assign permitted role: 'cashier')
  console.log('\nTest 6: Admin approves device for role [cashier]...');
  const approveRes = await apiPost(`/device/admin/devices/${deviceId}/approve`, {
    assignedUserId: 'usr-cashier-1',
    permittedRoles: ['cashier'],
    adminName: 'Owner Admin',
    deviceName: 'Counter POS Station 1',
  });
  console.log('  -> Approval Status:', approveRes.status, approveRes.data.message);
  if (!approveRes.data.success) throw new Error('Approval failed');

  // 7. Login on Approved Device (Cashier)
  console.log('\nTest 7: Cashier logging in on approved device...');
  const chalRes4 = await apiPost('/device/challenge', { deviceFingerprint: fingerprint });
  const sigBuffer2 = await subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    keyPair.privateKey,
    Buffer.from(chalRes4.data.data.nonce)
  );
  const validSignature2 = Buffer.from(sigBuffer2).toString('base64');

  const approvedLogin = await apiPost('/device/verify-and-login', {
    identifier: 'cashier1',
    password: 'cashier123',
    deviceFingerprint: fingerprint,
    publicKeySpki,
    challengeId: chalRes4.data.data.challengeId,
    signature: validSignature2,
    deviceName: 'Counter POS Station 1',
    requestedRole: 'cashier',
  });
  console.log('  -> Approved Login Status:', approvedLogin.status, approvedLogin.data.success);
  if (approvedLogin.status !== 200 || !approvedLogin.data.data.sessionToken) {
    throw new Error('Expected 200 login success, got: ' + JSON.stringify(approvedLogin));
  }
  const sessionToken = approvedLogin.data.data.sessionToken;
  console.log('  -> PASS: Session established! Token:', sessionToken.substring(0, 16) + '...');

  // 8. Test Role Restriction Enforcement: Admin trying to use a Cashier-only Device
  console.log('\nTest 8: Testing role restriction (Admin trying to log in on Cashier-only terminal)...');
  const chalRes5 = await apiPost('/device/challenge', { deviceFingerprint: fingerprint });
  const sigBuffer3 = await subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    keyPair.privateKey,
    Buffer.from(chalRes5.data.data.nonce)
  );
  const validSignature3 = Buffer.from(sigBuffer3).toString('base64');

  const roleMismatchLogin = await apiPost('/device/verify-and-login', {
    identifier: 'admin',
    password: 'admin123',
    deviceFingerprint: fingerprint,
    publicKeySpki,
    challengeId: chalRes5.data.data.challengeId,
    signature: validSignature3,
    deviceName: 'Counter POS Station 1',
    requestedRole: 'admin', // Terminal is only authorized for 'cashier'
  });
  console.log('  -> Role Mismatch Status:', roleMismatchLogin.status, roleMismatchLogin.data.code);
  if (roleMismatchLogin.status !== 403 || roleMismatchLogin.data.code !== 'DEVICE_ROLE_MISMATCH') {
    throw new Error('Expected 403 DEVICE_ROLE_MISMATCH, got: ' + JSON.stringify(roleMismatchLogin));
  }
  console.log('  -> PASS: Role restriction strictly enforced! Device permits [cashier], blocked admin attempt.');

  // 9. Admin Revokes Device Access
  console.log('\nTest 9: Admin revokes device access...');
  const revokeRes = await apiPost(`/device/admin/devices/${deviceId}/revoke`, {
    reason: 'Employee terminal decommissioned',
    adminName: 'Owner Admin',
  });
  console.log('  -> Revoke Status:', revokeRes.status, revokeRes.data.message);
  if (!revokeRes.data.success) throw new Error('Revocation failed');

  // 10. Attempting to log in from revoked device
  console.log('\nTest 10: Attempting login from revoked device...');
  const chalRes6 = await apiPost('/device/challenge', { deviceFingerprint: fingerprint });
  const sigBuffer4 = await subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    keyPair.privateKey,
    Buffer.from(chalRes6.data.data.nonce)
  );
  const validSignature4 = Buffer.from(sigBuffer4).toString('base64');

  const revokedLogin = await apiPost('/device/verify-and-login', {
    identifier: 'cashier1',
    password: 'cashier123',
    deviceFingerprint: fingerprint,
    publicKeySpki,
    challengeId: chalRes6.data.data.challengeId,
    signature: validSignature4,
    deviceName: 'Counter POS Station 1',
  });
  console.log('  -> Revoked Login Status:', revokedLogin.status, revokedLogin.data.code);
  if (revokedLogin.status !== 403 || revokedLogin.data.code !== 'DEVICE_REVOKED') {
    throw new Error('Expected 403 DEVICE_REVOKED, got: ' + JSON.stringify(revokedLogin));
  }
  console.log('  -> PASS: Revoked device immediately rejected!');

  // 11. Verify Device Audit Logs
  console.log('\nTest 11: Checking audit logs from /api/device/admin/audit-logs...');
  const auditRes = await apiGet('/device/admin/audit-logs');
  const logsForDevice = auditRes.data.data.filter(l => l.device_id === deviceId);
  console.log(`  -> Recorded ${logsForDevice.length} audit log events for this terminal:`);
  logsForDevice.forEach(l => console.log(`     * [${l.action}] ${l.details}`));

  console.log('\n=== ALL 11 TESTS PASSED SUCCESSFULLY! ===');
}

runTests().catch(err => {
  console.error('\nTEST FAILED:', err);
  process.exit(1);
});

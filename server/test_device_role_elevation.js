const crypto = require('crypto');
const http = require('http');

function postJson(urlPath, data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: urlPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (_) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('=== STARTING DEVICE AUTHORIZATION & ROLE ELEVATION VERIFICATION ===\n');

  // 1. Generate test ECDSA P-256 keypair for terminal
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
  });
  const spkiDer = publicKey.export({ format: 'der', type: 'spki' });
  const publicKeySpki = spkiDer.toString('base64');
  const fingerprint = crypto.createHash('sha256').update(spkiDer).digest('hex').substring(0, 32);

  console.log(`Test Terminal Hardware Fingerprint: ${fingerprint}`);

  // 2. Register device as Waiter (role: order_taker)
  console.log('\nStep 1: Waiter (Hamza Tariq) logging in on new terminal...');
  const chal1 = (await postJson('/api/device/challenge', { deviceFingerprint: fingerprint })).data.data;
  const sig1 = crypto.sign('SHA256', Buffer.from(chal1.nonce), {
    key: privateKey,
    dsaEncoding: 'ieee-p1363',
  }).toString('base64');

  const waiterLogin = await postJson('/api/device/verify-and-login', {
    pin: '7890', // Waiter PIN
    deviceFingerprint: fingerprint,
    publicKeySpki,
    challengeId: chal1.challengeId,
    signature: sig1,
    deviceName: 'Floor Tablet 99',
    requestedRole: 'order_taker',
  });

  console.log(`  -> Device registration response status: ${waiterLogin.status} (${waiterLogin.data.code})`);
  const deviceId = waiterLogin.data.deviceId;

  // Approve for order_taker ONLY
  console.log('Step 2: Manager approving device for role [order_taker] only...');
  const approveRes = await postJson(`/api/device/admin/devices/${deviceId}/approve`, {
    permittedRoles: ['order_taker'],
    adminName: 'Owner',
    assignedUserId: 'usr-waiter-1',
  });
  console.log('  -> Device approved for [order_taker]');

  // 3. Attempt Admin Login on this order_taker-only device
  console.log('\nStep 3: Admin attempting to login on this order_taker-only terminal...');
  const chal2 = (await postJson('/api/device/challenge', { deviceFingerprint: fingerprint })).data.data;
  const sig2 = crypto.sign('SHA256', Buffer.from(chal2.nonce), {
    key: privateKey,
    dsaEncoding: 'ieee-p1363',
  }).toString('base64');

  const adminBlocked = await postJson('/api/device/verify-and-login', {
    pin: '2007', // Admin Master PIN
    deviceFingerprint: fingerprint,
    publicKeySpki,
    challengeId: chal2.challengeId,
    signature: sig2,
    deviceName: 'Floor Tablet 99',
    requestedRole: 'admin',
  });

  console.log(`  -> Status: ${adminBlocked.status} (Expected 403)`);
  console.log(`  -> Code: ${adminBlocked.data.code}`);
  console.log(`  -> Error Message: "${adminBlocked.data.message}"`);
  if (adminBlocked.data.code !== 'DEVICE_ROLE_MISMATCH') {
    throw new Error('FAIL: Admin was not blocked by role mismatch on order_taker-only device');
  }
  console.log('  -> PASS: Device correctly restricted to order_taker!');

  // 4. Test Security: Waiter trying to elevate device to Admin (Privilege Escalation Attack)
  console.log('\nStep 4: Testing Security - Waiter attempting to elevate device to Admin using waiter PIN...');
  const chal3 = (await postJson('/api/device/challenge', { deviceFingerprint: fingerprint })).data.data;
  const sig3 = crypto.sign('SHA256', Buffer.from(chal3.nonce), {
    key: privateKey,
    dsaEncoding: 'ieee-p1363',
  }).toString('base64');

  const waiterHackingAttempt = await postJson('/api/device/owner-authorize-terminal', {
    adminPin: '7890', // Waiter PIN (NOT admin)
    deviceFingerprint: fingerprint,
    publicKeySpki,
    challengeId: chal3.challengeId,
    signature: sig3,
    rolesToAuthorize: ['admin', 'order_taker'],
  });

  console.log(`  -> Status: ${waiterHackingAttempt.status} (Expected 403)`);
  console.log(`  -> Response: "${waiterHackingAttempt.data.error}"`);
  if (waiterHackingAttempt.status !== 403) {
    throw new Error('SECURITY VIOLATION: Waiter was allowed to elevate terminal permissions!');
  }
  console.log('  -> PASS: Waiter was strictly DENIED terminal elevation!');

  // 5. Test Owner Workflow: Legitimate Admin elevating terminal to Admin + Cashier + Waiter
  console.log('\nStep 5: Legitimate Restaurant Admin elevating terminal to Admin access...');
  const chal4 = (await postJson('/api/device/challenge', { deviceFingerprint: fingerprint })).data.data;
  const sig4 = crypto.sign('SHA256', Buffer.from(chal4.nonce), {
    key: privateKey,
    dsaEncoding: 'ieee-p1363',
  }).toString('base64');

  const ownerElevation = await postJson('/api/device/owner-authorize-terminal', {
    adminPin: '2007', // Valid Admin PIN
    deviceFingerprint: fingerprint,
    publicKeySpki,
    challengeId: chal4.challengeId,
    signature: sig4,
    rolesToAuthorize: ['admin', 'cashier', 'order_taker'],
  });

  console.log(`  -> Status: ${ownerElevation.status} (Expected 200)`);
  console.log(`  -> Success: ${ownerElevation.data.success}`);
  console.log(`  -> Message: ${ownerElevation.data.message}`);
  console.log(`  -> Updated Permitted Roles: [${ownerElevation.data.data.device.permittedRoles.join(', ')}]`);
  console.log(`  -> Issued Session Token: ${ownerElevation.data.data.sessionToken.substring(0, 16)}...`);

  if (!ownerElevation.data.data.device.permittedRoles.includes('admin')) {
    throw new Error('FAIL: Admin role was not granted to terminal');
  }
  console.log('  -> PASS: Terminal successfully elevated by Owner!');

  // 6. Test Admin Logging In Normally Now
  console.log('\nStep 6: Verifying Admin can now log in normally on this terminal...');
  const chal5 = (await postJson('/api/device/challenge', { deviceFingerprint: fingerprint })).data.data;
  const sig5 = crypto.sign('SHA256', Buffer.from(chal5.nonce), {
    key: privateKey,
    dsaEncoding: 'ieee-p1363',
  }).toString('base64');

  const adminSuccess = await postJson('/api/device/verify-and-login', {
    pin: '2007',
    deviceFingerprint: fingerprint,
    publicKeySpki,
    challengeId: chal5.challengeId,
    signature: sig5,
    requestedRole: 'admin',
  });

  console.log(`  -> Status: ${adminSuccess.status} (Expected 200)`);
  console.log(`  -> User: ${adminSuccess.data.data.user.name} (Role: ${adminSuccess.data.data.user.role})`);
  console.log(`  -> PASS: Admin logged in seamlessly into the Admin Dashboard!`);

  console.log('\n=== ALL DEVICE AUTHORIZATION & ROLE ELEVATION TESTS PASSED! ===');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('[TEST FAILURE]:', err);
  process.exit(1);
});

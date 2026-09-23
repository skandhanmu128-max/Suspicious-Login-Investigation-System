import { sqlite } from './db/database';
import { hashPassword, verifyPassword } from './security/auth';
import { evaluateSessionActivity } from './security/sessionMonitoring';
import { dispatchRemoteNotification, getRecentRemoteNotifications } from './security/notificationService';

async function runTestSuite() {
  console.log('🧪 Starting SentinelTrace Mobile & SOC Security Suite...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`✅ PASSED: ${msg}`);
      passed++;
    } else {
      console.error(`❌ FAILED: ${msg}`);
      failed++;
    }
  }

  // ── 1. Secure Authentication & Password Hashing ─────────────────────────────
  console.log('--- 1. Secure Password Hashing & Salt Verification ---');
  const rawPass = 'SuperSecret@2026!';
  const { hash, salt } = hashPassword(rawPass);
  assert(hash !== rawPass, 'Password is not stored in plaintext');
  assert(hash.length >= 64, 'Hash uses robust 64-byte scrypt output');
  assert(verifyPassword(rawPass, hash, salt), 'Password successfully verified against hash & salt');
  assert(!verifyPassword('WrongPass', hash, salt), 'Incorrect password rejected');

  // Verify SOC Users seeded
  const adminUser = sqlite.prepare("SELECT * FROM soc_users WHERE email = 'admin@sentineltrace.io'").get() as any;
  assert(Boolean(adminUser), "Admin user 'admin@sentineltrace.io' exists in DB");
  assert(adminUser.role === 'ADMIN', 'Admin user has role ADMIN');
  assert(verifyPassword('Admin@Sentinel2026!', adminUser.password_hash, adminUser.salt), 'Admin seeded password verifies');

  const analystUser = sqlite.prepare("SELECT * FROM soc_users WHERE email = 'analyst@sentineltrace.io'").get() as any;
  assert(Boolean(analystUser), "Analyst user 'analyst@sentineltrace.io' exists in DB");
  assert(analystUser.role === 'ANALYST', 'Analyst user has role ANALYST');
  assert(verifyPassword('Analyst@Sentinel2026!', analystUser.password_hash, analystUser.salt), 'Analyst seeded password verifies');

  // ── 2. API Authentication & Token Handling ──────────────────────────────────
  console.log('\n--- 2. API Authentication & Token Lifecycle ---');
  const loginRes = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@sentineltrace.io', password: 'Admin@Sentinel2026!' }),
  });
  const loginData = await loginRes.json() as any;
  assert(loginRes.status === 200 && Boolean(loginData.token), 'Admin login API succeeds and returns session token');
  const adminToken = loginData.token;

  const analystLoginRes = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'analyst@sentineltrace.io', password: 'Analyst@Sentinel2026!' }),
  });
  const analystData = await analystLoginRes.json() as any;
  assert(analystLoginRes.status === 200 && analystData.user.role === 'ANALYST', 'Analyst login API succeeds with role ANALYST');
  const analystToken = analystData.token;

  // Invalid login
  const badLogin = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@sentineltrace.io', password: 'WrongPassword' }),
  });
  assert(badLogin.status === 401, 'Invalid credentials return 401 Unauthorized');

  // ── 3. Role-Based Access Control (RBAC) ────────────────────────────────────
  console.log('\n--- 3. Role-Based Access Control (RBAC) Enforcement ---');
  // Analyst attempting ADMIN route
  const analystAttempt = await fetch('http://localhost:3001/api/settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${analystToken}` },
    body: JSON.stringify({ safeMax: 29 }),
  });
  assert(analystAttempt.status === 403, 'Analyst denied from ADMIN settings modification (403 Forbidden)');

  // Admin performing ADMIN route
  const adminAttempt = await fetch('http://localhost:3001/api/settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
    body: JSON.stringify({ safeMax: 29 }),
  });
  assert(adminAttempt.status === 200, 'Admin authorized to update settings (200 OK)');

  // ── 4. Continuous In-Session Monitoring & Department Peer Baselines ─────────
  console.log('\n--- 4. Continuous In-Session Monitoring & Baselines ---');
  const sessionResult = evaluateSessionActivity({
    userId: 'U101',
    sessionId: 'sess-test-unit-01',
    activityType: 'sensitive_resource_access',
    resourceName: '/payroll/executive-salaries.csv',
    requestCount: 500, // 2.5x normal
    durationSeconds: 7200,
  });

  assert(sessionResult.riskScore >= 50, `Continuous session evaluated risk score (${sessionResult.riskScore}) is elevated`);
  assert(sessionResult.signals.length >= 2, `Detected multiple signals (${sessionResult.signals.length})`);
  assert(Boolean(sessionResult.incidentCreated && sessionResult.caseNumber), `Auto-created incident docket (${sessionResult.caseNumber})`);

  // ── 5. Alert Correlation ───────────────────────────────────────────────────
  console.log('\n--- 5. Alert Correlation into Unified Incident ---');
  assert(
    sessionResult.signals.some(s => s.id === 'session_request_spike') &&
    sessionResult.signals.some(s => s.id === 'unauthorized_resource_access'),
    'Multi-signal session activities correlated into one incident'
  );

  // ── 6. Analyst Feedback Storage ────────────────────────────────────────────
  console.log('\n--- 6. Analyst Feedback Storage ---');
  const feedbackRes = await fetch(`http://localhost:3001/api/cases/${sessionResult.caseId}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      classification: 'true_positive',
      notes: 'Verified unauthorized payroll ingress attempt via test runner.',
      analystName: 'Rohan Gupta',
    }),
  });
  const fbData = await feedbackRes.json() as any;
  assert(feedbackRes.status === 200 && fbData.success, 'Feedback API accepts analyst classification');

  const fbRow = sqlite.prepare('SELECT * FROM analyst_feedback WHERE target_id = ?').get(sessionResult.caseId) as any;
  assert(Boolean(fbRow) && fbRow.classification === 'true_positive', 'Feedback persisted in analyst_feedback table');

  // ── 7. Remote Notifications Outbox ─────────────────────────────────────────
  console.log('\n--- 7. Remote Notification Service ---');
  const outbox = getRecentRemoteNotifications(10);
  assert(outbox.length > 0, `Remote outbox contains ${outbox.length} dispatched alert(s)`);
  assert(outbox[0].channel === 'email', 'Remote notification channel set to email');
  assert(outbox[0].recipient.includes('@'), 'Recipient email address properly formatted');

  console.log(`\n═══════════════════════════════════════════════════════════`);
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log(`═══════════════════════════════════════════════════════════\n`);

  if (failed > 0) process.exit(1);
}

runTestSuite().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});

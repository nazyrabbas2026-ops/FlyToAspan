import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { createApi } from './api.mjs';
import { createAccount, openDatabase } from './store.mjs';

function startTestServer() {
  const db = openDatabase(':memory:');
  const api = createApi({ db });
  const server = createServer(async (req, res) => {
    if (!(await api(req, res))) res.writeHead(404).end();
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        db,
        server,
        origin: `http://127.0.0.1:${port}`,
        close: () => new Promise((done) => server.close(() => { db.close(); done(); })),
      });
    });
  });
}

async function call(origin, path, { method = 'GET', body, cookie, originHeader = origin } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (cookie) headers.Cookie = cookie;
  if (method !== 'GET' && originHeader) headers.Origin = originHeader;
  const res = await fetch(`${origin}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.get('set-cookie')?.split(';')[0] ?? null;
  const json = await res.json();
  return { status: res.status, json, cookie: setCookie, rawCookieHeader: res.headers.get('set-cookie') ?? '' };
}

test('FlyToAspan API & Security Suite', async (t) => {
  const env = await startTestServer();
  t.after(() => env.close());

  await t.test('GET /api/fx returns TRY, USD, EUR, KZT, RUB rates', async () => {
    const res = await call(env.origin, '/api/fx');
    assert.equal(res.status, 200);
    assert.equal(res.json.rates.TRY, 1);
    assert.ok(res.json.rates.USD > 0 && res.json.rates.EUR > 0 && res.json.rates.KZT > 0 && res.json.rates.RUB > 0);
  });

  await t.test('CSRF Origin check rejects cross-origin POST with 403', async () => {
    const res = await call(env.origin, '/api/bookings/lookup', {
      method: 'POST',
      body: { pnr: 'XYZ123', surname: 'YILMAZ' },
      originHeader: 'https://evil.example',
    });
    assert.equal(res.status, 403);
  });

  let memberACookie = '';
  let memberBCookie = '';
  let bookingPnr = '';
  let bookingId = '';

  await t.test('Member registration, HttpOnly cookie, booking creation & strict PNR lookup', async () => {
    const regA = await call(env.origin, '/api/auth/register', {
      method: 'POST',
      body: {
        email: 'aylin@example.com',
        password: 'StrongPassword2026!',
        firstName: 'Aylin',
        lastName: 'Karahan',
        phone: '+905314606175',
        accountType: 'individual',
      },
    });
    assert.equal(regA.status, 201);
    assert.match(regA.rawCookieHeader, /HttpOnly/i);
    memberACookie = regA.cookie;

    const bk = await call(env.origin, '/api/bookings', {
      method: 'POST',
      cookie: memberACookie,
      body: {
        type: 'Uçak',
        title: 'İstanbul (IST) ↔ Antalya (AYT)',
        subtitle: 'Turkish Airlines · TK2410 · Eco Fly',
        date: '2026-12-10',
        returnDate: '2026-12-15',
        passenger: 'Aylin Karahan',
        lookupSurname: 'Karahan',
        price: 3450,
      },
    });
    assert.equal(bk.status, 201);
    bookingPnr = bk.json.booking.pnr;
    bookingId = bk.json.booking.id;
    assert.match(bookingPnr, /^FT[2-9A-HJ-NP-Z]{6}$/);

    // Duplicate click with same idempotencyKey returns exact same PNR (deduplicated)
    const idem1 = await call(env.origin, '/api/bookings', {
      method: 'POST',
      cookie: memberACookie,
      body: {
        type: 'Uçak',
        title: 'İstanbul (IST) → Antalya (AYT)',
        subtitle: 'Turkish Airlines · TK2410',
        date: '2026-12-12',
        passenger: 'Aylin Karahan',
        lookupSurname: 'Karahan',
        price: 1900,
        idempotencyKey: 'idem-key-double-click-001',
      },
    });
    const idem2 = await call(env.origin, '/api/bookings', {
      method: 'POST',
      cookie: memberACookie,
      body: {
        type: 'Uçak',
        title: 'İstanbul (IST) → Antalya (AYT)',
        subtitle: 'Turkish Airlines · TK2410',
        date: '2026-12-12',
        passenger: 'Aylin Karahan',
        lookupSurname: 'Karahan',
        price: 1900,
        idempotencyKey: 'idem-key-double-click-001',
      },
    });
    assert.equal(idem1.status, 201);
    assert.equal(idem2.status, 200);
    assert.equal(idem2.json.deduplicated, true);
    assert.equal(idem2.json.booking.pnr, idem1.json.booking.pnr);

    // Exact match -> 200
    const okLookup = await call(env.origin, '/api/bookings/lookup', {
      method: 'POST',
      body: { pnr: bookingPnr, surname: 'KARAHAN' },
    });
    assert.equal(okLookup.status, 200);
    assert.equal(okLookup.json.booking.pnr, bookingPnr);

    // Wrong surname -> 404
    const badSurname = await call(env.origin, '/api/bookings/lookup', {
      method: 'POST',
      body: { pnr: bookingPnr, surname: 'YILMAZ' },
    });
    assert.equal(badSurname.status, 404);

    // Fake PNR -> 404
    const fakePnr = await call(env.origin, '/api/bookings/lookup', {
      method: 'POST',
      body: { pnr: 'XYZ123', surname: 'KARAHAN' },
    });
    assert.equal(fakePnr.status, 404);
  });

  await t.test('Cross-user isolation: Member B cannot see or cancel Member A booking', async () => {
    const regB = await call(env.origin, '/api/auth/register', {
      method: 'POST',
      body: {
        email: 'mert@example.com',
        password: 'AnotherStrongPass2026!',
        firstName: 'Mert',
        lastName: 'Demir',
        phone: '+905310000000',
        accountType: 'individual',
      },
    });
    assert.equal(regB.status, 201);
    memberBCookie = regB.cookie;

    const listB = await call(env.origin, '/api/bookings', { cookie: memberBCookie });
    assert.equal(listB.status, 200);
    assert.equal(listB.json.bookings.length, 0);

    const cancelOther = await call(env.origin, `/api/bookings/${bookingId}/cancel`, {
      method: 'POST',
      cookie: memberBCookie,
    });
    assert.equal(cancelOther.status, 404);
  });

  await t.test('Admin RBAC, pricing update, password reset & audit log', async () => {
    // Member forbidden from admin endpoints
    const memberAdminTry = await call(env.origin, '/api/admin/bookings', { cookie: memberACookie });
    assert.equal(memberAdminTry.status, 403);

    // Create real admin in SQLite & login
    await createAccount(env.db, {
      email: 'ops@flytoaspan.com',
      password: 'AdminSuperSecret2026!',
      role: 'admin',
      firstName: 'Ops',
      lastName: 'Admin',
      phone: '',
      accountType: 'individual',
    });
    const adminLogin = await call(env.origin, '/api/auth/login', {
      method: 'POST',
      body: { email: 'ops@flytoaspan.com', password: 'AdminSuperSecret2026!' },
    });
    assert.equal(adminLogin.status, 200);
    const adminCookie = adminLogin.cookie;

    const pricingRes = await call(env.origin, '/api/admin/pricing', {
      method: 'PATCH',
      cookie: adminCookie,
      body: { domesticAddTRY: 210, centralAsiaPercent: 8, intlPercent: 6, hotelPercent: 9, transferAddTRY: 180 },
    });
    assert.equal(pricingRes.status, 200);

    const pwdReset = await call(env.origin, '/api/auth/password-reset-request', {
      method: 'POST',
      body: { email: 'aylin@example.com' },
    });
    assert.equal(pwdReset.status, 200);

    const auditRes = await call(env.origin, '/api/admin/audit', { cookie: adminCookie });
    assert.equal(auditRes.status, 200);
    assert.ok(auditRes.json.logs.some((l) => l.action === 'admin:pricing_update'));
    assert.ok(auditRes.json.logs.some((l) => l.action === 'auth:password_reset_request'));

    // Admin manual FX override & reset
    const fxOverride = await call(env.origin, '/api/admin/fx', {
      method: 'PATCH',
      cookie: adminCookie,
      body: { usdTry: 52.5, eurTry: 57.0, tryKzt: 9.25, tryRub: 1.75 },
    });
    assert.equal(fxOverride.status, 200);
    assert.equal(fxOverride.json.manual, true);
    const fxAfter = await call(env.origin, '/api/fx');
    assert.equal(fxAfter.json.manual, true);
    assert.equal(fxAfter.json.rates.KZT, 9.25);

    const fxReset = await call(env.origin, '/api/admin/fx', { method: 'DELETE', cookie: adminCookie });
    assert.equal(fxReset.status, 200);
    assert.equal(fxReset.json.manual, false);

    // Admin real users listing & role promotion
    const usersRes = await call(env.origin, '/api/admin/users', { cookie: adminCookie });
    assert.equal(usersRes.status, 200);
    const aylin = usersRes.json.users.find((u) => u.email === 'aylin@example.com');
    assert.ok(aylin);
    const promoteRes = await call(env.origin, `/api/admin/users/${aylin.id}/role`, {
      method: 'PATCH',
      cookie: adminCookie,
      body: { role: 'admin' },
    });
    assert.equal(promoteRes.status, 200);
    assert.equal(promoteRes.json.user.role, 'admin');

    // Admin Hotels & Transfers catalog CRUD
    const trSave = await call(env.origin, '/api/admin/catalog/transfers', {
      method: 'PUT',
      cookie: adminCookie,
      body: {
        revision: 0,
        items: [{ id: 'tr-1', city: 'ASTANA', vehicle: 'Mercedes V-Class VIP', route: 'NQZ → Merkez', capacity: '1-4', baggage: '4', price: 1850, active: true }],
      },
    });
    assert.equal(trSave.status, 200);
    assert.equal(trSave.json.entry.items.length, 1);
  });

  await t.test('SaaS B2B: Corporate pending signup, Admin approve+password, tenant isolation & instant session wipe', async () => {
    const adminLogin = await call(env.origin, '/api/auth/login', {
      method: 'POST',
      body: { email: 'ops@flytoaspan.com', password: 'AdminSuperSecret2026!' },
    });
    assert.equal(adminLogin.status, 200);
    const adminCookie = adminLogin.cookie;

    // 1. Corporate applicant signs up WITHOUT password -> pending status, no session cookie
    const corpReg = await call(env.origin, '/api/auth/register', {
      method: 'POST',
      body: {
        email: 'satis@astanasky.kz',
        firstName: 'Aida',
        lastName: 'Nurlanova',
        companyName: 'Astana Sky Turizm',
        phone: '+77015554433',
        accountType: 'corporate',
      },
    });
    assert.equal(corpReg.status, 201);
    assert.equal(corpReg.json.pending, true);
    assert.equal(corpReg.json.user, null);

    // 2. Pending user cannot log in -> 403
    const pendingTry = await call(env.origin, '/api/auth/login', {
      method: 'POST',
      body: { email: 'satis@astanasky.kz', password: 'AnyPassword12345!' },
    });
    assert.equal(pendingTry.status, 403);

    // 3. Admin sees pending user, approves with password + permissions (auto-creates org)
    const usersList = await call(env.origin, '/api/admin/users', { cookie: adminCookie });
    const aida = usersList.json.users.find((u) => u.email === 'satis@astanasky.kz');
    assert.ok(aida);
    assert.equal(aida.status, 'pending');

    const approveRes = await call(env.origin, `/api/admin/users/${aida.id}/approve`, {
      method: 'POST',
      cookie: adminCookie,
      body: {
        password: 'AidaCorpPassword2026!',
        permissions: ['flights.sell', 'bookings.view_org', 'bookings.manage'],
      },
    });
    assert.equal(approveRes.status, 200);
    assert.equal(approveRes.json.user.status, 'active');
    assert.ok(approveRes.json.user.organizationId);
    const orgId = approveRes.json.user.organizationId;

    // 4. Approved corporate staff logs in with Admin-assigned password
    const staffLogin = await call(env.origin, '/api/auth/login', {
      method: 'POST',
      body: { email: 'satis@astanasky.kz', password: 'AidaCorpPassword2026!' },
    });
    assert.equal(staffLogin.status, 200);
    const staffCookie = staffLogin.cookie;
    assert.ok(staffCookie);

    // 5. Staff creates a booking and can ONLY see their own org's booking (NOT Member A's booking)
    const staffBk = await call(env.origin, '/api/bookings', {
      method: 'POST',
      cookie: staffCookie,
      body: {
        type: 'Uçak',
        title: 'Almatı (ALA) → İstanbul (IST)',
        subtitle: 'Air Astana · KC911',
        date: '2026-12-20',
        passenger: 'Nurlan Bek',
        lookupSurname: 'Bek',
        price: 7200,
      },
    });
    assert.equal(staffBk.status, 201);

    const staffList = await call(env.origin, '/api/admin/bookings', { cookie: staffCookie });
    assert.equal(staffList.status, 200);
    assert.equal(staffList.json.bookings.length, 1);
    assert.equal(staffList.json.bookings[0].pnr, staffBk.json.booking.pnr);

    // Staff CANNOT access Super Admin only endpoints (/api/admin/users) -> 403
    const staffForbidden = await call(env.origin, '/api/admin/users', { cookie: staffCookie });
    assert.equal(staffForbidden.status, 403);

    // 6. Suspending the Organization immediately invalidates staff's active session
    const suspendOrg = await call(env.origin, `/api/admin/organizations/${orgId}`, {
      method: 'PATCH',
      cookie: adminCookie,
      body: { status: 'suspended' },
    });
    assert.equal(suspendOrg.status, 200);
    assert.equal(suspendOrg.json.organization.status, 'suspended');

    const afterSuspend = await call(env.origin, '/api/admin/bookings', { cookie: staffCookie });
    assert.equal(afterSuspend.status, 401);

    // Suspended org user cannot log back in -> 403
    const reloginBlocked = await call(env.origin, '/api/auth/login', {
      method: 'POST',
      body: { email: 'satis@astanasky.kz', password: 'AidaCorpPassword2026!' },
    });
    assert.equal(reloginBlocked.status, 403);
  });

  await t.test('Finance & CRM: Income/Expense ledger, CRM tasks CRUD & seller/org booking JOIN', async () => {
    const adminLogin = await call(env.origin, '/api/auth/login', {
      method: 'POST',
      body: { email: 'ops@flytoaspan.com', password: 'AdminSuperSecret2026!' },
    });
    assert.equal(adminLogin.status, 200);
    const adminCookie = adminLogin.cookie;

    // 1. Admin bookings include JOINed sellerName & organizationName
    const allBookings = await call(env.origin, '/api/admin/bookings', { cookie: adminCookie });
    assert.equal(allBookings.status, 200);
    const aidaBooking = allBookings.json.bookings.find((b) => b.passenger === 'Nurlan Bek');
    assert.ok(aidaBooking);
    assert.equal(aidaBooking.sellerName, 'Aida Nurlanova');
    assert.equal(aidaBooking.organizationName, 'Astana Sky Turizm');

    // 2. Finance income/expense CRUD
    const addExp = await call(env.origin, '/api/admin/finance', {
      method: 'POST',
      cookie: adminCookie,
      body: { type: 'expense', category: 'Reklam & Pazarlama', title: 'Google Ads Kasım', amount: 4500, entryDate: '2026-11-24' },
    });
    assert.equal(addExp.status, 201);
    assert.equal(addExp.json.entry.amount, 4500);

    const listFin = await call(env.origin, '/api/admin/finance', { cookie: adminCookie });
    assert.equal(listFin.status, 200);
    assert.equal(listFin.json.entries.length, 1);

    const delFin = await call(env.origin, `/api/admin/finance/${addExp.json.entry.id}`, {
      method: 'DELETE',
      cookie: adminCookie,
    });
    assert.equal(delFin.status, 200);

    // 3. CRM tasks CRUD
    const addTask = await call(env.origin, '/api/admin/crm/tasks', {
      method: 'POST',
      cookie: adminCookie,
      body: { title: 'Astana Sky limit görüşmesi', customerName: 'Astana Sky Turizm', pnr: aidaBooking.pnr, dueDate: '2026-11-25', priority: 'high' },
    });
    assert.equal(addTask.status, 201);
    assert.equal(addTask.json.task.status, 'open');

    const doneTask = await call(env.origin, `/api/admin/crm/tasks/${addTask.json.task.id}`, {
      method: 'PATCH',
      cookie: adminCookie,
      body: { status: 'done' },
    });
    assert.equal(doneTask.status, 200);
    assert.equal(doneTask.json.task.status, 'done');

    const delTask = await call(env.origin, `/api/admin/crm/tasks/${addTask.json.task.id}`, {
      method: 'DELETE',
      cookie: adminCookie,
    });
    assert.equal(delTask.status, 200);
  });

  await t.test('B2B Cari Limit auto-deduction, 402 block, payment, Saved Passengers, Price Alerts & Tours', async () => {
    const adminLogin = await call(env.origin, '/api/auth/login', {
      method: 'POST',
      body: { email: 'ops@flytoaspan.com', password: 'AdminSuperSecret2026!' },
    });
    const adminCookie = adminLogin.cookie;

    // 1. Create org with 10.000 TL credit limit & approve corporate agent into it
    const orgRes = await call(env.origin, '/api/admin/organizations', {
      method: 'POST',
      cookie: adminCookie,
      body: { name: 'B2B Cari Test Acente', type: 'agency', creditLimitTRY: 10000, allowedModules: ['flights', 'tours'] },
    });
    assert.equal(orgRes.status, 201);
    const orgId = orgRes.json.organization.id;

    await call(env.origin, '/api/auth/register', {
      method: 'POST',
      body: { email: 'cari@test.com', firstName: 'Can', lastName: 'Yilmaz', companyName: 'B2B Cari Test Acente', phone: '+905310001122', accountType: 'corporate' },
    });
    const usersList = await call(env.origin, '/api/admin/users', { cookie: adminCookie });
    const can = usersList.json.users.find((u) => u.email === 'cari@test.com');
    await call(env.origin, `/api/admin/users/${can.id}/approve`, {
      method: 'POST',
      cookie: adminCookie,
      body: { password: 'CariAgentPass2026!', organizationId: orgId, permissions: ['flights.sell', 'tours.sell', 'bookings.view_own'] },
    });
    const agentLogin = await call(env.origin, '/api/auth/login', {
      method: 'POST',
      body: { email: 'cari@test.com', password: 'CariAgentPass2026!' },
    });
    const agentCookie = agentLogin.cookie;

    // 2. Book 7.000 TL tour -> succeeds & deducts from Cari Limit
    const tourBk = await call(env.origin, '/api/bookings', {
      method: 'POST',
      cookie: agentCookie,
      body: { type: 'Tur', title: 'Kapadokya Balon Turu', subtitle: '2 Gece', date: '2026-12-18', passenger: 'Can Yilmaz', lookupSurname: 'Yilmaz', price: 7000 },
    });
    assert.equal(tourBk.status, 201);

    // 3. Second booking of 5.000 TL exceeds 10.000 TL limit -> 402 Payment Required!
    const overLimit = await call(env.origin, '/api/bookings', {
      method: 'POST',
      cookie: agentCookie,
      body: { type: 'Uçak', title: 'IST → ALA', subtitle: 'KC912', date: '2026-12-20', passenger: 'Can Yilmaz', lookupSurname: 'Yilmaz', price: 5000 },
    });
    assert.equal(overLimit.status, 402);

    // 4. Admin records 4.000 TL payment -> usedCredit drops to 3.000 TL, ledger has 2 rows
    const payRes = await call(env.origin, `/api/admin/organizations/${orgId}/payment`, {
      method: 'POST',
      cookie: adminCookie,
      body: { amount: 4000, description: 'EFT Tahsilat' },
    });
    assert.equal(payRes.status, 201);
    assert.equal(payRes.json.organization.usedCreditTRY, 3000);
    assert.equal(payRes.json.organization.remainingCreditTRY, 7000);

    const ledgerRes = await call(env.origin, `/api/admin/organizations/${orgId}/ledger`, { cookie: adminCookie });
    assert.equal(ledgerRes.status, 200);
    assert.equal(ledgerRes.json.entries.length, 2);

    // 5. Persistent Saved Passengers & Price Alerts
    const paxAdd = await call(env.origin, '/api/passengers', {
      method: 'POST',
      cookie: agentCookie,
      body: { fullName: 'Can Yilmaz', tcOrPassport: '12345678901', birthDate: '1992-05-14' },
    });
    assert.equal(paxAdd.status, 201);
    const paxList = await call(env.origin, '/api/passengers', { cookie: agentCookie });
    assert.equal(paxList.json.passengers.length, 1);

    const alertAdd = await call(env.origin, '/api/alerts', {
      method: 'POST',
      cookie: agentCookie,
      body: { route: 'IST → ALA', target: 5800 },
    });
    assert.equal(alertAdd.status, 201);
    const alertList = await call(env.origin, '/api/alerts', { cookie: agentCookie });
    assert.equal(alertList.json.alerts.length, 1);

    // 6. Health check endpoint
    const health = await call(env.origin, '/api/health');
    assert.equal(health.status, 200);
    assert.equal(health.json.ok, true);

    // 7. CRM Quote creation & 1-click convert to live booking + PNR
    const qCreate = await call(env.origin, '/api/admin/crm/quotes', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        customerName: 'Mehmet Arslan',
        customerPhone: '+905310002233',
        type: 'Uçak',
        title: 'İstanbul (IST) → Almatı (ALA)',
        details: 'Air Astana · 2 Yetişkin',
        travelDate: '2026-12-22',
        price: 13800,
      },
    });
    assert.equal(qCreate.status, 201);
    assert.match(qCreate.json.quote.quoteNo, /^TKF-/);

    const qConv = await call(env.origin, `/api/admin/crm/quotes/${qCreate.json.quote.id}/convert`, {
      method: 'POST',
      cookie: adminCookie,
    });
    assert.equal(qConv.status, 201);
    assert.equal(qConv.json.quote.status, 'Onaylandı');
    assert.ok(qConv.json.booking.pnr);
    assert.equal(qConv.json.quote.convertedPnr, qConv.json.booking.pnr);
  });
});

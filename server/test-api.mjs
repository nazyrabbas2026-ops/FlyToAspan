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
});

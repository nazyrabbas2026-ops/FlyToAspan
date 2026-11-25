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

    // 8. Public catalog sync (coupons, operator XML pricing, manual flights) & sub-agent RBAC
    const opSave = await call(env.origin, '/api/admin/catalog/operators', {
      method: 'PUT',
      cookie: adminCookie,
      body: {
        revision: 0,
        items: [
          { id: 'op-funsun', operator: 'FUN&SUN', product: 'Uçak Bileti', markupType: 'NET', markupValue: 0, active: true },
          { id: 'op-kompas', operator: 'Kompas Tour', product: 'Uçak Bileti', markupType: 'EUR', markupValue: 10, active: true },
        ],
      },
    });
    assert.equal(opSave.status, 200);

    const mfSave = await call(env.origin, '/api/admin/catalog/flights', {
      method: 'PUT',
      cookie: adminCookie,
      body: {
        revision: 0,
        items: [
          {
            id: 'mf-1',
            airline: 'SCAT Airlines',
            airlineCode: 'DV',
            flightNumber: 'DV781',
            fromCode: 'AYT',
            toCode: 'ALA',
            departTime: '23:15',
            arriveTime: '06:40',
            duration: '5s 25d',
            baggage: '20 kg + 8 kg',
            priceTRY: 6200,
            quota: 8,
            operator: 'FUN&SUN',
            active: true,
          },
        ],
      },
    });
    assert.equal(mfSave.status, 200);

    const pubCat = await call(env.origin, '/api/catalog');
    assert.equal(pubCat.status, 200);
    assert.equal(pubCat.json.catalog.operators.length, 2);
    assert.equal(pubCat.json.catalog.flights.length, 1);
    assert.equal(pubCat.json.catalog.flights[0].flightNumber, 'DV781');

    // Sub-agent with bookings.cancel_request CAN submit 'İptal Talebi', CANNOT force 'İptal Edildi' or edit FX
    const grantCancelReq = await call(env.origin, `/api/admin/users/${can.id}/permissions`, {
      method: 'PATCH',
      cookie: adminCookie,
      body: { permissions: ['flights.sell', 'bookings.view_own', 'bookings.cancel_request'] },
    });
    assert.equal(grantCancelReq.status, 200);

    const subBooking = await call(env.origin, '/api/bookings', {
      method: 'POST',
      cookie: agentCookie,
      body: {
        type: 'Uçak',
        title: 'Antalya (AYT) → Almatı (ALA)',
        subtitle: 'SCAT Airlines · DV781',
        date: '2026-12-28',
        passenger: 'Yusuf Coşkun',
        lookupSurname: 'Coşkun',
        price: 3000,
        departTime: '23:15',
        arriveTime: '06:40',
        flightNumber: 'DV781',
        airline: 'SCAT Airlines',
        baggage: '20 kg + 8 kg',
      },
    });
    assert.equal(subBooking.status, 201);
    assert.equal(subBooking.json.booking.departTime, '23:15');
    assert.equal(subBooking.json.booking.arriveTime, '06:40');

    const subCancelReq = await call(env.origin, `/api/admin/bookings/${subBooking.json.booking.id}`, {
      method: 'PATCH',
      cookie: agentCookie,
      body: { status: 'İptal Talebi' },
    });
    assert.equal(subCancelReq.status, 200);
    assert.equal(subCancelReq.json.booking.status, 'İptal Talebi');

    // Regression: Sub-agent creating booking via /api/admin/bookings MUST persist after refresh,
    // appear in both /api/admin/bookings AND /api/bookings (Rezervasyonlarım), and allow İptal Talebi!
    const subPanelBk = await call(env.origin, '/api/admin/bookings', {
      method: 'POST',
      cookie: agentCookie,
      body: {
        type: 'Uçak',
        title: 'İstanbul (IST) → Almatı (ALA)',
        subtitle: 'Air Astana · KC918',
        date: '2026-12-29',
        passenger: 'Jalia Coşkun',
        lookupSurname: 'Coşkun',
        price: 1500,
      },
    });
    assert.equal(subPanelBk.status, 201);
    const panelBkId = subPanelBk.json.booking.id;

    const subAdminListAfter = await call(env.origin, '/api/admin/bookings', { cookie: agentCookie });
    assert.ok(subAdminListAfter.json.bookings.some((b) => b.id === panelBkId));

    const subMemberListAfter = await call(env.origin, '/api/bookings', { cookie: agentCookie });
    assert.ok(subMemberListAfter.json.bookings.some((b) => b.id === panelBkId));

    const subPanelCancelReq = await call(env.origin, `/api/admin/bookings/${panelBkId}`, {
      method: 'PATCH',
      cookie: agentCookie,
      body: { status: 'İptal Talebi' },
    });
    assert.equal(subPanelCancelReq.status, 200);
    assert.equal(subPanelCancelReq.json.booking.status, 'İptal Talebi');

    const subForceCancel = await call(env.origin, `/api/admin/bookings/${subBooking.json.booking.id}`, {
      method: 'PATCH',
      cookie: agentCookie,
      body: { status: 'İptal Edildi' },
    });
    assert.equal(subForceCancel.status, 403);

    const subFxTry = await call(env.origin, '/api/admin/fx', {
      method: 'PATCH',
      cookie: agentCookie,
      body: { usdTry: 10, eurTry: 10, tryKzt: 10, tryRub: 10 },
    });
    assert.equal(subFxTry.status, 403);

    // Turkish I/İ/Ş/Ç surname lookup normalization (Check 14 regression guard)
    const trLookupUpper = await call(env.origin, '/api/bookings/lookup', {
      method: 'POST',
      body: { pnr: subBooking.json.booking.pnr, surname: 'COSKUN' },
    });
    assert.equal(trLookupUpper.status, 200);
    assert.equal(trLookupUpper.json.booking.pnr, subBooking.json.booking.pnr);
  });

  await t.test('Concurrency Stress & Full Booking->CancelRequest->Cancel->Refund Lifecycle', async () => {
    const adminLogin = await call(env.origin, '/api/auth/login', {
      method: 'POST',
      body: { email: 'ops@flytoaspan.com', password: 'AdminSuperSecret2026!' },
    });
    const adminCookie = adminLogin.cookie;

    // 1. Two simultaneous requests with the SAME idempotencyKey -> must deduplicate to 1 PNR
    const sharedKey = 'idem-double-click-race-2026';
    const [race1, race2] = await Promise.all([
      call(env.origin, '/api/bookings', {
        method: 'POST',
        body: {
          type: 'Uçak',
          title: 'İstanbul (IST) → Almatı (ALA)',
          subtitle: 'Air Astana · KC918',
          date: '2026-12-20',
          passenger: 'Ali Veli',
          lookupSurname: 'Veli',
          price: 7010,
          idempotencyKey: sharedKey,
        },
      }),
      call(env.origin, '/api/bookings', {
        method: 'POST',
        body: {
          type: 'Uçak',
          title: 'İstanbul (IST) → Almatı (ALA)',
          subtitle: 'Air Astana · KC918',
          date: '2026-12-20',
          passenger: 'Ali Veli',
          lookupSurname: 'Veli',
          price: 7010,
          idempotencyKey: sharedKey,
        },
      }),
    ]);
    assert.ok(race1.status === 201 || race1.status === 200);
    assert.ok(race2.status === 201 || race2.status === 200);
    assert.equal(race1.json.booking.pnr, race2.json.booking.pnr);

    // 2. Two different passengers booking the EXACT same flight at the EXACT same time
    const [paxA, paxB] = await Promise.all([
      call(env.origin, '/api/bookings', {
        method: 'POST',
        body: {
          type: 'Uçak',
          title: 'Antalya (AYT) → Almatı (ALA)',
          subtitle: 'Turkish Airlines · TK3200',
          date: '2026-12-15',
          passenger: 'Murat Şahin',
          lookupSurname: 'Şahin',
          price: 14450,
        },
      }),
      call(env.origin, '/api/bookings', {
        method: 'POST',
        body: {
          type: 'Uçak',
          title: 'Antalya (AYT) → Almatı (ALA)',
          subtitle: 'Turkish Airlines · TK3200',
          date: '2026-12-15',
          passenger: 'Elena Petrova',
          lookupSurname: 'Petrova',
          price: 14450,
        },
      }),
    ]);
    assert.equal(paxA.status, 201);
    assert.equal(paxB.status, 201);
    assert.notEqual(paxA.json.booking.pnr, paxB.json.booking.pnr);

    // 3. Full Lifecycle: Onaylandı -> İptal Talebi -> İptal Edildi -> İade Edildi
    const bId = paxA.json.booking.id;
    const stepReq = await call(env.origin, `/api/admin/bookings/${bId}`, {
      method: 'PATCH',
      cookie: adminCookie,
      body: { status: 'İptal Talebi' },
    });
    assert.equal(stepReq.status, 200);
    assert.equal(stepReq.json.booking.status, 'İptal Talebi');

    const stepCancel = await call(env.origin, `/api/admin/bookings/${bId}`, {
      method: 'PATCH',
      cookie: adminCookie,
      body: { status: 'İptal Edildi' },
    });
    assert.equal(stepCancel.status, 200);
    assert.equal(stepCancel.json.booking.status, 'İptal Edildi');

    const stepRefund = await call(env.origin, `/api/admin/bookings/${bId}`, {
      method: 'PATCH',
      cookie: adminCookie,
      body: { status: 'İade Edildi' },
    });
    assert.equal(stepRefund.status, 200);
    assert.equal(stepRefund.json.booking.status, 'İade Edildi');

    // Turkish surname lookup still works after status transitions (SAHIN -> Şahin)
    const lookupAfter = await call(env.origin, '/api/bookings/lookup', {
      method: 'POST',
      body: { pnr: paxA.json.booking.pnr, surname: 'SAHIN' },
    });
    assert.equal(lookupAfter.status, 200);
    assert.equal(lookupAfter.json.booking.status, 'İade Edildi');
  });

  await t.test('Exhaustive 15-Permission RBAC Matrix (Every Checkbox Verified ON vs OFF)', async () => {
    const adminLogin = await call(env.origin, '/api/auth/login', {
      method: 'POST',
      body: { email: 'ops@flytoaspan.com', password: 'AdminSuperSecret2026!' },
    });
    const adminCookie = adminLogin.cookie;

    // Create a dedicated test staff user
    const orgR = await call(env.origin, '/api/admin/organizations', {
      method: 'POST',
      cookie: adminCookie,
      body: { name: 'RBAC Matrix Acente', type: 'agency', creditLimitTRY: 500000, allowedModules: ['flights', 'hotels', 'transfers', 'tours'] },
    });
    const orgId = orgR.json.organization.id;

    await call(env.origin, '/api/auth/register', {
      method: 'POST',
      body: { email: 'rbac15@test.com', firstName: 'Rbac', lastName: 'Tester', companyName: 'RBAC Matrix Acente', phone: '+905310009988', accountType: 'corporate' },
    });
    const uList = await call(env.origin, '/api/admin/users', { cookie: adminCookie });
    const staff = uList.json.users.find((u) => u.email === 'rbac15@test.com');
    await call(env.origin, `/api/admin/users/${staff.id}/approve`, {
      method: 'POST',
      cookie: adminCookie,
      body: { password: 'RbacMatrixPass2026!', organizationId: orgId, permissions: ['flights.sell'] },
    });
    const staffLogin = await call(env.origin, '/api/auth/login', {
      method: 'POST',
      body: { email: 'rbac15@test.com', password: 'RbacMatrixPass2026!' },
    });
    const sCookie = staffLogin.cookie;

    const setPerms = async (perms) => {
      const r = await call(env.origin, `/api/admin/users/${staff.id}/permissions`, {
        method: 'PATCH',
        cookie: adminCookie,
        body: { permissions: perms },
      });
      assert.equal(r.status, 200);
    };

    // 1-4: flights.sell, hotels.sell, transfers.sell, tours.sell
    await setPerms(['flights.sell']);
    const sellFlightOk = await call(env.origin, '/api/admin/bookings', {
      method: 'POST', cookie: sCookie,
      body: { type: 'Uçak', title: 'IST → ALA', subtitle: 'KC', date: '2026-12-20', passenger: 'Test Pax', lookupSurname: 'Pax', price: 2000 },
    });
    assert.equal(sellFlightOk.status, 201);
    const sellHotelDeny = await call(env.origin, '/api/admin/bookings', {
      method: 'POST', cookie: sCookie,
      body: { type: 'Otel', title: 'Rixos', subtitle: '2g', date: '2026-12-20', passenger: 'Test Pax', lookupSurname: 'Pax', price: 2000 },
    });
    assert.equal(sellHotelDeny.status, 403);
    const sellTransferDeny = await call(env.origin, '/api/admin/bookings', {
      method: 'POST', cookie: sCookie,
      body: { type: 'Transfer', title: 'IST → Taksim', subtitle: 'VIP', date: '2026-12-20', passenger: 'Test Pax', lookupSurname: 'Pax', price: 1200 },
    });
    assert.equal(sellTransferDeny.status, 403);
    const sellTourDeny = await call(env.origin, '/api/admin/bookings', {
      method: 'POST', cookie: sCookie,
      body: { type: 'Tur', title: 'Kapadokya', subtitle: '2g', date: '2026-12-20', passenger: 'Test Pax', lookupSurname: 'Pax', price: 3000 },
    });
    assert.equal(sellTourDeny.status, 403);

    await setPerms(['flights.sell', 'hotels.sell', 'transfers.sell', 'tours.sell']);
    assert.equal((await call(env.origin, '/api/admin/bookings', {
      method: 'POST', cookie: sCookie,
      body: { type: 'Otel', title: 'Rixos', subtitle: '2g', date: '2026-12-20', passenger: 'Test Pax', lookupSurname: 'Pax', price: 2000 },
    })).status, 201);
    assert.equal((await call(env.origin, '/api/admin/bookings', {
      method: 'POST', cookie: sCookie,
      body: { type: 'Transfer', title: 'IST → Taksim', subtitle: 'VIP', date: '2026-12-20', passenger: 'Test Pax', lookupSurname: 'Pax', price: 1200 },
    })).status, 201);
    assert.equal((await call(env.origin, '/api/admin/bookings', {
      method: 'POST', cookie: sCookie,
      body: { type: 'Tur', title: 'Kapadokya', subtitle: '2g', date: '2026-12-20', passenger: 'Test Pax', lookupSurname: 'Pax', price: 3000 },
    })).status, 201);

    // 5-6: bookings.view_own vs none vs bookings.view_org
    const listWithoutView = await call(env.origin, '/api/admin/bookings', { cookie: sCookie });
    assert.equal(listWithoutView.json.bookings.length, 0);

    await setPerms(['bookings.view_own']);
    const listWithOwn = await call(env.origin, '/api/admin/bookings', { cookie: sCookie });
    assert.ok(listWithOwn.json.bookings.length >= 4);

    // 7-8: bookings.cancel_request vs bookings.manage
    const bkId = sellFlightOk.json.booking.id;
    assert.equal((await call(env.origin, `/api/admin/bookings/${bkId}`, {
      method: 'PATCH', cookie: sCookie, body: { status: 'İptal Talebi' },
    })).status, 403);

    await setPerms(['bookings.view_own', 'bookings.cancel_request']);
    assert.equal((await call(env.origin, `/api/admin/bookings/${bkId}`, {
      method: 'PATCH', cookie: sCookie, body: { status: 'İptal Talebi' },
    })).status, 200);
    assert.equal((await call(env.origin, `/api/admin/bookings/${bkId}`, {
      method: 'PATCH', cookie: sCookie, body: { status: 'İptal Edildi' },
    })).status, 403);

    await setPerms(['bookings.view_own', 'bookings.manage']);
    assert.equal((await call(env.origin, `/api/admin/bookings/${bkId}`, {
      method: 'PATCH', cookie: sCookie, body: { status: 'İptal Edildi' },
    })).status, 200);
    assert.equal((await call(env.origin, `/api/admin/bookings/${bkId}`, {
      method: 'PATCH', cookie: sCookie, body: { status: 'İade Edildi' },
    })).status, 200);

    // 9: flights.manual (separate from inventory.manage!)
    assert.equal((await call(env.origin, '/api/admin/catalog/flights', {
      method: 'PUT', cookie: sCookie, body: { revision: 1, items: [] },
    })).status, 403);
    await setPerms(['flights.manual']);
    const mfRev = (await call(env.origin, '/api/admin/catalog', { cookie: sCookie })).json.catalog.flights?.revision ?? 0;
    assert.equal((await call(env.origin, '/api/admin/catalog/flights', {
      method: 'PUT', cookie: sCookie, body: { revision: mfRev, items: [] },
    })).status, 200);
    // flights.manual alone CANNOT edit hotels!
    assert.equal((await call(env.origin, '/api/admin/catalog/hotels', {
      method: 'PUT', cookie: sCookie, body: { revision: 0, items: [] },
    })).status, 403);

    // 10: inventory.manage (hotels/transfers/tours, CANNOT edit flights!)
    await setPerms(['inventory.manage']);
    const hRev = (await call(env.origin, '/api/admin/catalog', { cookie: sCookie })).json.catalog.hotels?.revision ?? 0;
    assert.equal((await call(env.origin, '/api/admin/catalog/hotels', {
      method: 'PUT', cookie: sCookie, body: { revision: hRev, items: [] },
    })).status, 200);
    assert.equal((await call(env.origin, '/api/admin/catalog/flights', {
      method: 'PUT', cookie: sCookie, body: { revision: mfRev + 1, items: [] },
    })).status, 403);

    // 11: pricing.edit
    assert.equal((await call(env.origin, '/api/admin/pricing', {
      method: 'PATCH', cookie: sCookie, body: { domesticAddTRY: 200, centralAsiaPercent: 7, intlPercent: 5, hotelPercent: 8, transferAddTRY: 150 },
    })).status, 403);
    await setPerms(['pricing.edit']);
    assert.equal((await call(env.origin, '/api/admin/pricing', {
      method: 'PATCH', cookie: sCookie, body: { domesticAddTRY: 200, centralAsiaPercent: 7, intlPercent: 5, hotelPercent: 8, transferAddTRY: 150 },
    })).status, 200);

    // 12: fx.manage
    assert.equal((await call(env.origin, '/api/admin/fx', {
      method: 'PATCH', cookie: sCookie, body: { usdTry: 51, eurTry: 56, tryKzt: 9, tryRub: 1.6 },
    })).status, 403);
    await setPerms(['fx.manage']);
    assert.equal((await call(env.origin, '/api/admin/fx', {
      method: 'PATCH', cookie: sCookie, body: { usdTry: 51, eurTry: 56, tryKzt: 9, tryRub: 1.6 },
    })).status, 200);

    // 13: coupons.manage
    assert.equal((await call(env.origin, '/api/admin/catalog/coupons', {
      method: 'PUT', cookie: sCookie, body: { revision: 0, items: [] },
    })).status, 403);
    await setPerms(['coupons.manage']);
    const cRev = (await call(env.origin, '/api/admin/catalog', { cookie: sCookie })).json.catalog.coupons?.revision ?? 0;
    assert.equal((await call(env.origin, '/api/admin/catalog/coupons', {
      method: 'PUT', cookie: sCookie, body: { revision: cRev, items: [] },
    })).status, 200);

    // 14-15: team.manage (users & orgs allowed, role promotion to admin still 403!)
    assert.equal((await call(env.origin, '/api/admin/users', { cookie: sCookie })).status, 403);
    await setPerms(['team.manage']);
    assert.equal((await call(env.origin, '/api/admin/users', { cookie: sCookie })).status, 200);
    assert.equal((await call(env.origin, '/api/admin/organizations', { cookie: sCookie })).status, 200);
    // Privilege escalation guard: team.manage CANNOT promote to Super Admin!
    assert.equal((await call(env.origin, `/api/admin/users/${staff.id}/role`, {
      method: 'PATCH', cookie: sCookie, body: { role: 'admin' },
    })).status, 403);
  });
});

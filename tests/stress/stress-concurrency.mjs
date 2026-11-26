import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { openDatabase } from '../../server/store.mjs';

const HOST = '127.0.0.1';
const PORT = Number(process.env.QA_STRESS_PORT || 4211);
const ORIGIN = `http://${HOST}:${PORT}`;

const digest = (value) => createHash('sha256').update(value).digest('hex');

const percentile = (sorted, p) => {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
};

function httpJson({ method, path, body, cookie, timeoutMs = 20_000, agent }) {
  return new Promise((resolveReq) => {
    const started = performance.now();
    const payload = body !== undefined ? JSON.stringify(body) : null;
    const headers = {
      Origin: ORIGIN,
      ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    };
    const req = http.request(
      { host: HOST, port: PORT, path, method, headers, agent, timeout: timeoutMs },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const ms = Math.round(performance.now() - started);
          const raw = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try { json = JSON.parse(raw); } catch { /* non-json */ }
          resolveReq({ status: res.statusCode ?? 0, ms, json, raw, error: null });
        });
      }
    );
    req.on('timeout', () => {
      req.destroy(new Error('REQUEST_TIMEOUT'));
    });
    req.on('error', (err) => {
      const ms = Math.round(performance.now() - started);
      resolveReq({ status: 0, ms, json: null, raw: '', error: err.code || err.message || 'SOCKET_ERROR' });
    });
    if (payload) req.write(payload);
    req.end();
  });
}

function seedUsersAndSessions(db, count, role, prefix) {
  const users = [];
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
  const fakeSalt = '00'.repeat(16);
  const fakeHash = '11'.repeat(64);
  const insertUser = db.prepare(`
    INSERT INTO users (id, email, salt, password_hash, role, profile, status, organization_id, permissions)
    VALUES (?, ?, ?, ?, ?, ?, 'active', NULL, '[]')
  `);
  const insertSession = db.prepare(`
    INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)
  `);
  db.exec('BEGIN');
  try {
    for (let i = 1; i <= count; i++) {
      const id = randomBytes(16).toString('hex');
      const email = `${prefix}.${i}@flytoaspan.test`;
      const profile = JSON.stringify({
        firstName: `${prefix}${i}`,
        lastName: `User${i}`,
        phone: `+90531${String(i).padStart(7, '0')}`,
        accountType: 'individual',
        miles: 0,
        createdAt: '2026-11-27',
      });
      insertUser.run(id, email, fakeSalt, fakeHash, role, profile);
      const token = randomBytes(32).toString('base64url');
      insertSession.run(digest(token), id, expiresAt);
      users.push({ id, email, cookie: `flytoaspan_session=${token}`, index: i });
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return users;
}

function startServer(dbPath) {
  return spawn(process.execPath, [resolve('server/index.mjs')], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      HOST,
      PORT: String(PORT),
      FLYTOASPAN_DB: dbPath,
      FLYTOASPAN_ORIGIN: ORIGIN,
      // Explicitly disable SMTP/mailer so zero external emails are attempted
      SMTP_HOST: '',
      RESEND_API_KEY: '',
    },
  });
}

async function waitServerReady(timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const r = await httpJson({ method: 'GET', path: '/api/pricing', timeoutMs: 2000 });
    if (r.status === 200) return;
    await new Promise((res) => setTimeout(res, 120));
  }
  throw new Error(`Test server on ${ORIGIN} failed to become ready`);
}

test('FlyToAspan Stress & Concurrency Suite (20->1000 users, Restart Idempotency, 10 Concurrent Admins)', async (t) => {
  const tempDir = mkdtempSync(join(tmpdir(), 'flytoaspan-stress-'));
  const dbPath = join(tempDir, 'stress.sqlite');

  // Seed 1,000 members + 10 admins directly into isolated temp SQLite DB
  const setupDb = openDatabase(dbPath);
  const members = seedUsersAndSessions(setupDb, 1000, 'member', 'loadmember');
  const admins = seedUsersAndSessions(setupDb, 10, 'admin', 'loadadmin');
  setupDb.close();

  const stderrLines = [];
  let serverProc = startServer(dbPath);
  serverProc.stderr?.on('data', (chunk) => stderrLines.push(chunk.toString('utf8')));

  const report = {
    executedAt: new Date().toISOString(),
    environment: { host: HOST, port: PORT, nodeVersion: process.version, platform: process.platform },
    waves: [],
    idempotency: {},
    adminConcurrency: {},
    sqliteLockMentionsInStderr: 0,
  };

  try {
    await waitServerReady();

    // =========================================================================
    // 1. STEPPED CONCURRENT BOOKING WAVES: 20 -> 100 -> 250 -> 500 -> 1,000
    // =========================================================================
    await t.test('1. Stepped booking load: 20 -> 100 -> 250 -> 500 -> 1,000 distinct concurrent members', async () => {
      const waveSizes = [20, 100, 250, 500, 1000];
      const verifyDb = openDatabase(dbPath);

      try {
        for (const n of waveSizes) {
          const agent = new http.Agent({ keepAlive: false, maxSockets: 2048 });
          const waveTag = `W${n}`;
          let inFlight = 0;
          let maxInFlight = 0;

          const waveStart = performance.now();
          const results = await Promise.all(
            members.slice(0, n).map(async (m, idx) => {
              inFlight += 1;
              if (inFlight > maxInFlight) maxInFlight = inFlight;
              try {
                const res = await httpJson({
                  method: 'POST',
                  path: '/api/bookings',
                  cookie: m.cookie,
                  agent,
                  timeoutMs: 30_000,
                  body: {
                    type: 'Uçak',
                    title: 'İstanbul (IST) → Antalya (AYT)',
                    subtitle: `TK24${10 + (idx % 9)} · ${waveTag}`,
                    date: '2026-12-25',
                    passenger: `${waveTag} Member${m.index}`,
                    lookupSurname: `User${m.index}`,
                    price: 1650 + (idx % 50) * 10,
                    idempotencyKey: `${waveTag}_${m.index}_${Date.now()}`,
                  },
                });
                return { member: m, ...res };
              } finally {
                inFlight -= 1;
              }
            })
          );
          const totalMs = Math.round(performance.now() - waveStart);
          agent.destroy();

          const ok201 = results.filter((r) => r.status === 201);
          const rateLimited429 = results.filter((r) => r.status === 429);
          const serverErr5xx = results.filter((r) => r.status >= 500);
          const other4xx = results.filter((r) => r.status >= 400 && r.status < 500 && r.status !== 429);
          const timeouts = results.filter((r) => r.error === 'REQUEST_TIMEOUT');
          const socketErrors = results.filter((r) => r.error && r.error !== 'REQUEST_TIMEOUT');
          const sqliteLockErrors = results.filter((r) =>
            /SQLITE_BUSY|database is locked/i.test(`${r.raw} ${r.error ?? ''}`)
          );

          const latencies = results.map((r) => r.ms).sort((a, b) => a - b);

          // Direct SQLite verification for every 201 booking in this wave
          const pnrs = ok201.map((r) => r.json?.booking?.pnr).filter(Boolean);
          const uniquePnrs = new Set(pnrs);
          let missingInDb = 0;
          let wrongOwnerInDb = 0;
          let duplicateRowsInDb = 0;

          const selectByPnr = verifyDb.prepare('SELECT id, pnr, owner_id FROM bookings WHERE pnr = ?');
          for (const r of ok201) {
            const pnr = r.json?.booking?.pnr;
            if (!pnr) { missingInDb += 1; continue; }
            const rows = selectByPnr.all(pnr);
            if (rows.length === 0) missingInDb += 1;
            else if (rows.length > 1) duplicateRowsInDb += rows.length - 1;
            else if (rows[0].owner_id !== r.member.id) wrongOwnerInDb += 1;
          }

          const waveMetrics = {
            targetUsers: n,
            achievedMaxConcurrency: maxInFlight,
            totalMs,
            success201: ok201.length,
            rateLimited429: rateLimited429.length,
            other4xx: other4xx.length,
            serverErr5xx: serverErr5xx.length,
            timeouts: timeouts.length,
            socketErrors: socketErrors.length,
            socketErrorCodes: Array.from(new Set(socketErrors.map((e) => e.error))),
            sqliteLockErrors: sqliteLockErrors.length,
            uniquePnrs: uniquePnrs.size,
            missingInDb,
            wrongOwnerInDb,
            duplicateRowsInDb,
            latencyMs: {
              min: latencies[0] ?? 0,
              p50: percentile(latencies, 50),
              p95: percentile(latencies, 95),
              p99: percentile(latencies, 99),
              max: latencies[latencies.length - 1] ?? 0,
            },
          };
          report.waves.push(waveMetrics);

          // Hard data-integrity assertions: every 201 must be persisted once with unique PNR & exact owner
          assert.equal(missingInDb, 0, `${waveTag}: lost bookings in SQLite`);
          assert.equal(wrongOwnerInDb, 0, `${waveTag}: cross-user owner_id mismatch`);
          assert.equal(duplicateRowsInDb, 0, `${waveTag}: duplicate PNR rows`);
          assert.equal(uniquePnrs.size, ok201.length, `${waveTag}: PNR collision`);
        }
      } finally {
        verifyDb.close();
      }
    });

    // =========================================================================
    // 2. IDEMPOTENCY: DELAYED RESEND (IN-PROCESS) vs AFTER SERVER RESTART
    // =========================================================================
    await t.test('2. Idempotency under delayed resend AND after server restart', async () => {
      const m = members[0];
      const idemKey = `restart_idem_${Date.now()}`;
      const payload = {
        type: 'Uçak',
        title: 'İstanbul (IST) → Almatı (ALA)',
        subtitle: 'KC912 · Idempotency Test',
        date: '2026-12-29',
        passenger: 'Idem RestartUser',
        lookupSurname: 'RestartUser',
        price: 6890,
        idempotencyKey: idemKey,
      };

      // A) First submission
      const first = await httpJson({ method: 'POST', path: '/api/bookings', cookie: m.cookie, body: payload });
      assert.equal(first.status, 201);
      const firstPnr = first.json.booking.pnr;

      // B) Delayed resend (same server process, after 500ms delay)
      await new Promise((r) => setTimeout(r, 500));
      const delayedRetry = await httpJson({ method: 'POST', path: '/api/bookings', cookie: m.cookie, body: payload });
      assert.equal(delayedRetry.status, 200);
      assert.equal(delayedRetry.json.deduplicated, true);
      assert.equal(delayedRetry.json.booking.pnr, firstPnr);

      // C) Restart server on SAME temporary SQLite DB, then resend EXACT same request + idempotencyKey
      serverProc.kill();
      await new Promise((r) => setTimeout(r, 500));
      serverProc = startServer(dbPath);
      serverProc.stderr?.on('data', (chunk) => stderrLines.push(chunk.toString('utf8')));
      await waitServerReady();

      const afterRestartRetry = await httpJson({ method: 'POST', path: '/api/bookings', cookie: m.cookie, body: payload });
      const checkDb = openDatabase(dbPath);
      const matchingRows = checkDb
        .prepare("SELECT id, pnr, status FROM bookings WHERE owner_id = ? AND details LIKE '%Idem RestartUser%'")
        .all(m.id);
      checkDb.close();

      report.idempotency = {
        inProcessDelayedRetry: {
          firstStatus: first.status,
          retryStatus: delayedRetry.status,
          deduplicated: Boolean(delayedRetry.json?.deduplicated),
          samePnr: delayedRetry.json?.booking?.pnr === firstPnr,
        },
        afterServerRestartRetry: {
          retryStatus: afterRestartRetry.status,
          deduplicated: Boolean(afterRestartRetry.json?.deduplicated),
          firstPnr,
          afterRestartPnr: afterRestartRetry.json?.booking?.pnr ?? null,
          totalDbRowsForSameIntent: matchingRows.length,
          duplicateCreatedOnRestart: matchingRows.length > 1,
        },
      };

      assert.equal(afterRestartRetry.status, 200, 'Restart idempotency must return 200 deduplicated');
      assert.equal(afterRestartRetry.json?.deduplicated, true);
      assert.equal(afterRestartRetry.json?.booking?.pnr, firstPnr);
      assert.equal(matchingRows.length, 1, 'Must have exactly 1 DB row after restart retry');
    });

    // =========================================================================
    // 3. 10 CONCURRENT ADMINS: DISTINCT BOOKINGS, SAME BOOKING, PRICING, COUPONS
    // =========================================================================
    await t.test('3. 10 concurrent admin accounts: distinct bookings, conflicting same booking, pricing & coupons', async () => {
      // Seed 11 bookings for admin tests
      const createdIds = [];
      for (let i = 0; i < 11; i++) {
        const res = await httpJson({
          method: 'POST',
          path: '/api/admin/bookings',
          cookie: admins[0].cookie,
          body: {
            type: 'Uçak',
            title: `AdminTest ${i}`,
            subtitle: 'TK100',
            date: '2026-12-28',
            passenger: `AdminTarget ${i}`,
            lookupSurname: `Target${i}`,
            price: 2000 + i * 100,
          },
        });
        assert.equal(res.status, 201);
        createdIds.push(res.json.booking.id);
      }

      const verifyDb = openDatabase(dbPath);
      try {
        // 3A) 10 admins concurrently update 10 DIFFERENT bookings
        const distinctBeforeAudit = verifyDb.prepare("SELECT COUNT(*) AS c FROM audit_logs WHERE action = 'admin:booking_status'").get().c;
        const distinctRes = await Promise.all(
          admins.map((adm, idx) =>
            httpJson({
              method: 'PATCH',
              path: `/api/admin/bookings/${createdIds[idx]}`,
              cookie: adm.cookie,
              body: { status: 'Tamamlandı' },
            })
          )
        );
        const distinctAfterAudit = verifyDb.prepare("SELECT COUNT(*) AS c FROM audit_logs WHERE action = 'admin:booking_status'").get().c;
        const distinctOk = distinctRes.filter((r) => r.status === 200).length;
        const distinctDbDone = createdIds
          .slice(0, 10)
          .filter((id) => verifyDb.prepare('SELECT status FROM bookings WHERE id = ?').get(id)?.status === 'Tamamlandı').length;

        assert.equal(distinctOk, 10);
        assert.equal(distinctDbDone, 10);

        // 3B) 10 admins concurrently send CONFLICTING statuses to the SAME booking (createdIds[10])
        const conflictTargetId = createdIds[10];
        const conflictingStatuses = [
          'Tamamlandı', 'İptal Edildi', 'İade Edildi', 'İptal Talebi', 'Onaylandı',
          'Tamamlandı', 'İptal Edildi', 'İade Edildi', 'İptal Talebi', 'Tamamlandı',
        ];
        const conflictBeforeAudit = verifyDb.prepare("SELECT COUNT(*) AS c FROM audit_logs WHERE action = 'admin:booking_status'").get().c;
        const conflictRes = await Promise.all(
          admins.map((adm, idx) =>
            httpJson({
              method: 'PATCH',
              path: `/api/admin/bookings/${conflictTargetId}`,
              cookie: adm.cookie,
              body: { status: conflictingStatuses[idx], expectedStatus: 'Onaylandı' },
            })
          )
        );
        const conflictAfterAudit = verifyDb.prepare("SELECT COUNT(*) AS c FROM audit_logs WHERE action = 'admin:booking_status'").get().c;
        const finalConflictStatus = verifyDb.prepare('SELECT status FROM bookings WHERE id = ?').get(conflictTargetId)?.status;

        // 3C) 10 admins concurrently save DIFFERENT pricing rules with the same revision (PATCH /api/admin/pricing)
        const initPriceRes = await httpJson({ method: 'GET', path: '/api/pricing' });
        const initPriceRev = initPriceRes.json?.markup?.revision ?? 0;
        const priceBeforeAudit = verifyDb.prepare("SELECT COUNT(*) AS c FROM audit_logs WHERE action = 'admin:pricing_update'").get().c;
        const pricingRes = await Promise.all(
          admins.map((adm, idx) =>
            httpJson({
              method: 'PATCH',
              path: '/api/admin/pricing',
              cookie: adm.cookie,
              body: {
                revision: initPriceRev,
                domesticAddTRY: 150 + idx * 10,
                centralAsiaPercent: 5 + idx,
                intlPercent: 5,
                hotelPercent: 8,
                transferAddTRY: 150,
              },
            })
          )
        );
        const priceAfterAudit = verifyDb.prepare("SELECT COUNT(*) AS c FROM audit_logs WHERE action = 'admin:pricing_update'").get().c;
        const finalMarkupRow = verifyDb.prepare("SELECT value FROM settings WHERE key = 'markup'").get();
        const finalMarkup = finalMarkupRow ? JSON.parse(finalMarkupRow.value) : null;

        // 3D) 10 admins concurrently save COUPONS list with the SAME revision (PUT /api/admin/catalog/coupons)
        const catRes = await httpJson({ method: 'GET', path: '/api/admin/catalog', cookie: admins[0].cookie });
        const baseRev = catRes.json?.catalog?.coupons?.revision ?? 0;
        const couponBeforeAudit = verifyDb.prepare('SELECT COUNT(*) AS c FROM audit_logs').get().c;
        const couponRes = await Promise.all(
          admins.map((adm, idx) =>
            httpJson({
              method: 'PUT',
              path: '/api/admin/catalog/coupons',
              cookie: adm.cookie,
              body: {
                revision: baseRev,
                items: [
                  {
                    id: `cp-${idx}`,
                    code: `ADM${idx}OFF`,
                    title: `Admin ${idx} Kuponu`,
                    category: 'Uçak',
                    validUntil: '31 Aralık 2027',
                    active: true,
                  },
                ],
              },
            })
          )
        );
        const couponAfterAudit = verifyDb.prepare('SELECT COUNT(*) AS c FROM audit_logs').get().c;
        const couponOk = couponRes.filter((r) => r.status === 200).length;
        const couponConflict409 = couponRes.filter((r) => r.status === 409).length;
        assert.equal(couponOk, 1, 'Expected exactly 1 winner for optimistic-locked coupons');
        assert.equal(couponConflict409, 9, 'Expected 9 admins to receive 409 Conflict for coupons');

        report.adminConcurrency = {
          distinctBookings: {
            admins: 10,
            ok200: distinctOk,
            dbVerifiedDone: distinctDbDone,
            auditEntriesAdded: distinctAfterAudit - distinctBeforeAudit,
          },
          conflictingSameBooking: {
            admins: 10,
            ok200: conflictRes.filter((r) => r.status === 200).length,
            conflict409: conflictRes.filter((r) => r.status === 409).length,
            finalStatusInDb: finalConflictStatus,
            auditEntriesAdded: conflictAfterAudit - conflictBeforeAudit,
            silentOverwriteObserved: conflictRes.filter((r) => r.status === 200).length > 1,
          },
          concurrentPricing: {
            admins: 10,
            ok200: pricingRes.filter((r) => r.status === 200).length,
            conflict409: pricingRes.filter((r) => r.status === 409).length,
            finalDomesticAddTRY: finalMarkup?.domesticAddTRY ?? null,
            auditEntriesAdded: priceAfterAudit - priceBeforeAudit,
            silentOverwriteObserved: pricingRes.filter((r) => r.status === 200).length > 1,
          },
          concurrentCoupons: {
            admins: 10,
            ok200: couponOk,
            conflict409: couponConflict409,
            auditEntriesAdded: couponAfterAudit - couponBeforeAudit,
            missingAuditLogObserved: couponAfterAudit - couponBeforeAudit === 0,
          },
        };
      } finally {
        verifyDb.close();
      }
    });
  } finally {
    try { serverProc.kill(); } catch { /* ignore */ }
    await new Promise((r) => setTimeout(r, 300));
    report.sqliteLockMentionsInStderr = stderrLines.filter((l) => /SQLITE_BUSY|locked/i.test(l)).length;
    mkdirSync(resolve('test-results'), { recursive: true });
    writeFileSync(resolve('test-results/stress-report.json'), JSON.stringify(report, null, 2));
    try { rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
});

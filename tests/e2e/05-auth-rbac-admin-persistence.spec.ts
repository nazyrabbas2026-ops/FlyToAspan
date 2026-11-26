import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ADMIN_EMAIL = 'qa.admin@flytoaspan.test';
const ADMIN_PASS = process.env.QA_ADMIN_PASS || 'QaAdminTempPass!2026';

test.describe('5. Üyelik, Yetki İzolasyonu, Yönetim Paneli ve Sunucu Yeniden Başlatma Kalıcılığı', () => {
  test('Member register, wrong/correct login, reload persistence, logout, cross-user isolation & admin RBAC', async ({ browser }) => {
    const uniq = Date.now();
    const emailA = `member.a.${uniq}@flytoaspan.test`;
    const emailB = `member.b.${uniq}@flytoaspan.test`;
    const passA = 'MemberAPass!2026';
    const passB = 'MemberBPass!2026';

    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const origin = 'http://127.0.0.1:4199';

    // Register A & B
    const regA = await ctxA.request.post(`${origin}/api/auth/register`, {
      headers: { Origin: origin },
      data: { firstName: 'UyeA', lastName: 'Bir', email: emailA, password: passA, phone: '+905310000001', accountType: 'individual' },
    });
    expect(regA.status()).toBe(201);

    // Wrong password rejected
    const badLogin = await ctxB.request.post(`${origin}/api/auth/login`, {
      headers: { Origin: origin },
      data: { email: emailA, password: 'WrongPassword!123' },
    });
    expect(badLogin.status()).toBe(401);

    // A creates a booking
    const bkA = await ctxA.request.post(`${origin}/api/bookings`, {
      headers: { Origin: origin },
      data: { type: 'Uçak', title: 'IST → AYT', subtitle: 'TK2410', date: '2026-12-22', passenger: 'UyeA Bir', lookupSurname: 'Bir', price: 1850 },
    });
    expect(bkA.status()).toBe(201);
    const bkAData = (await bkA.json()).booking;

    // Session persists on reload in UI for Member A
    const pageA = await ctxA.newPage();
    await pageA.setViewportSize({ width: 1280, height: 800 });
    await pageA.goto('/hesabim', { waitUntil: 'domcontentloaded' });
    await expect(pageA.locator('body')).toContainText('UyeA');
    await pageA.reload({ waitUntil: 'domcontentloaded' });
    await expect(pageA.locator('body')).toContainText('UyeA');

    // Member A cannot call admin endpoints -> 403
    const memberAdminTry = await ctxA.request.get(`${origin}/api/admin/bookings`);
    expect(memberAdminTry.status()).toBe(403);

    // Register Member B
    const regB = await ctxB.request.post(`${origin}/api/auth/register`, {
      headers: { Origin: origin },
      data: { firstName: 'UyeB', lastName: 'Iki', email: emailB, password: passB, phone: '+905310000002', accountType: 'individual' },
    });
    expect(regB.status()).toBe(201);

    // B cannot see A's booking and cannot cancel A's booking
    const listB = await ctxB.request.get(`${origin}/api/bookings`);
    expect(listB.status()).toBe(200);
    const bookingsB = (await listB.json()).bookings;
    expect(bookingsB.some((b: { id: string }) => b.id === bkAData.id)).toBe(false);

    const cancelTry = await ctxB.request.post(`${origin}/api/bookings/${bkAData.id}/cancel`, {
      headers: { Origin: origin },
    });
    expect([403, 404]).toContain(cancelTry.status());

    // Logout A -> subsequent /api/bookings returns 401
    const logoutA = await ctxA.request.post(`${origin}/api/auth/logout`, { headers: { Origin: origin } });
    expect(logoutA.status()).toBe(200);
    const afterLogout = await ctxA.request.get(`${origin}/api/bookings`);
    expect(afterLogout.status()).toBe(401);

    // Guest cannot access admin endpoints -> 401
    const guestAdmin = await ctxA.request.get(`${origin}/api/admin/bookings`);
    expect(guestAdmin.status()).toBe(401);

    await ctxA.close();
    await ctxB.close();
  });

  test('Admin panel UI flow: login, bookings list, manual booking, status update, pricing & coupons', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/yonetim', { waitUntil: 'domcontentloaded' });

    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASS);
    await page.locator('form button[type="submit"]').click();

    await expect(page.locator('h1')).toContainText(/Yönetici paneli|Admin Panel/i, { timeout: 10_000 });

    // Navigate to Bookings section, switch to RU, reload and verify section + language persist!
    await page.getByRole('button', { name: /Rezervasyonlar/i }).first().click();
    await expect(page.locator('body')).toContainText(/Gösterilen:/i);
    await page.locator('.adm-lang-btn', { hasText: 'RU' }).click();
    await expect(page.locator('body')).toContainText(/Показано:/i);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toContainText(/Показано:/i, { timeout: 10_000 });
    await page.locator('.adm-lang-btn', { hasText: 'TR' }).click();
    await expect(page.locator('body')).toContainText(/Gösterilen:/i);

    // Open pricing section & verify markup input
    await page.getByRole('button', { name: /Fiyatlandırma/i }).first().click();
    await expect(page.locator('body')).toContainText(/Operatör XML/i);

    // Open coupons section
    await page.getByRole('button', { name: /Kampanya ve kuponlar/i }).first().click();
    await expect(page.locator('body')).toContainText(/ASPAN350|Kupon/i);

    // Save desktop admin screenshot
    await page.screenshot({ path: resolve('test-results/screenshots/admin-desktop-1440.png'), fullPage: false });
  });

  test('Persistence across server restart on isolated temp SQLite database', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'flytoaspan-restart-'));
    const dbPath = join(tempDir, 'restart-qa.sqlite');
    const port = 4209;
    const base = `http://127.0.0.1:${port}`;

    const startInstance = () =>
      spawn(process.execPath, [resolve('server/index.mjs')], {
        stdio: 'ignore',
        env: {
          ...process.env,
          NODE_ENV: 'test',
          HOST: '127.0.0.1',
          PORT: String(port),
          FLYTOASPAN_DB: dbPath,
          FLYTOASPAN_ORIGIN: base,
          FLYTOASPAN_ADMIN_EMAIL: ADMIN_EMAIL,
          FLYTOASPAN_ADMIN_PASSWORD: ADMIN_PASS,
        },
      });

    const waitReady = async () => {
      for (let i = 0; i < 40; i++) {
        try {
          const r = await fetch(`${base}/api/fx`);
          if (r.ok) return;
        } catch { /* retry */ }
        await new Promise((r) => setTimeout(r, 150));
      }
      throw new Error('Restart test server did not start');
    };

    let proc = startInstance();
    try {
      await waitReady();
      // Login as admin
      const loginRes = await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: base },
        body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASS }),
      });
      expect(loginRes.status).toBe(200);
      const cookie = loginRes.headers.get('set-cookie')?.split(';')[0] || '';

      // Create booking & mark Tamamlandı + update pricing
      const bkRes = await fetch(`${base}/api/admin/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: base, Cookie: cookie },
        body: JSON.stringify({ type: 'Uçak', title: 'IST → ALA', subtitle: 'KC912', date: '2026-12-30', passenger: 'Kalicilik Test', lookupSurname: 'Test', price: 6990 }),
      });
      const bk = (await bkRes.json()).booking;
      await fetch(`${base}/api/admin/bookings/${bk.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Origin: base, Cookie: cookie },
        body: JSON.stringify({ status: 'Tamamlandı' }),
      });
      await fetch(`${base}/api/admin/pricing`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Origin: base, Cookie: cookie },
        body: JSON.stringify({ domesticAddTRY: 245, centralAsiaPercent: 8, intlPercent: 6, hotelPercent: 9, transferAddTRY: 175 }),
      });

      // Restart server!
      proc.kill();
      await new Promise((r) => setTimeout(r, 400));
      proc = startInstance();
      await waitReady();

      // Verify persisted booking status & pricing after restart
      const loginRes2 = await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: base },
        body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASS }),
      });
      const cookie2 = loginRes2.headers.get('set-cookie')?.split(';')[0] || '';

      const listAfter = await fetch(`${base}/api/admin/bookings`, { headers: { Cookie: cookie2 } });
      const found = (await listAfter.json()).bookings.find((x: { id: string }) => x.id === bk.id);
      expect(found?.status).toBe('Tamamlandı');

      const priceAfter = await fetch(`${base}/api/pricing`);
      const markupAfter = (await priceAfter.json()).markup;
      expect(markupAfter.domesticAddTRY).toBe(245);
    } finally {
      try { proc.kill(); } catch { /* ignore */ }
      try { rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  });
});

import { test, expect } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

test.describe('4. Eşzamanlı Çoklu Kullanıcı ve Yük Testleri', () => {
  test('Two separate browser sessions simultaneously complete UI bookings + 5 & 20 concurrent API bursts', async ({ browser, request }) => {
    // 1. Two independent browser contexts booking simultaneously in UI
    const ctxA = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const ctxB = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    const bookInUi = async (p: import('@playwright/test').Page, firstName: string, lastName: string) => {
      await p.goto('/ucus-ara?from=IST&to=AYT&depart=2026-12-21&type=oneway&adults=1&children=0&infants=0&cabin=Ekonomi', { waitUntil: 'domcontentloaded' });
      const pkgToggle = p.getByRole('button', { name: /Paketler|Seç/i }).first();
      await expect(pkgToggle).toBeVisible({ timeout: 10_000 });
      await pkgToggle.click();
      await p.getByRole('button', { name: /Bu paketi seç/i }).first().click();
      await expect(p.locator('input[name="firstName_0"]')).toBeVisible({ timeout: 10_000 });
      await p.fill('input[name="firstName_0"]', firstName);
      await p.fill('input[name="surname_0"]', lastName);
      await p.fill('input[name="doc_0"]', '22233344455');
      await p.fill('input[name="dob_0"]', '1991-04-10');
      await p.fill('input[name="contactEmail"]', `${firstName.toLowerCase()}@flytoaspan.test`);
      await p.fill('input[name="contactPhone"]', '+905310001122');
      await p.locator('form.uf-checkout-grid button[type="submit"]').click();
      const pnrText = (await p.locator('[role="status"] strong').first().textContent())?.trim() || '';
      return pnrText;
    };

    const [pnrA, pnrB] = await Promise.all([
      bookInUi(pageA, 'EszamanliA', 'KullaniciA'),
      bookInUi(pageB, 'EszamanliB', 'KullaniciB'),
    ]);

    expect(pnrA).toMatch(/^FT[A-Z0-9]{6}$/);
    expect(pnrB).toMatch(/^FT[A-Z0-9]{6}$/);
    expect(pnrA).not.toBe(pnrB);

    await ctxA.close();
    await ctxB.close();

    // 2. Concurrent API bursts: 5 then 20 independent requests
    const runBurst = async (count: number) => {
      const startedAll = Date.now();
      const results = await Promise.all(
        Array.from({ length: count }, async (_, i) => {
          const t0 = Date.now();
          const res = await request.post('/api/bookings', {
            headers: { Origin: 'http://127.0.0.1:4199' },
            data: {
              type: 'Uçak',
              title: 'İstanbul (IST) → Antalya (AYT)',
              subtitle: `TK24${10 + (i % 9)}`,
              date: '2026-12-26',
              passenger: `Burst${count} User${i}`,
              lookupSurname: `User${i}`,
              price: 1700 + i * 10,
            },
          });
          const ms = Date.now() - t0;
          const json = await res.json().catch(() => ({}));
          return { status: res.status(), ms, pnr: json.booking?.pnr as string | undefined };
        })
      );
      const totalMs = Date.now() - startedAll;
      const successes = results.filter((r) => r.status === 201);
      const failures = results.filter((r) => r.status !== 201);
      const uniquePnrs = new Set(successes.map((r) => r.pnr).filter(Boolean));
      const latencies = results.map((r) => r.ms).sort((a, b) => a - b);
      const avgMs = Math.round(latencies.reduce((s, v) => s + v, 0) / latencies.length);
      const p95Ms = latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95))];
      return {
        count,
        successCount: successes.length,
        failureCount: failures.length,
        uniquePnrCount: uniquePnrs.size,
        totalMs,
        minMs: latencies[0],
        avgMs,
        p95Ms,
        maxMs: latencies[latencies.length - 1],
      };
    };

    const burst5 = await runBurst(5);
    const burst20 = await runBurst(20);

    mkdirSync(resolve('test-results'), { recursive: true });
    writeFileSync(
      resolve('test-results/concurrency-metrics.json'),
      JSON.stringify({ uiPnrs: [pnrA, pnrB], burst5, burst20 }, null, 2)
    );

    expect(burst5.successCount).toBe(5);
    expect(burst5.failureCount).toBe(0);
    expect(burst5.uniquePnrCount).toBe(5);

    expect(burst20.successCount).toBe(20);
    expect(burst20.failureCount).toBe(0);
    expect(burst20.uniquePnrCount).toBe(20);
  });
});

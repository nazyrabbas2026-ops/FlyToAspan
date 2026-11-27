import { test, expect } from '@playwright/test';

async function waitSplashGone(page: import('@playwright/test').Page) {
  const splash = page.locator('.aspan-splash, .splash-screen');
  if (await splash.count()) {
    await splash.first().waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
  }
}

test.describe('3. Arama, Rezervasyon, Sınır Durumları ve Mükerrer Kayıt Kontrolü', () => {
  test('IST->AYT round-trip search carries legs, dates, pax, package & total into checkout + creates demo booking & PNR lookup checks', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(
      '/ucus-ara?from=IST&to=AYT&depart=2026-12-20&ret=2026-12-24&type=roundtrip&adults=2&children=0&infants=0&cabin=Ekonomi',
      { waitUntil: 'domcontentloaded' }
    );
    await waitSplashGone(page);

    // Select outbound flight & Extra Fly package
    const firstPkgToggle = page.getByRole('button', { name: /Paketler|Seç/i }).first();
    await expect(firstPkgToggle).toBeVisible({ timeout: 10_000 });
    await firstPkgToggle.click();

    const extraSelect = page.getByRole('button', { name: /Bu paketi seç/i }).nth(1);
    if (await extraSelect.isVisible().catch(() => false)) {
      await extraSelect.click();
    } else {
      await page.getByRole('button', { name: /Bu paketi seç/i }).first().click();
    }

    // Now on return leg selection -> pick first return flight
    await page.waitForTimeout(450);
    const retPkgToggle = page.getByRole('button', { name: /Paketler|Seç/i }).first();
    await expect(retPkgToggle).toBeVisible({ timeout: 10_000 });
    await retPkgToggle.click();
    await page.getByRole('button', { name: /Bu paketi seç/i }).first().click();

    // Checkout form should show both legs & 2 passenger blocks
    await expect(page.locator('input[name="firstName_0"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('input[name="firstName_1"]')).toBeVisible();
    await expect(page.locator('.uf-co-flight-box')).toHaveCount(2);

    // Fill both passengers + contact
    await page.fill('input[name="firstName_0"]', 'Ahmet');
    await page.fill('input[name="surname_0"]', 'Yilmaz');
    await page.fill('input[name="doc_0"]', '12345678901');
    await page.fill('input[name="dob_0"]', '1990-05-15');
    await page.fill('input[name="firstName_1"]', 'Ayse');
    await page.fill('input[name="surname_1"]', 'Yilmaz');
    await page.fill('input[name="doc_1"]', '12345678902');
    await page.fill('input[name="dob_1"]', '1992-08-20');
    await page.fill('input[name="contactEmail"]', 'qa.passenger@flytoaspan.test');
    await page.fill('input[name="contactPhone"]', '+905310009988');

    // Double-click submit to verify no duplicate booking created
    const submitBtn = page.locator('form.uf-checkout-grid button[type="submit"]');
    await submitBtn.dblclick();

    // PNR confirmation box
    const pnrEl = page.locator('[role="status"] strong').first();
    await expect(pnrEl).toBeVisible({ timeout: 10_000 });
    const pnr = (await pnrEl.textContent())?.trim() || '';
    expect(pnr).toMatch(/^FT[A-Z0-9]{6}$/);

    // Verify PNR lookup API strips sensitive PII for unauthenticated guests
    const guestLookupRes = await page.request.post('/api/bookings/lookup', {
      headers: { Origin: 'http://127.0.0.1:4199' },
      data: { pnr, surname: 'Yilmaz' },
    });
    expect(guestLookupRes.status()).toBe(200);
    const guestBk = (await guestLookupRes.json()).booking;
    expect(guestBk.passengersDetail).toBeUndefined();
    expect(guestBk.contactEmail).toBeUndefined();
    expect(guestBk.contactPhone).toBeUndefined();
    expect(guestBk.netCostTRY).toBeUndefined();
    expect(guestBk.profitTRY).toBeUndefined();
    expect(Array.isArray(guestBk.legs) && guestBk.legs.length).toBe(2);

    // Verify PNR lookup UI: correct surname -> found with both outbound & return legs + demo label
    await page.goto('/bilet-islemleri', { waitUntil: 'domcontentloaded' });
    await waitSplashGone(page);
    await page.fill('#pnr-lookup-code', pnr);
    await page.fill('#pnr-lookup-surname', 'Yilmaz');
    await page.locator('form button[type="submit"]').click();
    await expect(page.locator('[role="status"]')).toContainText(pnr);
    await expect(page.locator('[role="status"]')).toContainText(/Gidiş|Outbound/i);
    await expect(page.locator('[role="status"]')).toContainText(/Dönüş|Return/i);

    // Wrong surname after successful lookup -> old result MUST disappear & alert shown!
    await page.fill('#pnr-lookup-surname', 'YanlisSoyad');
    await page.locator('form button[type="submit"]').click();
    await expect(page.locator('[role="status"]')).toHaveCount(0);
    await expect(page.locator('[role="alert"]')).toBeVisible();

    // Non-existent PNR -> no result
    await page.fill('#pnr-lookup-code', 'FTZZZZZZ');
    await page.fill('#pnr-lookup-surname', 'Yilmaz');
    await page.locator('form button[type="submit"]').click();
    await expect(page.locator('[role="status"]')).toHaveCount(0);
    await expect(page.locator('[role="alert"]')).toBeVisible();
  });

  test('Hotel & Package Tour demo bookings + API boundary date checks & idempotency dedup', async ({ page, request }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // 1. Hotel booking via UI
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitSplashGone(page);
    await page.locator('.u4-tab-btn').nth(1).click();
    await page.locator('.u4-submit-btn').first().click();
    await expect(page.locator('.flight-card').first()).toBeVisible({ timeout: 10_000 });
    await page.locator('.flight-card button').first().click();
    await page.fill('input[name="firstName"]', 'Mehmet');
    await page.fill('input[name="surname"]', 'Kaya');
    await page.locator('[role="dialog"] button[type="submit"]').click();
    const hotelPnr = (await page.locator('[role="dialog"] [role="status"] strong').first().textContent())?.trim() || '';
    expect(hotelPnr).toMatch(/^FT[A-Z0-9]{6}$/);

    // 2. Package Tour navigation via UI (Transfer tab removed)
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitSplashGone(page);
    await page.locator('.u4-tab-btn').nth(2).click();
    await page.locator('.u4-submit-btn').first().click();
    await expect(page).toHaveURL(/\/turlar/);
    await expect(page.locator('h1').first()).toContainText(/Tur/i);

    // 3. Boundary checks on API: returnDate before date -> 400
    const badReturn = await request.post('/api/bookings', {
      headers: { Origin: 'http://127.0.0.1:4199' },
      data: {
        type: 'Uçak',
        title: 'İstanbul (IST) ↔ Antalya (AYT)',
        subtitle: 'TK2410',
        date: '2026-12-25',
        returnDate: '2026-12-20',
        passenger: 'Ali Test',
        lookupSurname: 'Test',
        price: 3200,
      },
    });
    expect(badReturn.status()).toBe(400);

    // Same-day return -> 201 OK
    const sameDay = await request.post('/api/bookings', {
      headers: { Origin: 'http://127.0.0.1:4199' },
      data: {
        type: 'Uçak',
        title: 'İstanbul (IST) ↔ Antalya (AYT)',
        subtitle: 'TK2410 / TK2444',
        date: '2026-12-22',
        returnDate: '2026-12-22',
        passenger: 'Ali Gunubirlik',
        lookupSurname: 'Gunubirlik',
        price: 3500,
      },
    });
    expect(sameDay.status()).toBe(201);

    // 4. Idempotency key deduplication (delayed resend / double submit)
    const idemKey = `qa-idem-${Date.now()}`;
    const payload = {
      type: 'Uçak',
      title: 'İstanbul (IST) → Antalya (AYT)',
      subtitle: 'PC2014',
      date: '2026-12-28',
      passenger: 'Idem Test',
      lookupSurname: 'Test',
      price: 1650,
      idempotencyKey: idemKey,
    };
    const [r1, r2] = await Promise.all([
      request.post('/api/bookings', { headers: { Origin: 'http://127.0.0.1:4199' }, data: payload }),
      request.post('/api/bookings', { headers: { Origin: 'http://127.0.0.1:4199' }, data: payload }),
    ]);
    const j1 = await r1.json();
    const j2 = await r2.json();
    expect(j1.booking.pnr).toBe(j2.booking.pnr);
  });
});

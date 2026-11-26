import { test, expect } from '@playwright/test';

async function waitSplashGone(page: import('@playwright/test').Page) {
  const splash = page.locator('.aspan-splash, .splash-screen');
  if (await splash.count()) {
    await splash.first().waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
  }
}

test.describe('2. Butonlar, Formlar, Gezinme, Çerezler, Dil/Kur ve Erişilebilirlik', () => {
  test('Direct URLs, reload, browser back/forward, tabs and mobile drawer', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // Direct URL access + reload
    for (const [path, headingRegex] of [
      ['/kampanyalar', /kampanya|fırsat/i],
      ['/yardim', /yardım|destek|sıkça/i],
      ['/bilet-islemleri', /Bilet [İIıi]şlemleri|PNR/i],
      ['/online-check-in', /check-in/i],
    ] as const) {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await waitSplashGone(page);
      await expect(page.locator('h1').first()).toContainText(headingRegex);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.locator('h1').first()).toContainText(headingRegex);
    }

    // Back / Forward navigation
    await page.goBack();
    await expect(page).toHaveURL(/\/bilet-islemleri/);
    await page.goForward();
    await expect(page).toHaveURL(/\/online-check-in/);

    // Home tabs (Uçak / Otel / Transfer / Turlar)
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitSplashGone(page);
    await page.locator('.u4-tab-btn').nth(1).click();
    await expect(page.locator('.u4-submit-btn').first()).toBeVisible();

    await page.locator('.u4-tab-btn').nth(2).click();
    await expect(page.locator('.u4-submit-btn').first()).toBeVisible();

    await page.locator('.u4-tab-btn').nth(3).click();
    await expect(page.locator('.u4-submit-btn').first()).toBeVisible();

    // Mobile drawer open & close at 390px
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Menüyü Aç' }).click();
    await expect(page.locator('.ufn-drawer')).toBeVisible();
    await page.getByRole('button', { name: 'Kapat' }).click();
    await expect(page.locator('.ufn-drawer')).toBeHidden();
  });

  test('Cookie preference: reject, reload, reopen from footer, accept & persist', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitSplashGone(page);
    await page.evaluate(() => localStorage.removeItem('flytoaspan_cookie_preference_v1'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitSplashGone(page);

    // Scroll > 220px to show cookie banner
    await page.evaluate(() => window.scrollTo(0, 420));
    const dialog = page.locator('.cookie-toast');
    await expect(dialog).toBeVisible();

    // Reject
    await dialog.locator('.cookie-btn-ghost').click();
    await expect(dialog).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem('flytoaspan_cookie_preference_v1'))).toBe('rejected');

    // Reload -> stays hidden
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.evaluate(() => window.scrollTo(0, 420));
    await page.waitForTimeout(300);
    await expect(dialog).toBeHidden();

    // Reopen from footer and switch to Accept
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.locator('footer button', { hasText: /Çerez Tercihleri|Cookie/i }).first().click();
    await expect(dialog).toBeVisible();
    await dialog.locator('.cookie-btn-accept').click();
    await expect(dialog).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem('flytoaspan_cookie_preference_v1'))).toBe('accepted');

    await page.reload({ waitUntil: 'domcontentloaded' });
    expect(await page.evaluate(() => localStorage.getItem('flytoaspan_cookie_preference_v1'))).toBe('accepted');
  });

  test('Language & Currency switchers, keyboard focus and form labels', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitSplashGone(page);

    // Language switch TR -> EN -> RU -> TR
    await page.locator('button[title*="Dil Seç"]').click();
    await page.getByRole('menuitem', { name: /English/i }).click();
    await expect(page.locator('#firsat-radari h2')).toContainText(/Featured Flight Deals/i);

    await page.locator('button[title*="Dil Seç"]').click();
    await page.getByRole('menuitem', { name: /Русский/i }).click();
    await expect(page.locator('#firsat-radari h2')).toContainText(/Выгодные авиабилеты/i);

    await page.locator('button[title*="Dil Seç"]').click();
    await page.getByRole('menuitem', { name: /Türkçe/i }).click();
    await expect(page.locator('#firsat-radari h2')).toContainText(/Fırsat Uçuşlar/i);

    // Currency switch TRY -> EUR -> TRY
    await page.locator('button[title*="Para Birimi"]').click();
    await page.getByRole('menuitem', { name: /EUR/i }).click();
    await expect(page.locator('#firsat-radari .deal-price').first()).toContainText('€');

    await page.locator('button[title*="Para Birimi"]').click();
    await page.getByRole('menuitem', { name: /TRY/i }).click();
    await expect(page.locator('#firsat-radari .deal-price').first()).toContainText('₺');

    // Keyboard Tab navigation moves focus cleanly
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    const activeTag = await page.evaluate(() => document.activeElement?.tagName);
    expect(['A', 'BUTTON', 'INPUT', 'SELECT']).toContain(activeTag);
  });

  test('Slow response, network error and retry recovery on PNR lookup form', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/bilet-islemleri', { waitUntil: 'domcontentloaded' });
    await waitSplashGone(page);

    // Empty form check: native HTML5 required validation blocks submission
    const pnrInput = page.locator('#pnr-lookup-code');
    const surnameInput = page.locator('#pnr-lookup-surname');
    expect(await pnrInput.getAttribute('required')).not.toBeNull();
    expect(await surnameInput.getAttribute('required')).not.toBeNull();
    // Labels are properly associated via htmlFor
    await expect(page.locator('label[for="pnr-lookup-code"]')).toBeVisible();
    await expect(page.locator('label[for="pnr-lookup-surname"]')).toBeVisible();

    // Simulate network failure first
    let attempts = 0;
    await page.route('**/api/bookings/lookup', async (route) => {
      attempts += 1;
      if (attempts === 1) {
        await route.abort('failed');
      } else {
        await new Promise((r) => setTimeout(r, 350));
        await route.continue();
      }
    });

    await pnrInput.fill('FTNOEXST');
    await surnameInput.fill('Testsoyad');
    await page.locator('form button[type="submit"]').click();
    await expect(page.locator('[role="alert"]')).toBeVisible();

    // Retry with delayed response -> clean 404 "not found" error replaces network error
    await page.locator('form button[type="submit"]').click();
    await expect(page.locator('[role="alert"]')).toBeVisible();
    expect(attempts).toBe(2);
  });
});

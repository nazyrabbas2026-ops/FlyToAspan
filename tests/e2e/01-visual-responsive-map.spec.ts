import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const SCREENSHOT_DIR = resolve('test-results/screenshots');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const VIEWPORTS = [
  { name: 'mobile-320', width: 320, height: 667 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'tablet-portrait-768', width: 768, height: 1024 },
  { name: 'tablet-landscape-1024', width: 1024, height: 768 },
  { name: 'desktop-1280', width: 1280, height: 800 },
  { name: 'desktop-1440', width: 1440, height: 900 },
];

const PUBLIC_PAGES = [
  { key: 'home', path: '/' },
  { key: 'flights', path: '/ucus-ara?from=IST&to=AYT&depart=2026-12-20&type=oneway&adults=1&children=0&infants=0&cabin=Ekonomi' },
  { key: 'campaigns', path: '/kampanyalar' },
  { key: 'help', path: '/yardim' },
  { key: 'booking-ops', path: '/bilet-islemleri' },
];

async function waitSplashGone(page: import('@playwright/test').Page) {
  await page.waitForTimeout(300);
  // Dismiss splash screen if present by waiting briefly for it to fade or skipping
  const splash = page.locator('.aspan-splash, .splash-screen');
  if (await splash.count()) {
    await splash.first().waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
  }
}

test.describe('1. Görünüm, Ekran Uyumu ve Harita Animasyonu', () => {
  for (const vp of VIEWPORTS) {
    test(`Responsive layout & overflow check @ ${vp.name} (${vp.width}x${vp.height})`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      for (const p of PUBLIC_PAGES) {
        await page.goto(p.path, { waitUntil: 'domcontentloaded' });
        await waitSplashGone(page);
        await page.waitForTimeout(350);

        const metrics = await page.evaluate(() => {
          const doc = document.documentElement;
          const overflowX = doc.scrollWidth - doc.clientWidth;
          const imgs = Array.from(document.querySelectorAll('img')).filter((img) => {
            const style = window.getComputedStyle(img);
            return style.display !== 'none' && style.visibility !== 'hidden' && img.offsetParent !== null;
          });
          const brokenImgs = imgs
            .filter((img) => img.complete && img.naturalWidth === 0)
            .map((img) => img.getAttribute('src') || img.alt);

          const logo = document.querySelector('header img');
          const logoRect = logo?.getBoundingClientRect();
          const logoVisible = Boolean(logoRect && logoRect.width > 20 && logoRect.height > 12);

          // Check if fixed floating buttons cover primary submit buttons
          const floats = Array.from(document.querySelectorAll('.floating-actions, .wa-float, .scroll-top-btn'))
            .map((el) => el.getBoundingClientRect())
            .filter((r) => r.width > 0 && r.height > 0);
          const submitBtn = document.querySelector<HTMLElement>('.u4-submit-btn, button[type="submit"]');
          let coveredSubmit = false;
          if (submitBtn && floats.length > 0) {
            const sr = submitBtn.getBoundingClientRect();
            if (sr.width > 0 && sr.height > 0 && sr.top >= 0 && sr.bottom <= window.innerHeight) {
              for (const fr of floats) {
                const overlapX = Math.max(0, Math.min(sr.right, fr.right) - Math.max(sr.left, fr.left));
                const overlapY = Math.max(0, Math.min(sr.bottom, fr.bottom) - Math.max(sr.top, fr.top));
                if (overlapX * overlapY > (sr.width * sr.height) * 0.25) coveredSubmit = true;
              }
            }
          }

          return {
            overflowX,
            scrollWidth: doc.scrollWidth,
            clientWidth: doc.clientWidth,
            brokenImgs,
            logoVisible,
            coveredSubmit,
          };
        });

        expect.soft(
          metrics.overflowX,
          `${p.key} @ ${vp.name} horizontal overflow: scrollWidth=${metrics.scrollWidth}, clientWidth=${metrics.clientWidth}`
        ).toBeLessThanOrEqual(2);
        expect.soft(metrics.brokenImgs, `${p.key} @ ${vp.name} broken images`).toEqual([]);
        expect.soft(metrics.logoVisible, `${p.key} @ ${vp.name} header logo visible`).toBe(true);
        expect.soft(metrics.coveredSubmit, `${p.key} @ ${vp.name} submit button covered by floating CTA`).toBe(false);

        // Save key screenshots in chrome project for visual inspection
        if (testInfo.project.name === 'chrome' && ['mobile-320', 'mobile-390', 'tablet-portrait-768', 'desktop-1440'].includes(vp.name) && ['home', 'flights', 'booking-ops'].includes(p.key)) {
          await page.screenshot({
            path: resolve(SCREENSHOT_DIR, `${p.key}-${vp.name}.png`),
            fullPage: false,
          });
        }
      }
    });
  }

  test('Hero flight map: planes follow routes, airport markers non-clickable, animation advances & freezes cleanly', async ({ page }) => {
    // 1. Freeze frame check with reduced motion
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitSplashGone(page);

    const mapInfo = await page.evaluate(() => {
      const container = document.querySelector<HTMLElement>('.hero-geo-map');
      const svg = container?.querySelector('svg');
      const animateMotions = svg ? Array.from(svg.querySelectorAll('animateMotion')) : [];
      const mpaths = animateMotions.filter((am) => am.querySelector('mpath') || am.getAttribute('path'));
      const style = container ? window.getComputedStyle(container) : null;
      return {
        exists: Boolean(container && svg),
        ariaHidden: container?.getAttribute('aria-hidden'),
        pointerEvents: style?.pointerEvents,
        motionCount: animateMotions.length,
        validPathCount: mpaths.length,
        rect: container?.getBoundingClientRect().toJSON() ?? null,
      };
    });

    expect(mapInfo.exists).toBe(true);
    expect(mapInfo.ariaHidden).toBe('true');
    expect(mapInfo.pointerEvents).toBe('none');
    expect(mapInfo.motionCount).toBeGreaterThan(0);
    expect(mapInfo.validPathCount).toBe(mapInfo.motionCount);

    // Pause SVG animations for deterministic frozen frame check
    await page.evaluate(() => {
      const svg = document.querySelector<SVGSVGElement>('.hero-geo-map svg');
      svg?.pauseAnimations?.();
    });
    const urlBefore = page.url();
    await page.mouse.click(720, 260);
    await page.waitForTimeout(200);
    expect(page.url()).toBe(urlBefore);

    // 2. Active animation check with normal motion
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitSplashGone(page);
    const t1 = await page.evaluate(() => {
      const svg = document.querySelector<SVGSVGElement>('.hero-geo-map svg');
      return svg?.getCurrentTime ? svg.getCurrentTime() : 0;
    });
    await page.waitForTimeout(550);
    const t2 = await page.evaluate(() => {
      const svg = document.querySelector<SVGSVGElement>('.hero-geo-map svg');
      return svg?.getCurrentTime ? svg.getCurrentTime() : 0;
    });
    expect(t2).toBeGreaterThan(t1);

    // 3. Small screen (320px) map rendering check
    await page.setViewportSize({ width: 320, height: 667 });
    await page.waitForTimeout(200);
    const smallMapOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(smallMapOverflow).toBeLessThanOrEqual(2);
  });
});

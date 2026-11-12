// Browser journeys for the fictional family, run against the built dist/ folder (see playwright.demo.config.ts).
import { test, expect } from '@playwright/test';
import { demoBase } from '../../scripts/demo-base.mjs';
import { DEMO_CSP } from '../demo-csp.mjs';
const banner = 'Demo with a fictional family';
const REPO = 'https://github.com/waldo-van-der-code/ancestry-demo';
// The banner link must say plainly that it leads to a public GitHub repo you can copy.
const repoLink = (page: import('@playwright/test').Page, lang: 'en' | 'nl') =>
  page.getByRole('link', { name: lang === 'en' ? 'Copy this site: the code is public on GitHub' : 'Kopieer deze site: de code staat publiek op GitHub' });
const base = demoBase(process.env.DEMO_BASE);
const at = (path: string) => base + path;

test('strict CSP permits local fonts and map without third-party dependencies', async ({ page, baseURL }, info) => {
  const errors: string[] = [], foreign: string[] = [], missing: string[] = [], violations: string[] = [];
  const fontRequests = new Set<string>();
  const tileHosts = new Set(['tile.openstreetmap.org', 'geo.api.vlaanderen.be', 'geoserver-bigdata.nieuwland.nl']);
  const origin = new URL(baseURL!).origin;
  await page.exposeFunction('__recordDemoCspViolation', (message: string) => violations.push(message));
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', e => {
      (window as any).__recordDemoCspViolation(`${e.effectiveDirective}: ${e.blockedURI}`);
    });
  });
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  page.on('request', r => {
    const u = new URL(r.url());
    const local = u.origin === origin;
    if (u.protocol !== 'data:' && !local && !(r.resourceType() === 'image' && tileHosts.has(u.hostname))) foreign.push(r.url());
    if (local && r.resourceType() === 'font') fontRequests.add(u.pathname);
  });
  page.on('response', r => { if (r.status() >= 400) missing.push(`${r.status()}: ${r.url()}`); });
  for (const route of ['/en/', '/en/person/jan-van-aliquam/', '/en/map/', '/en/fun-facts/']) {
    const response = await page.goto(at(route));
    expect(response?.headers()['content-security-policy']).toBe(DEMO_CSP);
    await page.evaluate(() => document.fonts.ready);
    // Flush policy events before testing map initialization (a blocked Leaflet script otherwise masks the cause).
    expect(violations, route).toEqual([]);
    if (route === '/en/map/') {
      await expect(page.locator('#map')).toHaveAttribute('data-markers', /^[1-9]\d*$/);
      await page.locator('.leaflet-interactive').first().click();
      await expect(page.locator('.leaflet-popup')).toBeVisible();
      const icons = await page.evaluate(async () => {
        const icon = new (window as any).L.Icon.Default();
        const images: HTMLImageElement[] = [icon.createIcon(), icon.createShadow()];
        document.body.append(...images);
        try {
          await Promise.all(images.map(image => image.decode()));
          return images.map(image => new URL(image.src).pathname);
        } finally { images.forEach(image => image.remove()); }
      });
      expect(icons.every(path => path.startsWith(at('/vendor/leaflet/images/')))).toBe(true);
      await page.screenshot({ path: info.outputPath('demo-csp-map.png'), fullPage: true });
    }
  }
  expect(fontRequests.size, 'Actual self-hosted font requests').toBeGreaterThan(0);
  expect([...fontRequests].every(path => path.startsWith(at('/vendor/fonts/')))).toBe(true);
  for (const name of ['fraunces-', 'source-serif-4-']) expect([...fontRequests].some(path => path.includes(name))).toBe(true);
  expect(foreign).toEqual([]);
  expect(missing).toEqual([]);
  expect(errors).toEqual([]);
  expect(violations).toEqual([]);
});

test('demo routes, links and requests stay inside the mount and every page is noindex', async ({ page, request, baseURL }) => {
  const escaped: string[] = [], missing: string[] = [];
  const origin = new URL(baseURL!).origin;
  page.on('request', r => {
    const u = new URL(r.url());
    if (u.origin === origin && !u.pathname.startsWith(base + '/')) escaped.push(u.pathname);
  });
  page.on('response', r => { if (r.status() === 404) missing.push(r.url()); });
  for (const route of ['/en/', '/en/person/jan-van-aliquam/', '/en/map/', '/en/fun-facts/', '/en/story/', '/nl/']) {
    const response = await page.goto(at(route));
    expect(response?.status(), route).toBe(200);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
    if (route === '/en/') await expect(page.locator('.tree svg .n').first()).toBeVisible();
    if (route === '/en/map/') {
      await expect(page.locator('#map')).toHaveAttribute('data-markers', /^[1-9]\d*$/);
      await page.locator('.leaflet-interactive').first().click();
    }
    if (route === '/en/fun-facts/') await expect(page.locator('#in-numbers svg').first()).toBeVisible();
    const links = await page.locator('a[href], link[href], script[src], img[src]').evaluateAll(elements => elements.map(e => e.getAttribute('href') || e.getAttribute('src') || ''));
    for (const href of links) {
      const u = new URL(href, page.url());
      if (u.origin !== origin) continue; // fictional evidence and external font/map services have their own hosts
      expect(u.pathname.startsWith(base + '/'), `${route}: ${href}`).toBe(true);
      expect((await request.get(u.href)).status(), href).toBe(200);
    }
    const configs = await page.locator('script[type="application/json"]').allTextContents();
    for (const raw of configs) {
      const d = JSON.parse(raw);
      if (d?.personPath) expect(d.personPath).toBe(at(route.startsWith('/nl/') ? '/nl/persoon/' : '/en/person/'));
    }
  }
  // Both redirect documents must carry robots metadata before the browser follows the redirect.
  for (const route of ['/', '/kaart/']) {
    const response = await request.get(at(route));
    expect(response.status()).toBe(200);
    expect(await response.text()).toMatch(/<meta name="robots" content="noindex, nofollow"/);
  }
  await page.goto(at('/'));
  await expect(page).toHaveURL(new RegExp(`${base}/en/$`));
  await page.goto(at('/kaart/'));
  await expect(page).toHaveURL(new RegExp(`${base}/nl/kaart/$`));
  expect(escaped).toEqual([]);
  expect(missing).toEqual([]);
});

test('tree expands, opens a person, and switches language', async ({ page }, info) => {
  const forbidden: string[] = [];
  page.on('request', r => { if (/\/api\/|analytics/i.test(r.url())) forbidden.push(r.url()); });
  await page.goto(at('/en/'));
  await expect(page.getByText(banner)).toBeVisible();
  await expect(repoLink(page, 'en')).toHaveAttribute('href', REPO);
  await expect(page.locator('.tree svg .n').first()).toBeVisible();
  const initial = await page.locator('.tree svg .n').count();
  await page.getByRole('button', { name: 'Expand all', exact: true }).click();
  await expect.poll(() => page.locator('.tree svg .n').count()).toBeGreaterThan(initial);
  await page.screenshot({ path: info.outputPath('demo-tree.png'), fullPage: true });
  await page.locator(`.start a[href="${at("/en/person/jan-van-aliquam/")}"]`).first().click();
  await expect(page.locator('h1')).toContainText('Jan Van Aliquam');
  await page.getByRole('link', { name: 'NL', exact: true }).click();
  await expect(page).toHaveURL(/\/nl\/persoon\/jan-van-aliquam\//);
  await expect(page.getByText('Demo met een verzonnen familie')).toBeVisible();
  await expect(repoLink(page, 'nl')).toHaveAttribute('href', REPO);
  expect(forbidden).toEqual([]);
});

test('people search narrows the list and links to a fictional person', async ({ page }) => {
  await page.goto(at('/en/people/'));
  await page.locator('#q').fill('georges van nemo');
  await expect(page.locator('#list li:visible')).toHaveCount(1);
  await page.locator('#list li:visible a').click();
  await expect(page.locator('h1')).toHaveText('Georges Van Nemo');
  await expect(page.locator('.press')).toContainText('Sluis says goodbye');
});

test('record conflict stays visible and a possible record is not accepted', async ({ page }) => {
  await page.goto(at('/en/person/jan-van-aliquam/'));
  await expect(page.locator('dl.facts').first()).toContainText('14 March 1854');
  await expect(page.locator('.records')).toContainText('12 March 1854');
  await expect(page.locator('.records')).toContainText('14 March 1854');
  await page.goto(at('/en/person/felix-dolorsit/'));
  await expect(page.locator('dl.facts').first()).not.toContainText('1919');
  await expect(page.locator('.records')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Possible record (fictional, not accepted)' })).toBeVisible();
});

test('living people have no dates or personal facts', async ({ page }) => {
  await page.goto(at('/en/person/lisa-van-nemo/'));
  await expect(page.locator('h1')).toHaveText('Lisa Van Nemo');
  await expect(page.locator('main')).not.toContainText('1972');
  await expect(page.locator('main')).not.toContainText('Detroit');
  await expect(page.locator('form, audio, .gallery, .src')).toHaveCount(0);
});

test('map shows fictional people and responds to filters', async ({ page }, info) => {
  await page.goto(at('/en/map/'));
  await expect(page.locator('#map')).toHaveAttribute('data-markers', /^[1-9]\d*$/);
  await page.locator('.leaflet-interactive').first().click();
  await expect(page.locator('.leaflet-popup')).toBeVisible();
  await page.locator('input[name="l"]').check();
  await expect(page.locator('#map')).toHaveAttribute('data-markers', '0');
  await page.locator('input[name="l"]').uncheck();
  await expect(page.locator('#map')).toHaveAttribute('data-markers', /^[1-9]\d*$/);
  await page.screenshot({ path: info.outputPath('demo-map.png'), fullPage: true });
});

test('fun facts render all views and story and sources are reachable', async ({ page }, info) => {
  await page.goto(at('/en/fun-facts/'));
  await expect(page.locator('h1')).toHaveText('Fun facts');
  await expect(page.locator('#in-numbers svg').first()).toBeVisible();
  await page.locator('.jump a[href="#names"]').click();
  await expect(page.locator('#names')).toBeVisible();
  await page.screenshot({ path: info.outputPath('demo-facts.png'), fullPage: true });
  await page.goto(at('/en/story/'));
  await expect(page.locator('.prose')).toContainText('A life along the canal');
  await page.goto(at('/en/sources/'));
  await expect(page.locator('main')).toContainText('Civil registers of Sluis (fictional)');
  await expect(page.locator('main')).toContainText('example.org');
});

test('all main pages fit a narrow viewport', async ({ page }) => {
  for (const url of ['/en/', '/en/person/jan-van-aliquam/', '/en/people/', '/en/story/', '/en/map/', '/en/fun-facts/', '/en/sources/']) {
    await page.goto(at(url));
    await expect(repoLink(page, 'en')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), url).toBe(true);
  }
});

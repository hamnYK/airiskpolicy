'use strict';
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const path = require('node:path'), fs = require('node:fs'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
(async () => {
  const server = spawn(process.execPath, ['server.cjs', '--dist'], { cwd: root, env: { ...process.env, PORT: '4197' }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let browser;
  try {
    await new Promise((resolve, reject) => { server.stdout.once('data', resolve); server.once('error', reject); });
    browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
    fs.mkdirSync(path.join(root, 'output'), { recursive: true });
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    const base = 'http://127.0.0.1:4197/';
    async function bounds(scope) {
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'No document overflow');
      const violations = await page.locator(scope).evaluateAll(elements => elements.filter(el => el.getClientRects().length && !el.disabled).flatMap(el => {
        const rect = el.getBoundingClientRect(), css = getComputedStyle(el);
        return rect.height < 43.9 || parseFloat(css.fontSize) < 14 ? [{ text: el.textContent.trim().slice(0, 45), height: rect.height, font: css.fontSize }] : [];
      }));
      assert.deepEqual(violations, [], 'Minimum 44px targets and 14px UI text');
    }
    for (const width of [1280, 412, 390, 320]) {
      await page.setViewportSize({ width, height: width === 412 ? 914 : 900 });
      await page.goto(base + 'design-system.html');
      await bounds('button,a,input,select,textarea,summary');
      await page.locator('#ds-open-dialog').click();
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#ds-example-dialog').evaluate(el => el.open), true);
      await page.locator('#ds-close-dialog').click();
      assert.equal(await page.locator('#ds-open-dialog').evaluate(el => el === document.activeElement), true);
      await page.locator('#gap-pattern').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(root, `output/design-system-${width}.png`) });
      await page.goto(base + 'admin/login.html');
      await bounds('button,a,input');
      assert.equal(await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(8, 19, 31)');
      assert.ok(await page.locator('body').evaluate(el => getComputedStyle(el).fontFamily.includes('Pretendard')));
      await page.screenshot({ path: path.join(root, `output/admin-login-${width}.png`) });
    }
    await page.route('**/Cesium.js*', route => route.abort());
    await page.route('https://**/*', route => route.abort());
    for (const width of [1280, 412, 390, 320]) {
      await page.setViewportSize({width,height:width===412?914:900});
      await page.goto(base);
      await page.waitForFunction(() => document.body.dataset.countryInitialized === 'true');
      await bounds('#observatory button,#observatory a');
      await page.screenshot({path:path.join(root, 'output/public-system-'+width+'.png')});
    }
    // Exercise actual production styles and analyzer scripts with captured classification inputs.
    await page.goto(base + 'design-system.html');
    await page.setContent('<html lang="ko"><body><div id="observatory"></div><div id="policy-panel"></div><div id="risk-state"></div><div id="policy-state"></div></body></html>');
    for (const file of ['typography.css', 'design-system.css', 'gap-analyzer.css']) await page.addStyleTag({ path: path.join(root, file) });
    const fixture = require('./fixtures/kor-principles-20261005.json'), ontology = require('../supabase/seeds/oecd-principle-crosswalk.json');
    await page.evaluate(({ fixture, ontology }) => {
      window.aiRiskOntologyState = { status: 'ready', data: ontology, reload() {} };
      window.aiRiskPolicy = { snapshot: () => fixture.policy, openRecord() {} };
    }, { fixture, ontology });
    for (const file of ['ontology-model.js', 'gap-engine.js', 'gap-analyzer.js']) await page.addScriptTag({ path: path.join(root, file) });
    await page.evaluate(fixture => {
      fixture.risk.records.forEach((r, i) => { r.title = '위험 기록의 전체 제목 · Full title of a risk record ' + (i + 1); r.date = '2026-10-05'; });
      document.dispatchEvent(new CustomEvent('gis:country-selected', { detail: { code: 'KOR' } }));
      document.dispatchEvent(new CustomEvent('aim:loaded', { detail: fixture.risk }));
    }, fixture);
    for (const width of [1280, 412, 390, 320]) for (const lang of ['ko', 'en']) {
      await page.setViewportSize({ width, height: width === 412 ? 914 : 900 });
      await page.evaluate(lang => document.documentElement.lang = lang, lang);
      await page.locator('.gap-list').waitFor();
      await bounds('.gap-analyzer button,.gap-analyzer a,.gap-analyzer select,.gap-analyzer summary');
      await page.locator('.gap-row').first().click();
      await bounds('.gap-analyzer button,.gap-analyzer a,.gap-analyzer select,.gap-analyzer summary');
      await page.locator('.gap-list').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(root, `output/gap-system-${lang}-${width}.png`) });
    }
    await page.evaluate(() => { window.aiRiskOntologyState.data = { schemaVersion: 1, concepts: [], relations: [], bindings: [] }; document.dispatchEvent(new Event('ontology:changed')); });
    assert.equal(await page.locator('.gap-metrics').count(), 0);
    await page.evaluate(() => { window.aiRiskOntologyState.status = 'error'; document.dispatchEvent(new Event('ontology:changed')); });
    assert.equal(await page.locator('.gap-metrics').count(), 0);
    assert.deepEqual(errors, []);
    console.log('PASS design system: reference/login/analyzer, KO/EN, 320/390/412/1280, targets/fonts/overflow, dialog focus, empty/error states.');
  } finally { if (browser) await browser.close(); server.kill(); }
})().catch(e => { console.error(e); process.exitCode = 1; });

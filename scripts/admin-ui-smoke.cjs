'use strict';
// Local browser test. Supabase requests are intercepted; no live account is used.
const { chromium } = require('playwright');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
(async () => {
  const port = await new Promise(resolve => { const s = require('node:net').createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); }); });
  const server = spawn(process.execPath, ['server.cjs', '--dist'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let browser;
  try {
    await new Promise((resolve, reject) => { server.stdout.once('data', resolve); server.once('error', reject); server.once('exit', code => reject(Error('Preview server exited: ' + code))); });
    const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH || (process.platform === 'win32' ? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' : undefined);
    browser = await chromium.launch({ executablePath, headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 960 } }); const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const empty = { schemaVersion: 1, version: 'seed-1', concepts: [], relations: [], bindings: [] };
    let state = { revision: 'r1', draft: structuredClone(empty), published: structuredClone(empty), history: [] }, allowed = true;
    const id = '11111111-1111-4111-8111-111111111111';
    const jwt = [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: id, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated', aud: 'authenticated' })).toString('base64url'), 'test'].join('.');
    const user = { id, email: 'admin@example.test', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
    await page.route('https://*.supabase.co/**', async route => {
      const req = route.request(), url = new URL(req.url()), input = req.postDataJSON();
      let status = 200, data;
      if (url.pathname === '/auth/v1/token') data = { access_token: jwt, refresh_token: 'test-refresh-token', token_type: 'bearer', expires_in: 3600, user };
      else if (url.pathname === '/auth/v1/user') data = user;
      else if (url.pathname === '/auth/v1/logout') data = {};
      else if (url.pathname.includes('/rest/v1/rpc/')) {
        assert.ok(req.headers().authorization?.startsWith('Bearer '));
        if (!allowed) { status = 403; data = { code: '42501', message: 'Ontology administrator access required' }; }
        else if (url.pathname.endsWith('airisk_ontology_state')) data = state;
        else if (url.pathname.endsWith('airisk_ontology_save')) { assert.equal(input.expected_revision, state.revision); state = { ...state, draft: input.document, revision: state.revision + 's' }; data = state; }
        else if (url.pathname.endsWith('airisk_ontology_publish')) { assert.equal(input.expected_revision, state.revision); state.history.unshift({ version: state.published.version, ontology: state.published }); state.published = { ...structuredClone(state.draft), version: 'published-ui-test', publishedAt: new Date().toISOString() }; state.revision += 'p'; data = state; }
        else throw Error('Unexpected RPC: ' + url.pathname);
      } else throw Error('Unexpected Supabase request: ' + url.pathname);
      await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    });
    await page.goto('http://127.0.0.1:' + port + '/admin/');
    await page.waitForURL('**/admin/login.html');
    await page.getByLabel('관리자 이메일').fill(user.email); await page.getByLabel('비밀번호').fill('synthetic-password');
    allowed = false; await page.getByRole('button', { name: '로그인', exact: true }).click();
    await page.getByRole('status').filter({ hasText: '관리자 권한이 없습니다' }).waitFor();
    allowed = true; await page.getByLabel('비밀번호').fill('synthetic-password');
    await page.getByRole('button', { name: '로그인', exact: true }).click();
    await page.locator('#editor').waitFor({ state: 'visible' });
    assert.match(await page.locator('#version').textContent(), /온톨로지 미등록/);
    await page.getByLabel('온톨로지 이름', { exact: true }).fill('Common AI principles');
    await page.getByRole('button', { name: '새 항목' }).click();
    await page.getByLabel('대표 이름').fill('Transparency'); await page.getByLabel('별칭 · 한 줄에 하나').fill('Explainability');
    await page.getByLabel('근거 출처 URL').fill('https://example.org/test-evidence');
    await page.getByLabel('근거 메모').fill('Synthetic browser test evidence.'); await page.getByLabel('검토 상태').selectOption('reviewed');
    await page.getByRole('button', { name: '초안 저장', exact: true }).click();
    await page.locator('#message').filter({ hasText: '초안을 저장했습니다' }).waitFor();
    await page.getByLabel('위험 AI 원칙', { exact: true }).fill('Explainability'); await page.getByLabel('정책 AI 원칙', { exact: true }).fill('Transparency');
    await page.getByRole('button', { name: '현재 초안으로 분석' }).click();
    assert.match(await page.locator('#preview-result').textContent(), /"type": "concept"/);
    await page.getByRole('button', { name: '발행 검토', exact: true }).click();
    await page.locator('#accept').click(); await page.locator('#message').filter({ hasText: '발행했습니다' }).waitFor();
    assert.equal(state.published.concepts[0].label, 'Transparency');
    assert.equal(state.published.name, 'Common AI principles');
    assert.match(await page.locator('#version').textContent(), /Common AI principles/);
    await page.locator('#items button').first().click();
    await page.getByLabel('검토 상태').selectOption('draft');
    assert.equal(await page.locator('#publish').isDisabled(), true);
    await page.getByRole('button', { name: '현재 초안으로 분석' }).click();
    assert.match(await page.locator('#preview-result').textContent(), /"candidates": \[\]/);
    assert.equal(state.published.concepts[0].review, 'reviewed');
    await page.getByLabel('검토 상태').selectOption('reviewed');
    await page.getByRole('button', { name: '초안 저장', exact: true }).click();
    await page.locator('#message').filter({ hasText: '초안을 저장했습니다' }).waitFor();
    await page.locator('#import').setInputFiles(path.join(root, 'supabase/seeds/oecd-principle-crosswalk.json'));
    await page.locator('#accept').click();
    await page.getByRole('button', { name: '원칙 대응·통제수단', exact: false }).click();
    await page.locator('#items button').filter({hasText:'crosswalk-shared-principle-01'}).click();
    assert.equal(await page.getByLabel('관계 종류').inputValue(), 'broader');
    await page.getByLabel('위험 AI 원칙', {exact:true}).fill('Privacy & data governance');
    await page.getByLabel('정책 AI 원칙', {exact:true}).fill('1.2 Respect for the rule of law, human rights and democratic values, including fairness and privacy');
    await page.getByRole('button', {name:'현재 초안으로 분석'}).click();
    assert.match(await page.locator('#preview-result').textContent(), /"type": "broader"/);
    await page.getByLabel('검토 상태').selectOption('draft');
    await page.getByRole('button', {name:'현재 초안으로 분석'}).click();
    assert.match(await page.locator('#preview-result').textContent(), /"candidates": \[\]/);
    await page.getByLabel('검토 상태').selectOption('reviewed');
    await page.getByRole('button', {name:'초안 저장',exact:true}).click();
    await page.locator('#message').filter({hasText:'초안을 저장했습니다'}).waitFor();
    fs.mkdirSync(path.join(root, 'output'), { recursive: true });
    await page.screenshot({ path: path.join(root, 'output/admin-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(root, 'output/admin-mobile.png'), fullPage: true });
    await page.getByRole('button', { name: '로그아웃', exact: true }).click(); await page.locator('#accept').click(); await page.waitForURL('**/admin/login.html');
    assert.deepEqual(errors, []);
    console.log('Browser smoke passed: login gate, non-admin denial, edit/save, ontology preview, publish, logout and mobile width. All Supabase calls mocked.');
  } finally { if (browser) await browser.close(); server.kill(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

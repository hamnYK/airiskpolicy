const {chromium}=require('playwright'),{spawn}=require('node:child_process'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..');
(async()=>{
 const port=await new Promise(resolve=>{const s=require('node:net').createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
 const server=spawn(process.execPath,['server.cjs','--dist'],{cwd:root,env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe'],windowsHide:true});let browser;
 try{
  await new Promise(r=>server.stdout.once('data',r));browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1668,height:870}});
  const edition={country_code:'KR',week_start:'2026-09-28',week_end:'2026-10-04',published_at:'2026-10-05T00:00:00Z',document:{question:'대한민국 국가 안보에 영향을 줄 수 있는 AI 위험과 대응 정책',items:['risk','policy'].map(kind=>({id:kind,kind,title:kind==='risk'?'AI 기반 정보 조작 위험':'AI 보안 관리 정책',change:'원문에서 확인할 핵심 변화',risk:'위험 연결',policy:'정책 연결',reason:'선정 이유',signal:'다음 주 관찰 신호',source:'https://example.com',reviewed:true}))}};
  await page.route('https://**/*',r=>r.request().url().endsWith('/airisk_weekly_public')?r.fulfill({json:edition}):r.abort());await page.route('https://api.country.is/',r=>r.fulfill({json:{country:'KR'}}));await page.route('**/Cesium.js*',r=>r.abort());
  await page.goto('http://127.0.0.1:'+port);await page.locator('#weekly-dialog[open]').waitFor();await page.waitForFunction(()=>document.body.dataset.countryInitialized==='true');
  for(const width of [1668,1280]){
   await page.setViewportSize({width,height:870});await page.waitForFunction(()=>document.querySelector('#weekly-dialog').dataset.layout==='floating');
   const rects=await page.evaluate(()=>Object.fromEntries(['risk-panel','policy-panel','weekly-dialog'].map(id=>[id,document.getElementById(id).getBoundingClientRect().toJSON()])));
   const p=rects['weekly-dialog'],r=rects['risk-panel'],q=rects['policy-panel'];assert(Math.abs(p.top-q.top)<2);assert(p.left>=r.right+19);assert(p.right<=q.left-19);assert(p.bottom<=(await page.locator('.community-entry').boundingBox()).y-15);
   assert.equal(await page.locator('#weekly-dialog').evaluate(e=>e.matches(':modal')),false);
   await page.locator('#risk-panel .source-details summary').click();assert(await page.locator('#risk-panel .source-details').evaluate(e=>e.open));await page.locator('#risk-panel .source-details summary').click();
   await page.screenshot({path:path.join(root,'output/weekly-floating-'+width+'.png')});
  }
  await page.setViewportSize({width:412,height:914});await page.waitForFunction(()=>document.querySelector('#weekly-dialog').dataset.layout==='inline');await page.locator('#weekly-dialog').scrollIntoViewIfNeeded();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.equal(await page.locator('#weekly-dialog').evaluate(e=>e.matches(':modal')),false);await page.locator('#weekly-tab-policy').click();await page.screenshot({path:path.join(root,'output/weekly-inline-412.png')});await page.locator('#weekly-dialog .journey-close').click();assert(await page.locator('#weekly-dialog').isHidden());await page.locator('#weekly-open').click();assert(await page.locator('#weekly-dialog').isVisible());
  console.log('PASS: non-modal, desktop panel top alignment and spacing, background controls, mobile inline layout, close/reopen.');
 }finally{if(browser)await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1});

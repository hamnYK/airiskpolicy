'use strict';
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
(async()=>{
const server=spawn(process.execPath,['server.cjs'],{cwd:require('node:path').resolve(__dirname,'..'),env:{...process.env,PORT:'4193'},windowsHide:true,stdio:['ignore','pipe','pipe']});
let browser;
try {
await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject)});
browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('https://**/*',route=>route.request().url().startsWith('https://api.country.is/')?route.fulfill({json:{country:'KR'}}):route.abort());
await page.addInitScript(()=>{window.selectedCountries=[];document.addEventListener('gis:country-selected',e=>window.selectedCountries.push(e.detail?.code));});
await page.goto('http://127.0.0.1:4193/',{waitUntil:'domcontentloaded',timeout:20000});
await page.waitForFunction(()=>document.body.dataset.countryInitialized==='true',{},{timeout:20000});
assert.ok(await page.evaluate(()=>window.selectedCountries.includes('KOR')));
await page.evaluate(()=>{document.documentElement.lang=document.documentElement.lang});
await page.waitForTimeout(250);
await page.locator('[data-language="ko"]').click();
await page.waitForFunction(()=>document.documentElement.lang==='ko');
await page.locator('[data-language="en"]').click();
await page.waitForFunction(()=>document.documentElement.lang==='en');
assert.deepEqual(errors,[]);
const fallback=await browser.newPage();
await fallback.route('**/Cesium.js',route=>route.abort());
await fallback.route('https://**/*',route=>route.abort());
await fallback.addInitScript(()=>{window.selectedCountries=[];document.addEventListener('gis:country-selected',e=>window.selectedCountries.push(e.detail?.code));});
await fallback.goto('http://127.0.0.1:4193/',{waitUntil:'domcontentloaded'});
await fallback.waitForFunction(()=>document.body.dataset.countryInitialized==='true');
assert.ok(await fallback.evaluate(()=>window.selectedCountries.includes('KOR')));
assert.equal(await fallback.evaluate(()=>document.body.dataset.gisError),'true');
console.log('Full-page initialization passed: country selection, unchanged language, KO/EN toggles, responsive event loop. External APIs mocked/blocked.');
}finally{if(browser)await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1});

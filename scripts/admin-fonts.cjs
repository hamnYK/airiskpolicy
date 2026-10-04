'use strict';
const {chromium}=require('playwright'),{spawn}=require('node:child_process'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
(async()=>{
 const port=await new Promise(resolve=>{const s=require('node:net').createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
 const server=spawn(process.execPath,['server.cjs','--dist'],{cwd:root,env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe'],windowsHide:true});let browser;
 try{
  await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);});
  browser=await chromium.launch({channel:process.platform==='win32'?'msedge':undefined,headless:true});
  for(const file of ['login.html','index.html','weekly.html']){
   const page=await browser.newPage();await page.route('https://**/*',route=>route.abort());
   await page.addInitScript(()=>{window.fontViolations=[];document.addEventListener('securitypolicyviolation',e=>{if(e.effectiveDirective==='font-src')window.fontViolations.push(e.blockedURI);});});
   await page.goto('http://127.0.0.1:'+port+'/admin/'+file);
   const loaded=await page.evaluate(async()=>{const fonts=['16px Pretendard','16px SUITE','16px "Space Grotesk"'];await Promise.all(fonts.map(font=>document.fonts.load(font)));return fonts.every(font=>document.fonts.check(font));});
   assert(loaded,file+' fonts load');assert.deepEqual(await page.evaluate(()=>window.fontViolations),[],file+' CSP permits bundled fonts');await page.close();
  }
  console.log('PASS: login, ontology and weekly pages load bundled fonts with their real CSP.');
 }finally{if(browser)await browser.close();server.kill();}
})().catch(error=>{console.error(error);process.exitCode=1});

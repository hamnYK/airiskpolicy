'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
require('./build-seo.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'dist');
const ontology=JSON.parse(fs.readFileSync(path.join(root,'ontology.json'),'utf8'));
const ontologyErrors=require('../ontology-model.js').validate(ontology);
if(ontologyErrors.length)throw Error('Invalid public ontology: '+ontologyErrors.join('; '));
if([...ontology.concepts,...ontology.relations,...ontology.bindings].some(row=>row.review!=='reviewed'))throw Error('Public ontology must not contain draft entries');
const ontologyConfig=JSON.parse(fs.readFileSync(path.join(root,'ontology-config.json'),'utf8'));
if(process.env.ONTOLOGY_PROVIDER)ontologyConfig.provider=process.env.ONTOLOGY_PROVIDER;
if(!['static','supabase',undefined].includes(ontologyConfig.provider))throw Error('Unknown ontology provider');
if(ontologyConfig.provider!=='supabase'&&ontologyConfig.endpoint!=='ontology.json'&&!/^https:\/\//.test(ontologyConfig.endpoint||''))throw Error('Ontology endpoint must be ontology.json or HTTPS');
const supabaseConfig=JSON.parse(fs.readFileSync(path.join(root,'supabase-config.json'),'utf8'));
if(process.env.SUPABASE_URL)supabaseConfig.url=process.env.SUPABASE_URL;
if(process.env.SUPABASE_PUBLISHABLE_KEY)supabaseConfig.publishableKey=process.env.SUPABASE_PUBLISHABLE_KEY;
if(!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(supabaseConfig.url)||!/^sb_publishable_[A-Za-z0-9_-]+$/.test(supabaseConfig.publishableKey))throw Error('Only a Supabase HTTPS URL and public Publishable key may be bundled');
if(path.dirname(out)!==root||path.basename(out)!=='dist')throw Error('Unsafe build path');
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
for(const file of fs.readdirSync(root)){
 if(!/\.(html|css|js)$/.test(file)&&!['ontology.json','ontology-config.json','i18n-en.json','seo.json','CNAME','robots.txt','sitemap.xml'].includes(file))continue;
 const source=path.join(root,file);if(!fs.statSync(source).isFile())continue;
 let text=fs.readFileSync(source,'utf8');if(file.endsWith('.js'))new vm.Script(text,{filename:file});
 text=text.replaceAll('node_modules/cesium/Build/Cesium/','vendor/cesium/');
 fs.writeFileSync(path.join(out,file),text);
}
fs.cpSync(path.join(root,'assets'),path.join(out,'assets'),{recursive:true});
fs.writeFileSync(path.join(out,'ontology-config.json'),JSON.stringify(ontologyConfig,null,2));
fs.writeFileSync(path.join(out,'supabase-config.json'),JSON.stringify(supabaseConfig,null,2));
fs.mkdirSync(path.join(out,'admin'),{recursive:true});
for(const name of ['index.html','login.html','style.css','editor.js','login.js','supabase-client.js','workspace-tabs.js','weekly.html','weekly.js','weekly.css','ai-settings.js','ai-settings.css']){
 let source=fs.readFileSync(path.join(root,'admin',name),'utf8');
 if(name.endsWith('.js'))new vm.Script(source,{filename:'admin/'+name});
 source=source.replaceAll('../node_modules/@supabase/supabase-js/dist/umd/supabase.js','../vendor/supabase/supabase.js');
 source=source.replaceAll('https://jiyngdwpdmpjiwdnyanb.supabase.co',supabaseConfig.url);
 fs.writeFileSync(path.join(out,'admin',name),source);
}
fs.mkdirSync(path.join(out,'vendor/supabase'),{recursive:true});
fs.copyFileSync(path.join(root,'node_modules/@supabase/supabase-js/dist/umd/supabase.js'),path.join(out,'vendor/supabase/supabase.js'));
fs.copyFileSync(path.join(root,'node_modules/@supabase/supabase-js/LICENSE'),path.join(out,'vendor/supabase/LICENSE'));
const cesium=path.join(root,'node_modules/cesium');const vendor=path.join(out,'vendor/cesium');fs.mkdirSync(vendor,{recursive:true});
for(const name of ['Cesium.js','Assets','ThirdParty','Widgets','Workers'])fs.cpSync(path.join(cesium,'Build/Cesium',name),path.join(vendor,name),{recursive:true});
fs.copyFileSync(path.join(cesium,'LICENSE.md'),path.join(vendor,'LICENSE.md'));
// Changed scripts/styles get new URLs, including for visitors with cached assets.
for(const page of ['index.html','design-system.html','admin/index.html','admin/login.html','admin/weekly.html']){
 const target=path.join(out,page);
 const source=fs.readFileSync(target,'utf8').replace(/((?:src|href)=")([^"?#]+\.(?:js|css))"/g,(whole,prefix,url)=>{
  if(/^(?:https?:|data:)/.test(url))return whole;
  const asset=path.resolve(path.dirname(target),url);
  const hash=require('node:crypto').createHash('sha256').update(fs.readFileSync(asset)).digest('hex').slice(0,12);
  return prefix+url+'?v='+hash+'"';
 });
 fs.writeFileSync(target,source);
}
fs.writeFileSync(path.join(out,'.nojekyll'),'');
const html=fs.readFileSync(path.join(out,'index.html'),'utf8');for(const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)){if(/^(https?:|data:)/.test(match[1]))continue;if(!fs.existsSync(path.join(out,match[1].split('?')[0])))throw Error('Missing deployment asset: '+match[1])}
for(const json of ['ontology.json','ontology-config.json','seo.json','i18n-en.json'])JSON.parse(fs.readFileSync(path.join(out,json),'utf8'));
for(const file of ['admin/index.html','admin/login.html','admin/weekly.html']){
 const html=fs.readFileSync(path.join(out,file),'utf8');
 for(const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)){
  if(/^(https?:|data:)/.test(match[1]))continue;
  if(!fs.existsSync(path.resolve(out,path.dirname(file),match[1].split('?')[0])))throw Error('Missing admin asset: '+match[1]);
 }
}
for(const file of ['supabase','admin/seed.json','admin/DEPLOYMENT.md'])if(fs.existsSync(path.join(out,file)))throw Error('Private setup asset leaked: '+file);
console.log('Built dist: static GIS, Cesium workers/assets, UI and country data.');

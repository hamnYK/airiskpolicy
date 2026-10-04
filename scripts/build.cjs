'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..'),out=path.join(root,'dist');
if(path.dirname(out)!==root||path.basename(out)!=='dist')throw Error('Unsafe build path');
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
for(const file of fs.readdirSync(root)){
 if(!/\.(html|css|js)$/.test(file)&&!['i18n-en.json','seo.json','CNAME'].includes(file))continue;
 const source=path.join(root,file);if(!fs.statSync(source).isFile())continue;
 let text=fs.readFileSync(source,'utf8');if(file.endsWith('.js'))new vm.Script(text,{filename:file});
 text=text.replaceAll('node_modules/cesium/Build/Cesium/','vendor/cesium/');
 fs.writeFileSync(path.join(out,file),text);
}
fs.cpSync(path.join(root,'assets'),path.join(out,'assets'),{recursive:true});
const cesium=path.join(root,'node_modules/cesium');const vendor=path.join(out,'vendor/cesium');fs.mkdirSync(vendor,{recursive:true});
for(const name of ['Cesium.js','Assets','ThirdParty','Widgets','Workers'])fs.cpSync(path.join(cesium,'Build/Cesium',name),path.join(vendor,name),{recursive:true});
fs.copyFileSync(path.join(cesium,'LICENSE.md'),path.join(vendor,'LICENSE.md'));
fs.writeFileSync(path.join(out,'.nojekyll'),'');
const html=fs.readFileSync(path.join(out,'index.html'),'utf8');for(const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)){if(/^(https?:|data:)/.test(match[1]))continue;if(!fs.existsSync(path.join(out,match[1])))throw Error('Missing deployment asset: '+match[1])}
for(const json of ['seo.json','i18n-en.json'])JSON.parse(fs.readFileSync(path.join(out,json),'utf8'));
console.log('Built dist: static GIS, Cesium workers/assets, UI and country data.');

'use strict';
(()=>{
let language='en',koreanAvailable=false,translationsReady=false;
const textCache=new WeakMap(),attributeCache=new WeakMap();let dictionary={},seo=null,observer,scheduled=false;
// Source data and personal writing retain their original language.
const protectedContent='script,style,textarea,input,[data-no-translate],[translate=no],.record-title,.detail-summary,.detail-body>h3,.case-text,.case-heading h3,.case-heading>p,.case-row h3,.case-row>p,#community-context h3';
function translate(value){if(language!=='en'||!value)return value;const s=value.trim();let out=dictionary[s];if(out===undefined){
let m;const records=n=>n+' '+(Number(n)===1?'record':'records');const results=n=>n+' '+(Number(n)===1?'result':'results');
if((m=s.match(/^최근 (\d+)건 \/ 검색 결과 (\d+)건$/)))out='Latest '+records(m[1])+' / '+results(m[2]);
else if((m=s.match(/^최근 (\d+)건의 관련 기사 수 합계$/)))out='Articles linked to the latest '+records(m[1]);
else if((m=s.match(/^최신 (\d+)건$/)))out='Latest '+records(m[1]);
else if((m=s.match(/^내 기록 (\d+)개 이어보기 ▶$/)))out='Continue my work ('+m[1]+') ▶';
else if((m=s.match(/^관련 기록 (\d+)건$/)))out='Related records ('+m[1]+')';
else if((m=s.match(/^AIM 원문 제목 · 관련 기사 (.*)$/)))out='Original AIM title · Related articles: '+m[1].replace(/건$/,'').replace('미제공','not available');
else if((m=s.match(/^(.*) 분야에 공유할 초안의 다운로드를 요청했습니다\. 단체에 자동 전송되지는 않습니다\.$/)))out='Download requested for your '+translate(m[1])+' draft. It has not been sent to an organisation.';
else if((m=s.match(/^조회: (.*)$/)))out='Retrieved: '+m[1].replace('오전','AM').replace('오후','PM');
else if((m=s.match(/^지구를 표시하지 못했습니다\. (.*)$/)))out='Could not display the globe. '+translate(m[1]);
else if((m=s.match(/^(.*) · AIM 조회 결과$/)))out=translate(m[1])+' · AIM search results';
else if((m=s.match(/^([^·]*) (\d+)건$/)))out=translate(m[1])+' '+records(m[2]);
else if((m=s.match(/^(\d+)건$/)))out=records(m[1]);
else if(s.includes(' · '))out=s.split(' · ').map(translate).join(' · ');
else out=s;
}return value.slice(0,value.indexOf(s))+out+value.slice(value.indexOf(s)+s.length);}
function original(node){if(!node)return '';if(node.nodeType===3){const c=textCache.get(node);return c&&node.nodeValue===c.rendered?c.source:node.nodeValue}return [...node.childNodes].map(original).join('');}
function renderNode(node){const parent=node.parentElement;if(!parent||parent.closest(protectedContent))return;const value=node.nodeValue;let c=textCache.get(node);if(!c||value!==c.rendered)c={source:value,rendered:value};const next=translate(c.source);c.rendered=next;textCache.set(node,c);if(value!==next)node.nodeValue=next;}
function render(){scheduled=false;observer?.disconnect();const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);while(walker.nextNode())renderNode(walker.currentNode);for(const el of document.querySelectorAll('[placeholder],[aria-label],[title]')){if(el.closest('[data-no-translate],.cesium-widget'))continue;let state=attributeCache.get(el)||{};for(const name of ['placeholder','aria-label','title']){if(!el.hasAttribute(name))continue;const value=el.getAttribute(name);let c=state[name];if(!c||value!==c.rendered)c={source:value};const next=translate(c.source);c.rendered=next;state[name]=c;if(next!==value)el.setAttribute(name,next)}attributeCache.set(el,state)}
if(document.documentElement.lang!==language)document.documentElement.lang=language;for(const b of document.querySelectorAll('[data-language]'))b.setAttribute('aria-pressed',String(b.dataset.language===language));if(seo){const copy=seo[language];document.title=copy.title;for(const [selector,value]of [['meta[name="description"]',copy.description],['meta[property="og:title"]',copy.title],['meta[property="og:description"]',copy.description],['meta[property="og:locale"]',copy.locale],['meta[name="twitter:title"]',copy.title],['meta[name="twitter:description"]',copy.description]])document.querySelector(selector)?.setAttribute('content',value);const ld=document.querySelector('script[type="application/ld+json"]');if(ld){const data=JSON.parse(ld.textContent);data.inLanguage=language;data.description=copy.description;ld.textContent=JSON.stringify(data)}}observer?.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['placeholder','aria-label','title']});}
function schedule(){if(!scheduled){scheduled=true;queueMicrotask(render)}}
window.aiRiskI18n={get language(){return language},t:translate,source:original,refresh:schedule};
const control=document.createElement('div');control.className='language-toggle';control.hidden=true;control.setAttribute('role','group');control.setAttribute('aria-label','Language / 언어');control.dataset.noTranslate='true';for(const [lang,label]of [['ko','한국어'],['en','English']]){const b=document.createElement('button');b.type='button';b.textContent=label;b.lang=lang;b.dataset.language=lang;b.onclick=()=>{if(!koreanAvailable)return;language=lang;try{localStorage.setItem('ai-risk-language',lang)}catch{}render();document.dispatchEvent(new CustomEvent('language:changed',{detail:{language}}));};control.append(b)}document.querySelector('.map-controls').prepend(control);
Promise.resolve(window.aiRiskVisitorCountry).then(country=>{koreanAvailable=country==='KR';document.body.dataset.koreanAvailable=String(koreanAvailable);if(koreanAvailable){try{language=localStorage.getItem('ai-risk-language')==='ko'?'ko':'en'}catch{}}else language='en';control.hidden=!koreanAvailable||!translationsReady;if(translationsReady)render();});
Promise.all([fetch('i18n-en.json').then(r=>{if(!r.ok)throw Error('Translations unavailable');return r.json()}),fetch('seo.json').then(r=>r.json())]).then(([d,s])=>{dictionary=d;seo=s;translationsReady=true;control.hidden=!koreanAvailable;observer=new MutationObserver(schedule);render();document.body.dataset.i18nReady='true'}).catch(()=>{control.hidden=true;document.body.dataset.i18nError='true'});
})();

'use strict';
(()=>{
 const make=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;},L=(ko,en)=>document.documentElement.lang==='ko'?ko:en;
 let edition=null,tab='risk',opener=null,failed=false,visitorCountry=null;
 const button=make('button');button.id='weekly-open';button.hidden=true;button.type='button';button.className='ds-secondary';document.querySelector('.map-controls').append(button);
 const dialog=make('dialog');dialog.id='weekly-dialog';dialog.className='journey-dialog weekly-dialog';dialog.dataset.noTranslate='true';dialog.setAttribute('aria-labelledby','weekly-title');dialog.setAttribute('aria-modal','false');button.setAttribute('aria-controls',dialog.id);button.setAttribute('aria-expanded','false');
 const header=make('header'),title=make('h2'),close=make('button'),body=make('div');title.id='weekly-title';header.className='journey-dialog-head';close.className='journey-close';body.className='weekly-body';header.append(title,close);dialog.append(header,body);document.body.append(dialog);
 function render(){
  button.hidden=!edition||failed;
  button.textContent=L('주간 TOP 10','Weekly TOP 10');title.textContent=L('AI 주간 브리핑 · TOP 10','Weekly AI Briefing · TOP 10');close.textContent=L('닫기','Close');body.replaceChildren();
  if(failed){body.append(make('p',L('브리핑을 불러오지 못했습니다. 새로고침 후 다시 확인해 주세요.','Could not load the briefing. Refresh to retry.')));return;}
  if(!edition){body.append(make('p',L('아직 발행된 주간 브리핑이 없습니다. 관리자가 후보를 검토한 뒤 공개합니다.','No weekly briefing has been published yet. Candidates become public after editorial review.')));return;}
  body.append(make('p',new Intl.DisplayNames([document.documentElement.lang==='ko'?'ko':'en'],{type:'region'}).of(edition.country_code)+' · '+edition.week_start+' — '+edition.week_end+' · '+L('검토 기간 · 한국시간','Review period · Korea time')));
  body.append(make('p',L('관리자가 선정한 주요 이슈입니다. 통계적 위험 순위나 정책 효과 점수가 아닙니다.','Editorial selections, not statistical risk rankings or policy effectiveness scores.')));
  body.append(make('h3',edition.document.question));
  const tabs=make('div');tabs.className='weekly-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label',L('브리핑 분야','Briefing category'));
  for(const kind of ['risk','policy']){const b=make('button',kind.toUpperCase()+' · '+edition.document.items.filter(x=>x.kind===kind).length+L('건',' issues'));b.className='ds-secondary';b.id='weekly-tab-'+kind;b.setAttribute('role','tab');b.setAttribute('aria-selected',String(kind===tab));b.setAttribute('aria-controls','weekly-panel');b.tabIndex=kind===tab?0:-1;b.onclick=()=>{tab=kind;render();document.getElementById(b.id).focus();};b.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();tab=e.key==='Home'?'risk':e.key==='End'?'policy':tab==='risk'?'policy':'risk';render();document.getElementById('weekly-tab-'+tab).focus();}};tabs.append(b);}body.append(tabs);
  const panel=make('section');panel.id='weekly-panel';panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby','weekly-tab-'+tab);
  if(!edition.document.items.some(x=>x.kind===tab))panel.append(make('p',L('이번 주 이 분야의 선정 이슈는 없습니다. 관련 위험이나 정책이 없다는 뜻은 아닙니다.','No issues were selected in this category this week. This does not mean that no relevant risks or policies exist.')));
  edition.document.items.filter(x=>x.kind===tab).forEach((item,index)=>{const details=make('details'),summary=make('summary',(index+1)+'. '+item.title);details.append(summary);for(const [key,ko,en]of [['change','핵심 변화','What changed'],['risk','위험 연결','Risk connection'],['policy','정책·통제 연결','Policy / control connection'],['reason','선정 이유','Why selected'],['signal','다음 주 관찰 신호','Signals to watch next week']])details.append(make('h4',L(ko,en)),make('p',item[key]));const a=make('a',L('근거 원문 확인 ▶','Read the evidence ▶'));a.className='ds-link';try{const url=new URL(item.source);if(url.protocol==='https:'){a.href=url.href;a.target='_blank';a.rel='noopener';details.append(a);}}catch{}panel.append(details);});body.append(panel);
  body.append(make('p',L('발행: ','Published: ')+new Date(edition.published_at).toLocaleString(document.documentElement.lang==='ko'?'ko-KR':'en-US')));
 }
 function position(){
  const left=document.getElementById('risk-panel'),right=document.getElementById('policy-panel'),observatory=document.getElementById('observatory');
  const a=left?.getBoundingClientRect(),b=right?.getBoundingClientRect(),gap=20,available=a&&b?b.left-a.right-gap*2:0;
  const top=a&&b?Math.max(a.top,b.top):0,bottom=observatory?.querySelector('.community-entry')?.getBoundingClientRect().top??innerHeight;
  const floating=innerWidth>700&&available>=300&&Math.abs(a.top-b.top)<8&&bottom-top-16>=240;
  dialog.dataset.layout=floating?'floating':'inline';
  if(floating){
   if(dialog.parentElement!==document.body)document.body.append(dialog);
   const width=Math.min(360,available);
   dialog.style.left=(b.left-gap-width+scrollX)+'px';dialog.style.top=(top+scrollY)+'px';dialog.style.width=width+'px';
   dialog.style.maxHeight=Math.min(650,bottom-top-16)+'px';
  }else{
   if(observatory&&observatory.nextElementSibling!==dialog)observatory.after(dialog);
   for(const prop of ['left','top','width','max-height'])dialog.style.removeProperty(prop);
  }
 }
 function open(manual=true){if(dialog.open||!edition||failed)return;opener=document.activeElement===document.body?button:document.activeElement;render();position();dialog.show();button.setAttribute('aria-expanded','true');if(manual){close.focus({preventScroll:true});if(dialog.dataset.layout==='inline')dialog.scrollIntoView({block:'start'});}else opener?.focus({preventScroll:true});}
 close.onclick=()=>dialog.close();dialog.addEventListener('cancel',e=>e.preventDefault());dialog.addEventListener('close',()=>{button.setAttribute('aria-expanded','false');if(edition)try{localStorage.setItem('airisk-weekly-seen-'+visitorCountry,edition.published_at);}catch{}opener?.focus({preventScroll:true});});button.onclick=()=>open();
 addEventListener('resize',position);const layoutObserver=new ResizeObserver(position);for(const id of ['observatory','risk-panel','policy-panel']){const element=document.getElementById(id);if(element)layoutObserver.observe(element);}position();
 new MutationObserver(render).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});render();
 (async()=>{try{visitorCountry=await window.aiRiskVisitorCountry;if(!/^[A-Z]{2}$/.test(visitorCountry||''))return;const c=await (await fetch('supabase-config.json',{cache:'no-store',signal:AbortSignal.timeout(15000)})).json();if(!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(c.url))throw Error();const r=await fetch(c.url+'/rest/v1/rpc/airisk_weekly_public',{method:'POST',headers:{apikey:c.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({p_country:visitorCountry}),signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error();const data=await r.json();if(data&&(data.country_code!==visitorCountry||!data.document||window.aiRiskWeekly.validate(data.document,true).length))throw Error();edition=data;render();let seen=null;try{seen=localStorage.getItem('airisk-weekly-seen-'+visitorCountry);}catch{}if(edition&&seen!==edition.published_at&&!document.querySelector('dialog[open]'))open(false);}catch{failed=true;button.hidden=true;button.title=L('브리핑을 불러오지 못했습니다. 새로고침 후 다시 확인해 주세요.','Could not load the briefing. Refresh to retry.');body.replaceChildren(make('p',button.title));}})();
})();

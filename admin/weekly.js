'use strict';
(()=>{
 if(new URLSearchParams(location.search).get('embedded')==='1')document.body.classList.add('embedded');
 const $=id=>document.getElementById(id),make=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
 let state=null,draft=null,kind='risk',selected=null,dirty=false,busy=false,proposal=null,proposalBase=null;
 const message=text=>$('weekly-message').textContent=text;
 const rpc=(name,args)=>window.aiRiskAdmin.rpc('airisk_weekly_'+name,args);
 function status(){for(const id of ['load','collect','download','save','publish','withdraw','add','ai-generate-weekly'])$(id).disabled=busy||!state||((id==='publish'||id==='ai-generate-weekly')&&dirty);$('weekly-status').textContent=state.week_start+' 주 · '+(dirty?'미저장 변경 있음':'초안 저장됨')+' · RISK '+draft.items.filter(x=>x.kind==='risk').length+'/10 · POLICY '+draft.items.filter(x=>x.kind==='policy').length+'/10 · '+(state.published?'공개본 있음':'미발행');}
 function mark(){clearProposal();dirty=true;status();}
 function clearProposal(){proposal=null;proposalBase=null;$('ai-proposal').hidden=true;}
 function install(next){clearProposal();state=next;draft=structuredClone(next.draft);dirty=false;selected=null;$('week').value=state.week_start;$('question').value=draft.question;render();}
 async function run(fn){if(busy)return;busy=true;if(state)status();try{await fn();}catch(e){message(e.message);}finally{busy=false;if(state)status();}}
 function confirm(text,action){$('confirm-text').textContent=text;$('accept').onclick=()=>{$('weekly-confirm').close();run(action);};$('weekly-confirm').showModal();$('cancel').focus();}
 $('cancel').onclick=()=>$('weekly-confirm').close();$('weekly-confirm').addEventListener('cancel',e=>e.preventDefault());
 async function load(){install(await rpc('state',{p_week:$('week').value||null}));$('weekly-editor').hidden=false;message('초안을 불러왔습니다. 저장과 발행은 별도입니다.');}
 function source(url){const a=make('a','출처 확인 ▶');a.className='ds-link';try{const u=new URL(url);if(u.protocol!=='https:')return make('span','출처 확인 필요');a.href=u.href;a.target='_blank';a.rel='noopener';return a;}catch{return make('span','출처 확인 필요');}}
 function add(candidate){if(draft.items.filter(x=>x.kind===kind).length>=10){message('해당 탭은 최대 10개를 선정합니다. 기존 항목을 제외한 뒤 추가하세요.');return;}
  const item={id:candidate?.id||'manual-'+crypto.randomUUID(),kind,title:candidate?.title||'',source:candidate?.source||'',change:'',risk:'',policy:'',signal:'',reason:'',reviewed:false};
  if(draft.items.some(x=>x.id===item.id)){message('이미 선정한 후보입니다.');return;}draft.items.push(item);selected=item.id;mark();render();}
 function render(){
  status();$('risk-tab').setAttribute('aria-pressed',String(kind==='risk'));$('policy-tab').setAttribute('aria-pressed',String(kind==='policy'));
  const c=state.collection;$('collection').textContent=c.fetchedAt?'수집: '+new Date(c.fetchedAt).toLocaleString()+' · RISK 수신 '+c.riskReceived+'/'+c.riskTotal+' · POLICY 전체 조회 '+c.policyScanned+' / 주간 갱신 '+c.policyEligible+' · 탭별 후보 최대 100개':'아직 후보를 수집하지 않았습니다.';
  $('candidates').replaceChildren();const candidates=state.candidates.filter(x=>x.kind===kind);if(!candidates.length)$('candidates').append(make('p','해당 주에 수집된 후보가 없습니다. 원출처를 확인해 직접 추가할 수 있습니다.'));
  for(const c of candidates){const card=make('article'),h=make('h3',c.title),meta=make('p',c.date+' · '+(c.country||'국가 미제공')+' · '+(kind==='policy'?'등록정보 갱신일':'관련 기사 '+(c.articles??'미제공'))),details=make('details');details.append(make('summary','수집 원문 요약'),make('p',c.summary||'요약 없음'));const b=make('button','선정 목록에 추가');b.disabled=draft.items.some(x=>x.id===c.id);b.onclick=()=>add(c);card.append(h,meta,details,source(c.source),b);$('candidates').append(card);}
  $('selected').replaceChildren();const items=draft.items.filter(x=>x.kind===kind);$('selection-count').textContent=kind.toUpperCase()+' 선정 '+items.length+'/10';
  items.forEach((item,index)=>{const card=make('article'),b=make('button',(index+1)+'. '+(item.title||'제목 없음')+(item.reviewed?' · 검토 완료':' · 검토 필요'));b.onclick=()=>{selected=item.id;edit();};card.append(b);for(const [label,offset]of [['위로',-1],['아래로',1]]){const move=make('button',label);move.disabled=index+offset<0||index+offset>=items.length;move.onclick=()=>{const other=items[index+offset],a=draft.items.indexOf(item),b=draft.items.indexOf(other);[draft.items[a],draft.items[b]]=[draft.items[b],draft.items[a]];mark();render();};card.append(move);}const remove=make('button','선정 제외');remove.onclick=()=>confirm('이 이슈를 선정 목록에서 제외할까요? 자동 수집 후보는 남습니다.',async()=>{draft.items=draft.items.filter(x=>x.id!==item.id);if(selected===item.id)selected=null;mark();render();});card.append(remove);$('selected').append(card);});edit();
 }
 function edit(){const box=$('item-editor');box.replaceChildren();const item=draft.items.find(x=>x.id===selected&&x.kind===kind);if(!item){box.append(make('p','선정 항목을 선택해 내용을 편집하세요.'));return;}
  for(const [key,label]of [['title','제목'],['change','핵심 변화 · 원문을 확인해 작성'],['risk','위험 연결'],['policy','정책·통제 연결'],['reason','선정 이유'],['signal','다음 주 관찰 신호'],['source','근거 원문 HTTPS URL']]){const l=make('label',label),input=make(key==='title'||key==='source'?'input':'textarea');input.value=item[key];input.maxLength=key==='title'?500:4000;input.id='weekly-field-'+key;input.oninput=()=>{item[key]=input.value;item.reviewed=false;const checked=$('reviewed');if(checked)checked.checked=false;mark();};l.append(input);box.append(l);}
  const l=make('label',' 원문과 분석 내용을 검토했습니다'),check=make('input');l.className='weekly-review';check.id='reviewed';check.type='checkbox';check.checked=item.reviewed===true;check.onchange=()=>{item.reviewed=check.checked;mark();};l.prepend(check);box.append(l);
 }
 $('ai-generate-weekly').onclick=()=>run(async()=>{
  if(dirty||!draft.question.trim())throw Error('핵심 질문을 작성하고 초안 저장을 먼저 해 주세요.');
  const base=JSON.stringify(draft),revision=state.revision;clearProposal();message('핵심 질문에 관련된 후보를 선정하고 내용을 작성 중… 최대 2분 걸릴 수 있습니다.');
  const settings=await rpc('ai_state');if(!settings)throw Error('AI API 세팅에서 제공자·키·모델을 먼저 저장하세요.');
  const client=await window.aiRiskAdmin.client();const {data,error}=await client.functions.invoke('weekly-ai-settings',{body:{action:'generate',revision:settings.revision,week:state.week_start,week_revision:revision}});
  if(error){let text='AI 요청에 실패했습니다. 기존 초안은 유지됩니다.';try{text=(await error.context.json()).error||text;}catch{}throw Error(text);}
  if(data?.error)throw Error(data.error);
  if(dirty||JSON.stringify(draft)!==base||state.revision!==revision||data.week_revision!==revision)throw Error('작성 중 초안이 변경되어 AI 제안을 반영하지 않았습니다.');
  if(!data.proposal||window.aiRiskWeekly.validate({question:data.proposal.question,items:data.proposal.items}).length)throw Error('AI 제안 형식을 확인하지 못했습니다.');
  proposal=data.proposal;proposalBase=base;const items=$('ai-proposal-items');items.replaceChildren();$('ai-proposal-note').textContent='RISK '+proposal.items.filter(x=>x.kind==='risk').length+'건 · POLICY '+proposal.items.filter(x=>x.kind==='policy').length+'건 · '+proposal.note;
  for(const k of ['risk','policy']){items.append(make('h3',k.toUpperCase()));const rows=proposal.items.filter(x=>x.kind===k);if(!rows.length)items.append(make('p','질문과 관련된 선정 후보 없음'));rows.forEach((item,i)=>{const details=make('details');details.append(make('summary',(i+1)+'. '+item.title));for(const [field,label]of [['change','핵심 변화'],['risk','위험 연결'],['policy','정책·통제 연결'],['reason','선정 이유'],['signal','다음 주 관찰 신호']])details.append(make('h4',label),make('p',item[field]));details.append(source(item.source));items.append(details);});}
  $('ai-proposal').hidden=false;$('ai-apply-weekly').disabled=!proposal.items.length;message(proposal.items.length?'AI 제안을 확인하세요. 아직 초안이나 공개본을 변경하지 않았습니다.':'관련 후보를 선정하지 않았습니다. 기존 초안은 유지됩니다.');
 });
 $('ai-discard-weekly').onclick=clearProposal;
 $('ai-apply-weekly').onclick=()=>{if(!proposal)return;confirm('현재 선정 목록을 AI 제안으로 교체할까요? 모든 제안은 검토 필요 상태이며 초안 저장과 발행은 별도입니다.',async()=>{if(!proposal||JSON.stringify(draft)!==proposalBase)throw Error('초안이 변경되어 제안을 적용할 수 없습니다.');draft.items=structuredClone(proposal.items).map(x=>({...x,reviewed:false}));selected=null;mark();render();message('AI 제안을 편집 초안에 반영했습니다. 원문 확인·내용 검토 후 저장하고 발행하세요.');});};
 $('question').oninput=()=>{draft.question=$('question').value;mark();};
 for(const k of ['risk','policy'])$(k+'-tab').onclick=()=>{kind=k;selected=null;render();};
 $('add').onclick=()=>add();$('load').onclick=()=>{if(dirty)confirm('미저장 편집을 버리고 선택한 주의 저장본을 불러올까요?',load);else run(load);};
 $('collect').onclick=()=>run(async()=>{clearProposal();message('RISK·POLICY 후보 수집 중… 약 1~2분 걸릴 수 있습니다.');const client=await window.aiRiskAdmin.client();const {data,error}=await client.functions.invoke('weekly-collect',{body:{week:state.week_start}});if(error||data?.error)throw Error(data?.error||error?.message||'수집 실패');const next=await rpc('state',{p_week:state.week_start});state.candidates=next.candidates;state.collection=next.collection;render();message('후보를 갱신했습니다. 편집 중인 초안과 공개본은 유지됩니다.');});
 $('save').onclick=()=>run(async()=>{const errors=window.aiRiskWeekly.validate(draft);if(errors.length)throw Error(errors.join('\n'));const selection=selected;install(await rpc('save',{p_week:state.week_start,expected_revision:state.revision,document:draft}));selected=selection;edit();message('초안을 저장했습니다. 아직 공개본에는 적용되지 않았습니다.');});
 $('publish').onclick=()=>{const errors=window.aiRiskWeekly.validate(draft,true);if(errors.length){message('발행 조건을 확인하세요: '+errors.join('\n'));return;}confirm(state.week_start+' 주간 RISK '+draft.items.filter(x=>x.kind==='risk').length+'개·POLICY '+draft.items.filter(x=>x.kind==='policy').length+'개를 공개할까요? 목록 순서가 각 탭의 순위가 됩니다.',async()=>{install(await rpc('publish',{p_week:state.week_start,expected_revision:state.revision,withdraw:false}));message('공개 발행했습니다. 방문자는 새로고침하면 팝업에서 볼 수 있습니다.');});};
 $('withdraw').onclick=()=>confirm('이 주의 발행을 취소할까요? 저장된 초안은 남지만 미저장 편집은 사라집니다. 공개 화면에는 이전 주의 발행본이 표시될 수 있습니다.',async()=>{install(await rpc('publish',{p_week:state.week_start,expected_revision:state.revision,withdraw:true}));message('발행을 취소했습니다.');});
 $('download').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({week:state.week_start,...draft},null,2)],{type:'application/json'})),a=make('a');a.href=url;a.download='weekly-briefing-'+state.week_start+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
 run(async()=>{const client=await window.aiRiskAdmin.client();const {data,error}=await client.auth.getUser();if(error||!data.user){message('관리자 로그인이 필요합니다. 위의 관리자 로그인 링크를 이용하세요.');return;}await load();});
})();

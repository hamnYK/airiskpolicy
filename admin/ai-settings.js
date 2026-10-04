'use strict';
(()=>{
 const $=id=>document.getElementById(id),section=$('ai-settings'),form=$('ai-settings-form'),field=$('ai-fields'),provider=$('ai-provider'),key=$('ai-key'),model=$('ai-model'),status=$('ai-status'),list=$('ai-model-list');
 let saved=null,loaded=false,dirty=false,busy=false;
 const links={gemini:'https://aistudio.google.com/app/apikey',openai:'https://platform.openai.com/api-keys',anthropic:'https://platform.claude.com/settings/keys'};
 function update(){ $('ai-key-help').href=links[provider.value];$('ai-test').disabled=busy||!saved||dirty;$('ai-delete').disabled=busy||!saved;$('ai-save').disabled=busy||!loaded; }
 function install(value){saved=value;provider.value=value?.provider||'gemini';model.value=value?.model||'';key.value='';list.replaceChildren();list.hidden=true;dirty=false;loaded=true;$('ai-saved').textContent=value?'키 등록됨 · '+value.provider+' · '+value.model+' · 변경 '+new Date(value.updated_at).toLocaleString():'등록된 AI 설정이 없습니다.';update();}
 async function invoke(body){const client=await window.aiRiskAdmin.client();const {data,error}=await client.functions.invoke('weekly-ai-settings',{body});if(error){let message='설정 요청에 실패했습니다. 로그인과 연결 상태를 확인하세요.';try{const result=await error.context.json();if(typeof result.error==='string')message=result.error;}catch{}throw Error(message);}if(data?.error)throw Error(data.error);return data;}
 async function run(fn){if(busy)return;busy=true;field.disabled=true;update();try{await fn();}catch(e){status.textContent=e.message;}finally{busy=false;field.disabled=false;update();}}
 function confirm(text,action){$('ai-confirm-text').textContent=text;$('ai-accept').onclick=()=>{$('ai-confirm').close();run(action);};if(window.parent!==window)window.parent.aiRiskPositionConfirmation?.($('ai-confirm'));$('ai-confirm').showModal();$('ai-cancel').focus();}
 $('ai-cancel').onclick=()=>$('ai-confirm').close();$('ai-confirm').addEventListener('cancel',e=>e.preventDefault());
 async function load(){install(await window.aiRiskAdmin.rpc('airisk_weekly_ai_state'));status.textContent='서버 설정을 불러왔습니다. API 키 원문은 표시하지 않습니다.';}
 section.addEventListener('toggle',()=>{if(section.open&&!loaded)run(load);});
 $('ai-reload').onclick=()=>dirty?confirm('입력 중인 설정을 버리고 서버 저장본을 불러올까요?',load):run(load);
 form.addEventListener('input',()=>{dirty=true;update();status.textContent='변경한 설정을 저장하세요.';});
 provider.onchange=()=>{key.value='';model.value='';list.replaceChildren();list.hidden=true;update();};
 key.addEventListener('input',()=>{list.replaceChildren();list.hidden=true;});
 form.onsubmit=e=>{e.preventDefault();if(!loaded)return;run(async()=>{const result=await invoke({action:'save',revision:saved?.revision??null,provider:provider.value,model:model.value.trim(),key:key.value.trim()});install(result.state);status.textContent='서버에 저장했습니다. 연결 확인은 별도로 실행하세요.';});};
 $('ai-models').onclick=()=>run(async()=>{status.textContent='모델 목록을 불러오는 중…';const result=await invoke({action:'models',revision:saved?.revision??null,provider:provider.value,key:key.value.trim()});list.replaceChildren(...result.models.map(id=>new Option(id,id)));list.hidden=!result.models.length;list.selectedIndex=-1;status.textContent=result.models.length+'개 모델을 불러왔습니다.'+(result.partial?' 일부 목록입니다.':'')+' 선택하거나 모델 ID를 직접 입력하세요. 생성 지원 여부는 모델별로 확인해야 합니다.';});
 list.onchange=()=>{model.value=list.value;dirty=true;update();status.textContent='선택한 모델을 설정 저장으로 반영하세요.';};
 $('ai-test').onclick=()=>run(async()=>{await invoke({action:'test',revision:saved.revision});status.textContent='연결 확인 완료: 저장한 키로 모델 정보를 조회했습니다. 텍스트 생성·잔액·생성 권한을 보장하는 검사는 아닙니다.';});
 $('ai-delete').onclick=()=>confirm('서버의 AI 설정과 등록된 키를 삭제할까요? 주간 초안과 발행본은 유지됩니다.',async()=>{const result=await invoke({action:'delete',revision:saved.revision});install(result.state);status.textContent='서버 설정과 등록된 키를 삭제했습니다.';});
 window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});window.addEventListener('pagehide',()=>{key.value='';});
 update();
})();

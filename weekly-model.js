/* Shared candidate normalization and editorial validation; no AI-generated claims. */
(function(root){
 const text=(v,max=4000)=>typeof v==='string'?v.trim().slice(0,max):'';
 function previousWeek(now=new Date()){
  const d=new Date(now.getTime()+9*3600000);d.setUTCHours(0,0,0,0);d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));
  const end=new Date(d.getTime()-86400000),start=new Date(d.getTime()-7*86400000);
  return {start:start.toISOString().slice(0,10),end:end.toISOString().slice(0,10)};
 }
 function normalize(payload,start,end){
  if(!Array.isArray(payload?.incidents)||!Number.isInteger(payload.total_results)||payload.total_results<0)throw Error('Invalid AIM response');
  const seen=new Set(),items=[];
  for(const row of payload.incidents){
   const id=String(row.id??''),date=text(row.date,40).slice(0,10),title=text(row.title,500);
   if(!id||!title||!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<start||date>end||seen.has(id))continue;
   seen.add(id);items.push({kind:'risk',id:'aim-'+id,title,date,summary:text(row.summary),source:'https://oecd.ai/en/incidents/'+encodeURIComponent(id),articles:Number.isSafeInteger(row.n_articles)&&row.n_articles>=0?row.n_articles:null,country:text(row.location?.country_code,3),principles:Array.isArray(row.properties?.principles)?row.properties.principles.filter(x=>typeof x==='string').slice(0,30):[]});
  }
  return items.sort((a,b)=>(b.articles??-1)-(a.articles??-1)||b.date.localeCompare(a.date)||a.id.localeCompare(b.id)).slice(0,100);
 }
 function validate(doc,publish=false){
  const errors=[];
  if(!doc||typeof doc!=='object'||!Array.isArray(doc.items)||doc.items.length>30)return ['Invalid briefing document'];
  if(typeof doc.question!=='string'||doc.question.length>1000)errors.push('Invalid weekly question');
  if(publish&&(typeof doc.question!=='string'||!doc.question.trim()||doc.items.length===0||['risk','policy'].some(kind=>doc.items.filter(x=>x?.kind===kind).length>10)))errors.push('핵심 질문과 검토 완료된 이슈가 최소 1개 필요합니다. 각 탭은 최대 10개입니다.');
  const labels={title:'제목',change:'핵심 변화',risk:'위험 연결',policy:'정책·통제 연결',signal:'다음 주 관찰 신호',reason:'선정 이유',source:'근거 원문 URL'};
  const ids=new Set(),counts={risk:0,policy:0};for(const [index,item] of doc.items.entries()){
   const category=['risk','policy'].includes(item?.kind)?item.kind:null;
   const prefix=(category?category.toUpperCase()+' '+(++counts[category])+'번':'이슈 '+(index+1)+'번')+(typeof item?.title==='string'&&item.title.trim()?' 「'+text(item.title,70)+'」':'');
   if(!item||typeof item.id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(item.id)||ids.has(item.id)){errors.push(prefix+': 이슈 ID가 올바르지 않거나 중복됐습니다.');continue;}ids.add(item.id);
   const needs=[];
   if(!category)needs.push('RISK 또는 POLICY 선택');
   for(const [key,label]of Object.entries(labels)){
    if(typeof item[key]!=='string'||item[key].length>(key==='title'?500:4000))needs.push(label+' 형식·길이 확인');
    else if(publish&&!item[key].trim())needs.push(label+' 입력');
   }
   if(typeof item.source==='string'&&item.source&&!/^https:\/\/[^\s/]+/.test(item.source))needs.push('근거 원문 URL을 https:// 주소로 수정');
   if(publish&&item.reviewed!==true)needs.push('원문·분석 검토 완료 체크');
   if(needs.length)errors.push(prefix+': '+needs.join(' · '));
  }return errors;
 }
 function policies(rows,start,end){return rows.filter(x=>Number.isSafeInteger(x.id)&&typeof x.updatedAt==='string'&&x.updatedAt.slice(0,10)>=start&&x.updatedAt.slice(0,10)<=end&&typeof x.englishName==='string').map(x=>({kind:'policy',id:'policy-'+x.id,title:text(x.englishName,500),date:x.updatedAt.slice(0,10),summary:text(x.description),source:x.slug?'https://oecd.ai/en/dashboards/policy-initiatives/'+encodeURIComponent(x.slug):'https://oecd.ai/en/dashboards/policy-initiatives',country:text(x.gaiinCountry?.code,3),dateBasis:'OECD registry updatedAt; not enactment or announcement date'})).sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id)).slice(0,100);}
 const api={previousWeek,normalize,policies,validate};if(typeof module!=='undefined')module.exports=api;root.aiRiskWeekly=api;
})(typeof window==='undefined'?globalThis:window);

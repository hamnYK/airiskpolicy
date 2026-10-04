const {test}=require('node:test'),assert=require('node:assert/strict');
const fixture={week_start:'2026-09-28',draft:{question:'What changed for privacy?'},candidates:[{id:'risk-1',kind:'risk',title:'Personal information exposure incident',summary:'Personal information was exposed by an AI service.',source:'https://example.com/risk'},{id:'policy-1',kind:'policy',title:'Unrelated transport policy',summary:'Road design policy.',source:'https://example.com/policy'}]};
const row={id:'risk-1',evidence:'Personal information was exposed',change:'자료상 개인정보 노출',risk:'노출 범위는 추가 확인 필요',policy:'자료에서 확인되지 않음',reason:'질문의 개인정보 문제와 직접 관련',signal:'노출 범위가 추가 확인되는가?'};
test('selection accepts zero/one grounded candidates, preserves source/title, rejects inventions and quota padding',async()=>{
 const {selectionInput,validateSelection}=await import('../supabase/functions/weekly-ai-settings/selection.mjs');const input=selectionInput(fixture);
 assert.equal(validateSelection({note:'관련 자료 없음',items:[]},input,fixture).items.length,0);
 const selected=validateSelection({note:'관련 사건 1건',items:[{...row,title:'Invented title',source:'https://attacker.example',reviewed:true}]},input,fixture);
 assert.equal(selected.items.length,1);assert.equal(selected.items[0].title,fixture.candidates[0].title);assert.equal(selected.items[0].source,fixture.candidates[0].source);assert.equal(selected.items[0].reviewed,false);assert(selected.items[0].reason.includes(row.evidence));
 for(const items of [[{...row,id:'made-up'}],[row,row],[{...row,evidence:'A fabricated quote absent from the source'}]])assert.throws(()=>validateSelection({note:'test',items},input,fixture));
 const many={...fixture,candidates:Array.from({length:11},(_,i)=>({...fixture.candidates[0],id:'r-'+i}))};assert.throws(()=>validateSelection({note:'padding',items:many.candidates.map(c=>({...row,id:c.id}))},selectionInput(many),many));
 assert.throws(()=>selectionInput({...fixture,draft:{question:''}}));assert(!JSON.stringify(input).includes('key'));
});
test('all AI providers receive the question and candidates; incomplete/refused output fails without draft mutation',async()=>{
 const {selectionInput,generateSelection}=await import('../supabase/functions/weekly-ai-settings/selection.mjs');const before=JSON.stringify(fixture),input=selectionInput(fixture),output={note:'one',items:[row]};
 for(const provider of ['openai','gemini','anthropic']){
  const wrap=text=>provider==='openai'?{status:'completed',output:[{content:[{type:'output_text',text}]}]}:provider==='gemini'?{candidates:[{finishReason:'STOP',content:{parts:[{text}]}}]}:{stop_reason:'end_turn',content:[{type:'text',text}]};
  const result=await generateSelection({provider,key:'fixture-secret',model:'example'},input,async(url,options)=>{const body=JSON.parse(options.body);assert(!url.includes('fixture-secret'));assert(!options.body.includes('fixture-secret'));assert(options.body.includes('privacy'));assert(options.body.includes('risk-1'));assert(options.body.includes('10은 상한이지 목표가 아닙니다'));assert.equal(options.redirect,'error');if(provider==='openai')assert.equal(body.store,false);return new Response(JSON.stringify(wrap(JSON.stringify(output))));});assert.deepEqual(result,output);
  await assert.rejects(generateSelection({provider,key:'x',model:'example'},input,async()=>new Response(JSON.stringify(provider==='openai'?{status:'incomplete'}:provider==='gemini'?{candidates:[{finishReason:'MAX_TOKENS'}]}:{stop_reason:'max_tokens'}))),/중단/);
  await assert.rejects(generateSelection({provider,key:'x',model:'example'},input,async()=>new Response('secret error',{status:429})),e=>!e.message.includes('secret error'));
 }
 assert.equal(JSON.stringify(fixture),before);
});

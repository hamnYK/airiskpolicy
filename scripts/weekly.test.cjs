const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{PGlite}=require('@electric-sql/pglite'),model=require('../weekly-model.js');
test('publish guidance identifies each issue and exact missing fields without approving AI drafts',()=>{
 const item={id:'one',kind:'risk',title:'검토 대상',change:'변화',risk:'위험',policy:'정책',signal:'신호',reason:'이유',source:'https://example.com',reviewed:false};
 const doc={question:'질문',items:[item,{...item,id:'two',kind:'policy',reason:'',source:''}]};
 const errors=model.validate(doc,true);assert.equal(errors.length,2);assert.match(errors[0],/RISK 1번.*검토 대상.*검토 완료 체크/);assert.match(errors[1],/POLICY 1번.*선정 이유 입력.*근거 원문 URL 입력.*검토 완료 체크/);
 assert.deepEqual(model.validate(doc),[]);assert.equal(item.reviewed,false);
 assert.doesNotThrow(()=>model.validate({...doc,items:[{...item,reason:42}]},true));
 assert.deepEqual(model.validate({question:'질문',items:[{...item,reviewed:true}]},true),[]);
});
test('weekly dates use the previous completed KST week; candidate ordering is bounded and deduplicated',()=>{
 assert.deepEqual(model.previousWeek(new Date('2026-10-04T21:00:00Z')),{start:'2026-09-28',end:'2026-10-04'});
 assert.deepEqual(model.previousWeek(new Date('2026-10-04T14:59:59Z')),{start:'2026-09-21',end:'2026-09-27'});
 const rows=[{id:1,title:'A',date:'2026-09-29',n_articles:2},{id:2,title:'B',date:'2026-09-30',n_articles:5},{id:2,title:'duplicate',date:'2026-09-30'},{id:3,title:'outside',date:'2026-09-20'}];
 assert.deepEqual(model.normalize({incidents:rows,total_results:4},'2026-09-28','2026-10-04').map(x=>x.id),['aim-2','aim-1']);
 const policies=model.policies([{id:1,englishName:'Policy',updatedAt:'2026-09-30T00:00:00Z',updatedByEmail:'private@example.com'}],'2026-09-28','2026-10-04');assert.equal(policies[0].kind,'policy');assert(!JSON.stringify(policies).includes('private@example.com'));
});
test('weekly SQL protects drafts, allows partial reviewed briefings, locks revisions, preserves draft on collection',async t=>{
 const db=new PGlite();t.after(()=>db.close());const admin='11111111-1111-4111-8111-111111111111',member='22222222-2222-4222-8222-222222222222';
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;create function auth.role() returns text language sql stable as $$ select current_setting('request.jwt.claim.role',true) $$;grant usage on schema public to anon,authenticated,service_role;insert into auth.users values('${admin}'),('${member}');`);
 for(const file of ['202610040001_ontology_admin.sql','202610050002_weekly_briefing.sql','202610050004_weekly_flexible_counts.sql'])await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations',file),'utf8'));
 await db.exec(`insert into airisk_private.ontology_admins(user_id) values('${admin}')`);
 const role=async(name,id='')=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role',$2,false)",[id,name]);await db.exec('set role '+name);};
 const rpc=async(name,values=[],types=[])=> (await db.query('select public.airisk_weekly_'+name+'('+values.map((_,i)=>'$'+(i+1)+'::'+types[i]).join(',')+') as result',values)).rows[0].result;
 await role('anon');assert.equal(await rpc('public'),null);await assert.rejects(rpc('state'),/permission denied/);await assert.rejects(db.exec('select * from airisk_private.weekly_briefings'),/permission denied/);
 await role('authenticated',member);await assert.rejects(rpc('state'),/administrator/);
 await role('authenticated',admin);let state=await rpc('state',['2026-09-28'],['date']);await assert.rejects(rpc('publish',[state.week_start,null,false],['date','uuid','boolean']),/Another editor/);
 const doc={question:'Synthetic test briefing',items:['risk','policy'].flatMap(kind=>Array.from({length:10},(_,i)=>({id:kind+i,kind,title:'Test '+i,change:'Change',risk:'Risk',policy:'Policy',signal:'Signal',reason:'Reason',source:'https://example.com/evidence',reviewed:true})))};
 assert.deepEqual(model.validate(doc,true),[]);const partial=structuredClone(doc);partial.items.pop();assert.deepEqual(model.validate(partial,true),[]);
 state=await rpc('save',['2026-09-28',state.revision,partial],['date','uuid','jsonb']);state=await rpc('publish',['2026-09-28',state.revision,false],['date','uuid','boolean']);
 for(const kind of ['risk','policy']){const small={...doc,items:doc.items.filter(x=>x.kind===kind).slice(0,1)};assert.deepEqual(model.validate(small,true),[]);state=await rpc('save',['2026-09-28',state.revision,small],['date','uuid','jsonb']);state=await rpc('publish',['2026-09-28',state.revision,false],['date','uuid','boolean']);assert.deepEqual((await rpc('public')).document,small);}
 for(const invalid of [{...doc,items:[]},{...doc,items:[...doc.items,{...doc.items[0],id:'extra'}]},{...doc,items:[{...doc.items[0],reviewed:false}]}]){assert(model.validate(invalid,true).length);state=await rpc('save',['2026-09-28',state.revision,invalid],['date','uuid','jsonb']);await assert.rejects(rpc('publish',['2026-09-28',state.revision,false],['date','uuid','boolean']));}
 state=await rpc('publish',['2026-09-28',state.revision,true],['date','uuid','boolean']);
 state=await rpc('save',['2026-09-28',state.revision,doc],['date','uuid','jsonb']);assert.equal(await rpc('public'),null);
 await role('service_role');await rpc('ingest',['2026-09-28',[],{source:'fixture'}],['date','jsonb','jsonb']);
 await role('authenticated',admin);const current=await rpc('state',['2026-09-28'],['date']);assert.deepEqual(current.draft,doc);assert.equal(current.revision,state.revision);
 state=await rpc('publish',['2026-09-28',state.revision,false],['date','uuid','boolean']);await role('anon');assert.deepEqual((await rpc('public')).document,doc);
 await role('authenticated',admin);await rpc('publish',['2026-09-28',state.revision,true],['date','uuid','boolean']);await role('anon');assert.equal(await rpc('public'),null);
});

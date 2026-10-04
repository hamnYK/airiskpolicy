const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{PGlite}=require('@electric-sql/pglite');
test('AI provider calls use fixed origins, headers, metadata only, and redact errors',async()=>{
 const {inspectModels}=await import('../supabase/functions/weekly-ai-settings/provider.mjs');
 for(const provider of ['gemini','openai','anthropic']){
  let request;const result=await inspectModels({provider,key:'test-key-never-public',model:'example-model'},'models',async(url,options)=>{request={url:String(url),options};return new Response(JSON.stringify(provider==='gemini'?{models:[{name:'models/example-model',supportedGenerationMethods:['generateContent']}],nextPageToken:'more'}:{data:[{id:'example-model'}],has_more:true}));});
  assert.deepEqual(result,{models:['example-model'],partial:true});assert(!request.url.includes('test-key'));assert.equal(request.options.redirect,'error');assert.equal(request.options.method,undefined);
  await assert.rejects(inspectModels({provider,key:'test-key',model:'example'},'test',async()=>new Response('test-key sensitive body',{status:401})),e=>!e.message.includes('test-key')&&e.message.includes('API 키'));
 }
 await assert.rejects(inspectModels({provider:'http://localhost',key:'x',model:'x'},'models'),/제공자/);
});
test('AI settings require administrator server; redact state; retain/rotate/delete key; reject stale edits',async t=>{
 const db=new PGlite();t.after(()=>db.close());const admin='11111111-1111-4111-8111-111111111111',member='22222222-2222-4222-8222-222222222222';
 // Vault is unavailable in PGlite: emulate its API to test permissions and transactions only.
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;create function auth.role() returns text language sql stable as $$ select current_setting('request.jwt.claim.role',true) $$;grant usage on schema public to anon,authenticated,service_role;insert into auth.users values('${admin}'),('${member}');create schema vault;create table vault.secrets(id uuid primary key default gen_random_uuid(),secret text);create view vault.decrypted_secrets as select id,secret as decrypted_secret from vault.secrets;create function vault.create_secret(value text) returns uuid language sql as $$ insert into vault.secrets(secret) values(value) returning id $$;create function vault.update_secret(secret_id uuid,value text) returns void language sql as $$ update vault.secrets set secret=value where id=secret_id $$;`);
 for(const file of ['202610040001_ontology_admin.sql','202610050005_weekly_ai_settings.sql'])await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations',file),'utf8'));
 await db.exec(`insert into airisk_private.ontology_admins(user_id) values('${admin}')`);
 const role=async(name,id='')=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role',$2,false)",[id,name]);await db.exec('set role '+name);};
 const state=async()=> (await db.query('select public.airisk_weekly_ai_state() as result')).rows[0].result;
 const call=async(action,revision=null,provider=null,model=null,key=null,actor=admin)=>(await db.query('select public.airisk_weekly_ai_server($1::uuid,$2,$3::uuid,$4,$5,$6) as result',[actor,action,revision,provider,model,key])).rows[0].result;
 await role('anon');await assert.rejects(state());await assert.rejects(call('credentials'));
 await role('authenticated',member);await assert.rejects(state(),/administrator/);
 await role('authenticated',admin);assert.equal(await state(),null);await assert.rejects(call('save',null,'gemini','example','fixture-key'));
 await assert.rejects(db.exec('select * from vault.decrypted_secrets'));await assert.rejects(db.exec('select * from airisk_private.weekly_ai_settings'));
 await role('service_role');await assert.rejects(call('save',null,'gemini','example','fixture-key',member));await call('save',null,'gemini','example','fixture-key');
 await role('authenticated',admin);let s=await state();assert(!JSON.stringify(s).includes('fixture-key'));assert(!('secret_id' in s));assert(s.key_registered);
 await role('service_role');await assert.rejects(call('save',null,'gemini','example','wrong-key'),/changed/);await assert.rejects(call('save',s.revision,'openai','example',null),/requires/);await call('save',s.revision,'gemini','changed',null);
 await role('authenticated',admin);s=await state();await role('service_role');assert.equal((await call('credentials',s.revision)).key,'fixture-key');await assert.rejects(call('credentials',s.revision),/Wait/);await call('save',s.revision,'openai','new-model','rotated-fixture-key');
 await role('authenticated',admin);s=await state();assert.equal(s.provider,'openai');await role('service_role');await call('delete',s.revision);await role('authenticated',admin);assert.equal(await state(),null);await db.exec('reset role');assert.equal((await db.query('select count(*)::int as n from vault.secrets')).rows[0].n,0);
});

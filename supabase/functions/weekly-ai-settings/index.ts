import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import { inspectModels } from './provider.mjs';
import { settingsFailure } from './errors.mjs';
import { selectionInput,generateSelection,validateSelection } from './selection.mjs';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers});
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply(405,{error:'POST required'});
 try{
  const url=Deno.env.get('SUPABASE_URL')!,server=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
  const token=req.headers.get('Authorization')?.replace(/^Bearer /,'');if(!token)return reply(401,{error:'관리자 로그인이 필요합니다.'});
  const user=await server.auth.getUser(token);if(user.error||!user.data.user)return reply(401,{error:'로그인이 만료되었습니다.'});
  const actor=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:'Bearer '+token}},auth:{persistSession:false}});
  const check=await actor.rpc('airisk_weekly_ai_state');if(check.error)return reply(403,{error:'관리자 권한이 필요합니다.'});
  const raw=await req.text();if(raw.length>12000)return reply(413,{error:'입력이 너무 큽니다.'});
  const body=JSON.parse(raw);if(!['save','delete','models','test','generate'].includes(body.action))return reply(400,{error:'지원하지 않는 작업입니다.'});
  let weekly:any,input:any;
  if(body.action==='generate'){
   if(typeof body.week!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(body.week))return reply(400,{error:'검토 주를 선택하세요.'});
   const loaded=await actor.rpc('airisk_weekly_state',{p_week:body.week});
   if(loaded.error||!loaded.data||loaded.data.revision!==body.week_revision)return reply(409,{error:'주간 초안이 변경되었습니다. 저장본을 다시 불러오세요.'});
   weekly=loaded.data;try{input=selectionInput(weekly);}catch(e){return reply(400,{error:(e as Error).message});}
   if(!input.candidates.length)return reply(200,{proposal:{question:weekly.draft.question,items:[],note:'수집된 후보가 없어 선정하지 않았습니다. 후보를 먼저 수집하세요.'},week_revision:weekly.revision});
  }
  if(body.action==='models'&&typeof body.key==='string'&&body.key){
   if(!['openai','gemini','anthropic'].includes(body.provider)||body.key.length<8||body.key.length>4096||/\s/.test(body.key))return reply(400,{error:'제공자와 키 형식을 확인하세요.'});
   try{return reply(200,await inspectModels({provider:body.provider,key:body.key,model:''},'models'));}catch(e){return reply(502,{error:(e as Error).message});}
  }
  if(body.action==='models'&&body.provider!==check.data?.provider)return reply(400,{error:'선택한 제공자의 키를 입력하세요.'});
  const args={p_actor:user.data.user.id,p_action:['models','test','generate'].includes(body.action)?'credentials':body.action,p_revision:body.revision??null,...(body.action==='save'?{p_provider:body.provider,p_model:body.model,p_key:body.key||null}:{})};
  const result=await server.rpc('airisk_weekly_ai_server',args);
  if(result.error){const failure=settingsFailure(result.error);return reply(failure.status,{error:failure.error,code:failure.code});}
  if(body.action==='generate'){
   try{
    const proposal=validateSelection(await generateSelection(result.data,input),input,weekly);
    const latest=await actor.rpc('airisk_weekly_state',{p_week:body.week});
    if(latest.error||latest.data.revision!==weekly.revision||JSON.stringify(latest.data.candidates)!==JSON.stringify(weekly.candidates))return reply(409,{error:'생성 중 초안 또는 후보가 변경되었습니다. 최신 자료로 다시 요청하세요.'});
    return reply(200,{proposal,week_revision:weekly.revision,provider:result.data.provider,model:result.data.model});
   }catch(e){return reply(502,{error:(e as Error).message});}
  }
  if(['models','test'].includes(body.action)){
   try{return reply(200,await inspectModels(result.data,body.action));}catch(e){return reply(502,{error:(e as Error).message});}
  }
  const state=await actor.rpc('airisk_weekly_ai_state');if(state.error)return reply(500,{error:'처리 후 상태 조회에 실패했습니다. 다시 불러오세요.'});
  return reply(200,{state:state.data});
 }catch{return reply(400,{error:'요청을 처리하지 못했습니다. 로그인과 입력을 확인해 주세요.'});}
});

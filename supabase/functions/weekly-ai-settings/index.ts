import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import { inspectModels } from './provider.mjs';
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
  const body=JSON.parse(raw);if(!['save','delete','models','test'].includes(body.action))return reply(400,{error:'지원하지 않는 작업입니다.'});
  if(body.action==='models'&&typeof body.key==='string'&&body.key){
   if(!['openai','gemini','anthropic'].includes(body.provider)||body.key.length<8||body.key.length>4096||/\s/.test(body.key))return reply(400,{error:'제공자와 키 형식을 확인하세요.'});
   try{return reply(200,await inspectModels({provider:body.provider,key:body.key,model:''},'models'));}catch(e){return reply(502,{error:(e as Error).message});}
  }
  if(body.action==='models'&&body.provider!==check.data?.provider)return reply(400,{error:'선택한 제공자의 키를 입력하세요.'});
  const args={p_actor:user.data.user.id,p_action:['models','test'].includes(body.action)?'credentials':body.action,p_revision:body.revision??null,...(body.action==='save'?{p_provider:body.provider,p_model:body.model,p_key:body.key||null}:{})};
  const result=await server.rpc('airisk_weekly_ai_server',args);
  if(result.error){const code=result.error.code;return reply(code==='40001'?409:400,{error:code==='40001'?'다른 창에서 설정이 변경되었습니다. 저장본을 다시 불러오세요.':code==='P0001'?'잠시 후 다시 시도해 주세요.':code==='22023'?'제공자·모델·키를 확인하고 먼저 설정을 저장하세요.':'설정을 처리하지 못했습니다.'});}
  if(['models','test'].includes(body.action)){
   try{return reply(200,await inspectModels(result.data,body.action));}catch(e){return reply(502,{error:(e as Error).message});}
  }
  const state=await actor.rpc('airisk_weekly_ai_state');if(state.error)return reply(500,{error:'처리 후 상태 조회에 실패했습니다. 다시 불러오세요.'});
  return reply(200,{state:state.data});
 }catch{return reply(400,{error:'요청을 처리하지 못했습니다. 로그인과 입력을 확인해 주세요.'});}
});

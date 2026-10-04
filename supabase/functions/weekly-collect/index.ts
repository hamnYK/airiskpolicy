import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import '../../../weekly-model.js';
const model=(globalThis as any).aiRiskWeekly;
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info,x-weekly-secret','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers:cors});
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return reply(405,{error:'POST required'});
 try{
  const url=Deno.env.get('SUPABASE_URL')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,secret=Deno.env.get('WEEKLY_COLLECTOR_SECRET');
  const server=createClient(url,service,{auth:{persistSession:false}});
  const scheduled=!!secret&&req.headers.get('x-weekly-secret')===secret;
  if(!scheduled){
   const token=req.headers.get('Authorization')?.replace(/^Bearer /,'');if(!token)return reply(401,{error:'Administrator login required'});
   const {data,error}=await server.auth.getUser(token);if(error||!data.user)return reply(401,{error:'Invalid login'});
   const actor=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:'Bearer '+token}},auth:{persistSession:false}});
   const check=await actor.rpc('airisk_weekly_state');if(check.error)return reply(403,{error:'Administrator only'});
  }
  const body=await req.json().catch(()=>({})),period=model.previousWeek();
  const start=scheduled?period.start:(body.week||period.start),d=new Date(start+'T00:00:00Z');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==start||d.getUTCDay()!==1||start>period.start||d.getTime()<Date.now()-370*86400000)return reply(400,{error:'Choose a completed Monday–Sunday week within the past year'});
  const end=new Date(d.getTime()+6*86400000).toISOString().slice(0,10);
  const response=await fetch('https://incidents-server.oecdai.org/api/v1/incidents/fetch-incidents',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({search_terms:[],and_condition:false,from_date:start,to_date:end,properties_config:{principles:[],industries:[],harm_types:[],harm_levels:[],harmed_entities:[],business_functions:[],ai_tasks:[],autonomy_levels:[],languages:[]},order_by:'date',num_results:100,countries:[],format:'JSON'}),signal:AbortSignal.timeout(45000)});
  if(!response.ok)return reply(502,{error:'AIM source unavailable; existing draft was preserved'});
  const raw=await response.json(),candidates=model.normalize(raw,start,end),signal=AbortSignal.timeout(110000);
  async function policyPage(page:number){const r=await fetch('https://api.oecdai.org/policy-initiatives/public?page='+page,{signal});if(!r.ok)throw Error('Policy source unavailable');const p=await r.json();if(!Array.isArray(p.data)||p.currentPage!==page||!Number.isInteger(p.lastPage)||p.lastPage<1||p.lastPage>200||!Number.isInteger(p.total))throw Error('Policy pagination changed');return p;}
  const first=await policyPage(1),rows=[...first.data];
  for(let page=2;page<=first.lastPage;page+=8){const pages=await Promise.all(Array.from({length:Math.min(8,first.lastPage-page+1)},(_,i)=>policyPage(page+i)));for(const p of pages){if(p.total!==first.total||p.lastPage!==first.lastPage)throw Error('Policy catalogue changed during collection');rows.push(...p.data);}}
  if(rows.length!==first.total||new Set(rows.map(x=>x.id)).size!==rows.length)throw Error('Incomplete policy catalogue');
  const policyCandidates=model.policies(rows,start,end);candidates.push(...policyCandidates);
  const collection={source:'OECD AIM + OECD AI Policy Navigator',fetchedAt:new Date().toISOString(),start,end,riskTotal:raw.total_results,riskReceived:raw.incidents.length,policyScanned:rows.length,policyEligible:rows.filter(x=>x.updatedAt?.slice(0,10)>=start&&x.updatedAt?.slice(0,10)<=end).length,eligible:candidates.length,limitPerTab:100,order:'RISK: related article count then date. POLICY: registry updatedAt. Neither is an importance score.',scope:'AIM sample and policy registry updates. A registry update is not a new policy announcement; verify original sources before publication.'};
  const {error}=await server.rpc('airisk_weekly_ingest',{p_week:start,p_candidates:candidates,p_collection:collection});
  if(error)return reply(500,{error:'Candidate storage failed; publication unchanged'});
  return reply(200,{week:start,candidates:candidates.length,total:raw.total_results});
 }catch{return reply(502,{error:'Collection failed; existing draft and publication were preserved'});}
});

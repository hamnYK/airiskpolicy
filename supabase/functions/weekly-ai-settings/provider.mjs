// Fixed provider origins; no client-provided URL or credential in a query string.
export async function inspectModels(config,action,fetcher=fetch){
 const bases={openai:'https://api.openai.com/v1/models',gemini:'https://generativelanguage.googleapis.com/v1beta/models',anthropic:'https://api.anthropic.com/v1/models'};
 const base=bases[config.provider];if(!base)throw Error('지원하지 않는 제공자입니다.');
 const headers=config.provider==='openai'?{Authorization:'Bearer '+config.key}:config.provider==='gemini'?{'x-goog-api-key':config.key}:{'x-api-key':config.key,'anthropic-version':'2023-06-01'};
 const model=config.model.replace(/^models\//,'');
 const url=new URL(base+(action==='test'?'/'+encodeURIComponent(model):''));
 if(action==='models'){if(config.provider==='gemini')url.searchParams.set('pageSize','1000');if(config.provider==='anthropic')url.searchParams.set('limit','1000');}
 let response;try{response=await fetcher(url,{headers,redirect:'error',signal:AbortSignal.timeout(20000)});}catch{throw Error('제공자 연결이 실패했거나 시간이 초과되었습니다.');}
 if(!response.ok)throw Error(({401:'API 키를 확인해 주세요.',403:'API 키의 모델 조회 권한을 확인해 주세요.',404:'모델 ID를 확인해 주세요.',429:'제공자의 요청 한도 또는 잔액을 확인해 주세요.'})[response.status]||'제공자가 요청을 처리하지 못했습니다.');
 let data;try{data=await response.json();}catch{throw Error('제공자의 응답 형식이 올바르지 않습니다.');}
 if(action==='test'){if(!(typeof data.id==='string'||typeof data.name==='string'))throw Error('모델 정보를 확인하지 못했습니다.');return {verified:true};}
 const rows=config.provider==='gemini'?data.models:data.data;if(!Array.isArray(rows))throw Error('모델 목록을 확인하지 못했습니다.');
 const models=rows.filter(m=>config.provider!=='gemini'||m.supportedGenerationMethods?.includes('generateContent')).map(m=>config.provider==='gemini'?m.name?.replace(/^models\//,''):m.id).filter(m=>typeof m==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/.test(m));
 return {models:[...new Set(models)].sort().slice(0,1000),partial:!!(data.nextPageToken||data.has_more)||models.length>1000};
}

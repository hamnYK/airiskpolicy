// Expose only known messages and a bounded code, never raw database error details.
export function settingsFailure(error){
 const code=/^[A-Z0-9]{5,12}$/.test(error?.code||'')?error.code:'UNKNOWN';
 if(code==='21000'){
  const stages=['authorize','lock','state','revision','dispatch','save','delete','credentials','vault_read'];
  const stage=String(error.message||'').replace(/^AI_SETTINGS_CARDINALITY:/,'');
  return {status:500,error:'서버 설정 조회 오류: 21000 · '+(stages.includes(stage)?stage:'api_result'),code};
 }
 if(code==='40001')return {status:409,error:'다른 창에서 설정이 변경되었습니다. 저장본을 다시 불러오세요.',code};
 if(code==='42501')return {status:403,error:'서버의 AI 설정 접근 권한을 확인해야 합니다.',code};
 if(code==='22023')return {status:400,error:'제공자·모델·키를 확인하고 먼저 설정을 저장하세요.',code};
 if(code==='P0001'&&error.message==='Wait before retrying')return {status:429,error:'요청 간격은 최소 5초입니다. 잠시 후 다시 시도해 주세요.',code};
 if(code==='P0001'&&error.message==='Key unavailable')return {status:500,error:'서버에서 등록된 키를 읽지 못했습니다. AI 설정을 확인해야 합니다.',code};
 return {status:500,error:'서버가 AI 설정을 처리하지 못했습니다. 오류 코드: '+code,code};
}

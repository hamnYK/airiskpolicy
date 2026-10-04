'use strict';
(() => {
  let pending;
  const client = () => pending ||= (async () => {
    const response = await fetch('../supabase-config.json', { cache: 'no-store', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw Error('Supabase 공개 연결 설정을 불러오지 못했습니다.');
    const config = await response.json();
    if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(config.url) || !config.publishableKey?.startsWith('sb_publishable_')) throw Error('Supabase URL과 Publishable key 설정을 확인하세요.');
    return window.supabase.createClient(config.url, config.publishableKey, { auth: { storage: sessionStorage, storageKey: 'airisk-ontology-admin', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
  })().catch(error => { pending = null; throw error; });
  function describe(error) {
    if (/Invalid API key/i.test(error.message || '')) return 'Supabase 공개 키가 유효하지 않습니다. 프로젝트의 API Keys 설정을 확인하세요.';
    if (error.code === '42501') return '이 계정에는 온톨로지 관리자 권한이 없습니다.';
    if (error.code === '40001') return '다른 창에서 변경되었습니다. JSON을 보관한 뒤 최신본을 불러오세요.';
    if (error.code === 'PGRST202') return 'Supabase 온톨로지 마이그레이션이 아직 적용되지 않았습니다.';
    if (/JWT|session|refresh token/i.test(error.message || '')) return '로그인이 만료되었습니다. 초안 JSON을 보관하고 다시 로그인하세요.';
    return error.message || 'Supabase 요청에 실패했습니다.';
  }
  async function rpc(name, params = {}) {
    const supabase = await client();
    const { data, error } = await supabase.rpc(name, params);
    if (error) throw Error(describe(error)); return data;
  }
  window.aiRiskAdmin = { client, describe, rpc };
})();

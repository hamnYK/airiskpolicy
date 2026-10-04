'use strict';
(() => {
  const state = { data: null, status: 'loading' };
  window.aiRiskOntologyState = state;
  async function load() {
    state.status = 'loading'; document.dispatchEvent(new CustomEvent('ontology:changed'));
    try {
      const config = await fetch('ontology-config.json', { cache: 'no-store', signal: AbortSignal.timeout(15000) });
      if (!config.ok) throw Error('configuration');
      const settings = await config.json();
      let url, headers = {};
      if (settings.provider === 'supabase') {
        const connection = await fetch('supabase-config.json', { cache: 'no-store', signal: AbortSignal.timeout(15000) });
        if (!connection.ok) throw Error('supabase configuration');
        const { url: base, publishableKey } = await connection.json();
        if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(base) || !publishableKey?.startsWith('sb_publishable_')) throw Error('supabase configuration');
        url = new URL('/rest/v1/rpc/airisk_ontology_published', base);
        headers.apikey = publishableKey;
      } else {
        url = new URL(settings.endpoint, location.href);
        if (url.origin !== location.origin && url.protocol !== 'https:') throw Error('endpoint');
      }
      const response = await fetch(url, { headers, credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw Error('ontology');
      const data = await response.json();
      if (window.aiRiskOntology.validate(data).length) throw Error('schema');
      state.data = data; state.status = 'ready';
    } catch { state.data = null; state.status = 'error'; }
    document.dispatchEvent(new CustomEvent('ontology:changed'));
  }
  state.reload = load; load();
})();

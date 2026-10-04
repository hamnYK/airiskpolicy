'use strict';
(() => {
  const L = (ko, en) => document.documentElement.lang === 'ko' ? ko : en;
  const make = (tag, cls, text) => { const el = document.createElement(tag); if (cls) el.className = cls; if (text !== undefined) el.textContent = text; return el; };
  const button = (text, action) => { const b = make('button', 'ds-secondary', text); b.type = 'button'; b.onclick = action; return b; };
  let risk = null, selectedCode = null, filter = 'all', page = 0, analysis = null;
  const section = make('section', 'gap-analyzer'); section.id = 'gap-analyzer'; section.dataset.noTranslate = 'true'; section.setAttribute('aria-labelledby', 'gap-title');
  document.getElementById('observatory').after(section);
  const entry = make('a', 'journey-link', 'RISK ◀ Gap Analyzer ▶ POLICY'); entry.href = '#gap-analyzer'; entry.dataset.noTranslate = 'true';
  document.getElementById('policy-panel').append(entry);
  const names = () => ({ all: L('전체 기록', 'All records'), candidate: L('매칭 후보 있음', 'Candidates found'), unmatched: L('후보 미발견', 'No candidate found'), insufficient: L('분류 정보 부족', 'Insufficient labels') });
  function render() {
    const focused = section.contains(document.activeElement) ? document.activeElement.dataset.focus : null;
    const ontologyState = window.aiRiskOntologyState;
    analysis = ontologyState?.status === 'ready' ? window.aiRiskGap.analyze(risk, window.aiRiskPolicy?.snapshot(), ontologyState.data) : null;
    if (analysis && analysis.country.code !== selectedCode) analysis = null;
    section.replaceChildren();
    section.append(make('p', 'eyebrow', 'RISK ◀▶ POLICY'), Object.assign(make('h2', '', 'Gap Analyzer'), { id: 'gap-title' }),
      make('p', 'ds-muted', L('위험 기록과 정책을 연결하고, 더 확인할 빈틈을 찾습니다.', 'Connect risk records to policies and identify what needs further investigation.')));
    const state = make('p', 'gap-state'); state.setAttribute('role', 'status'); section.append(state);
    if (ontologyState?.status !== 'ready') {
      state.textContent = ontologyState?.status === 'error' ? L('온톨로지를 불러오거나 검증하지 못했습니다. 분석을 중단했습니다.', 'The ontology could not be loaded or validated. Analysis is unavailable.') : L('발행된 온톨로지를 불러오는 중…', 'Loading the published ontology…');
      if (ontologyState?.status === 'error') section.append(button(L('온톨로지 다시 조회', 'Retry ontology lookup'), () => ontologyState.reload()));
      return;
    }
    if (!analysis) {
      const error = ['risk-state', 'policy-state'].some(id => document.getElementById(id).dataset.state === 'error');
      state.textContent = error ? L('조회 실패로 분석할 수 없습니다. RISK 또는 POLICY의 다시 조회를 이용해 주세요.', 'Analysis is unavailable after a lookup failure. Retry the RISK or POLICY lookup.') : L('같은 국가의 RISK와 POLICY 조회가 모두 완료되면 분석합니다. 지도에서 국가를 선택해 주세요.', 'Analysis starts when RISK and POLICY data for the same country are available. Select a country on the map.');
      state.dataset.state = error ? 'error' : 'info'; return;
    }
    const a = analysis;
    section.append(make('p', 'ds-muted', L('온톨로지 발행본: ', 'Ontology version: ') + (a.ontologyVersion || '—')), button(L('최신 온톨로지 반영', 'Reload published ontology'), () => ontologyState.reload()));
    state.textContent = a.country.code + ' · ' + L('위험 표본 ', 'Risk sample ') + a.sampleCount + ' / ' + a.riskTotal + ' · ' + L('등록 정책 ', 'Registered policies ') + a.policyCount;
    section.append(make('p', 'ds-muted', (a.from || '—') + ' — ' + (a.to || '—') + ' · ' + L('최신 수신 표본 기준 · 조회 시각: ', 'Latest received sample · Retrieved: ') + L('위험 ', 'Risk ') + new Date(a.riskFetchedAt).toLocaleString() + ' / ' + L('정책 ', 'Policy ') + new Date(a.policyFetchedAt).toLocaleString()));
    const metrics = make('div', 'gap-metrics');
    for (const key of ['candidate', 'unmatched', 'insufficient']) {
      const card = button('', () => { filter = key; page = 0; render(); }); card.dataset.focus = key; card.dataset.status = key; card.setAttribute('aria-pressed', String(filter === key));
      card.append(make('strong', '', String(a.counts[key])), make('span', '', names()[key])); metrics.append(card);
    }
    section.append(metrics);
    const method = make('details', 'gap-method'); method.append(make('summary', '', L('매칭 방법과 해석', 'Matching method and interpretation')),
      make('p', '', L('동일 국가에서 공통 AI 원칙, 검토 완료된 개념·별칭, 위험 → 통제수단 ← 정책 연결을 비교합니다. 온톨로지 근거 수, 공통 원칙 수 순으로 정렬합니다. 정책 연결 기간은 위험 조회 종료일 기준이며 사건 발생 당시 적용 여부는 별도 확인이 필요합니다. 등록 상태와 관계없이 전체 정책을 비교하며 매칭은 적용·집행·효과의 확정이 아닙니다.', 'Candidates use shared AI principles, reviewed concepts and aliases, and risk → control ← policy paths in the same country. They are ordered by ontology evidence count, then shared principles. Binding dates use the risk query end date, not the historical incident date. All policy statuses are included; matches do not establish coverage, enforcement or effectiveness.')),
      make('p', '', L('AI 원칙이 없는 정책: ', 'Policies without AI principle labels: ') + a.unclassifiedPolicies + '. ' + L('온톨로지로도 후보를 찾지 못했고 위험 원칙 또는 모든 정책의 원칙이 없으면 분류 정보 부족입니다. 정보 누락으로 후보가 빠질 수 있습니다. 후보 미발견은 정책 부재를 뜻하지 않습니다.', 'When ontology paths find no candidate and risk principles or all policy principles are missing, labels are insufficient. Missing information can hide candidates. No candidate does not establish policy absence.')));
    section.append(method);
    const controls = make('div', 'gap-controls');
    for (const key of Object.keys(names())) { const b = button(names()[key], () => { filter = key; page = 0; render(); }); b.dataset.focus = 'filter-' + key; b.setAttribute('aria-pressed', String(filter === key)); controls.append(b); }
    controls.append(button(L('분석 JSON 내려받기', 'Download analysis JSON'), () => {
      const blob = new Blob([JSON.stringify({ ...analysis, generatedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob), link = make('a'); link.href = url; link.download = 'risk-policy-gap-' + analysis.country.code + '.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    })); section.append(controls);
    const rows = a.rows.filter(r => filter === 'all' || r.status === filter);
    page = Math.min(page, Math.max(0, Math.ceil(rows.length / 6) - 1));
    const list = make('div', 'gap-list');
    if (!rows.length) list.append(make('p', 'ds-muted', L('이 조건의 위험 기록이 없습니다.', 'No risk records match this filter.')));
    for (const row of rows.slice(page * 6, page * 6 + 6)) {
      const card = make('article', 'gap-card'); card.dataset.status = row.status;
      card.append(make('p', 'gap-label', names()[row.status]), make('h3', '', row.record.title), make('p', 'ds-muted', row.record.date), make('p', '', L('위험 AI 원칙: ', 'Risk AI principles: ') + (row.principles.join(' · ') || L('미입력', 'Not supplied'))));
      const source = make('a', 'journey-link', L('위험 원문', 'Risk source')); source.href = 'https://oecd.ai/en/incidents/' + encodeURIComponent(row.record.id); source.target = '_blank'; source.rel = 'noopener'; card.append(source);
      if (row.candidates.length) {
        const details = make('details'); details.append(make('summary', '', L('정책 후보 ', 'Policy candidates: ') + row.candidates.length));
        for (const candidate of row.candidates) {
          const item = make('div', 'gap-candidate'), p = candidate.policy;
          item.append(button(L(p.originalName || p.englishName, p.englishName), () => window.aiRiskPolicy.openRecord(p)), make('p', '', L('공통 원칙: ', 'Shared principles: ') + (candidate.sharedPrinciples.join(' · ') || '—')), make('p', 'ds-muted', L('등록 상태: ', 'Inventory status: ') + (p.status || '—') + ' · ' + L('적용·집행·효과 미검증', 'Coverage, enforcement and effectiveness unverified')));
          for (const evidence of candidate.evidence) {
            item.append(make('p', '', L('온톨로지 근거: ', 'Ontology evidence: ') + evidence.label), make('p', 'ds-muted', evidence.note));
            for (const [label, url] of [[L('연결 근거 출처', 'Connection source'), evidence.source], [L('필요 통제수단 근거', 'Required control source'), evidence.relationSource]]) if (url) { const link = make('a', 'journey-link', label); link.href = url; link.target = '_blank'; link.rel = 'noopener'; item.append(link); }
          }
          details.append(item);
        } card.append(details);
      } else card.append(make('p', 'ds-muted', row.status === 'insufficient' ? L('원문에서 분류와 적용 범위를 먼저 확인하세요.', 'Check source classifications and scope first.') : L('등록 정책에서 원문·다른 분류로 추가 탐색이 필요합니다.', 'Further discovery using source text and other classifications is needed.')));
      card.append(button(L('정책 검토·조사 질문으로 이어가기', 'Review policies and investigate gaps'), () => document.dispatchEvent(new CustomEvent('risk:policy-review', { detail: { ...row.record, country: { ...a.country, name: a.country.name || a.country.code } } })))); list.append(card);
    }
    section.append(list);
    const nav = make('div', 'gap-controls'); const previous = button(L('이전', 'Previous'), () => { page--; render(); }), next = button(L('다음', 'Next'), () => { page++; render(); });
    previous.disabled = page === 0; next.disabled = (page + 1) * 6 >= rows.length; previous.dataset.focus = 'previous'; next.dataset.focus = 'next';
    nav.append(previous, make('span', '', (page + 1) + ' / ' + Math.max(1, Math.ceil(rows.length / 6))), next); section.append(nav);
    if (focused) section.querySelector('[data-focus="' + focused + '"]')?.focus({ preventScroll: true });
  }
  document.addEventListener('gis:country-selected', e => { const code = e.detail?.aimCode || e.detail?.code; if (code !== selectedCode) { risk = null; filter = 'all'; page = 0; } selectedCode = code; render(); });
  document.addEventListener('aim:loaded', e => { if (e.detail.country.code !== selectedCode) return; risk = e.detail; page = 0; render(); });
  document.addEventListener('aim:invalidated', () => { risk = null; render(); });
  document.addEventListener('policy:loaded', render);
  document.addEventListener('policy:invalidated', render);
  document.addEventListener('ontology:changed', render);
  let lastLanguage = document.documentElement.lang;
  new MutationObserver(() => {
    if (document.documentElement.lang === lastLanguage) return;
    lastLanguage = document.documentElement.lang;
    render();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  for (const id of ['risk-state', 'policy-state']) new MutationObserver(render).observe(document.getElementById(id), { attributes: true, attributeFilter: ['data-state'] });
  render();
})();

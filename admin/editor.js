'use strict';
(() => {
  const $ = id => document.getElementById(id), model = window.aiRiskOntology;
  const make = (tag, text) => { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; return el; };
  const kinds = { principle: 'AI 원칙', harm: '피해 유형', entity: '보호 대상', control: '통제수단' };
  const groups = { concepts: '개념·별칭', relations: '필요한 통제수단', bindings: '정책 조항 연결' };
  let state, draft, group = 'concepts', selected = null, dirty = false, busy = false;
  function message(text, error = false) { $('message').textContent = text; $('message').classList.toggle('error', error); }
  function mark() { dirty = true; renderVersion(); }
  function renderVersion() { $('version').textContent = (dirty ? '미저장 변경 있음' : '초안 저장됨') + ' · 발행본 ' + (state?.published.version || '—'); $('save').disabled = busy || !state; $('publish').disabled = busy || !state || dirty; }
  function confirm(title, text, action) { $('confirm-title').textContent = title; $('confirm-text').textContent = text; $('accept').onclick = () => { $('confirm').close(); action(); }; $('confirm').showModal(); $('cancel').focus(); }
  $('cancel').onclick = () => $('confirm').close();
  async function api(route, payload) {
    const client = await window.aiRiskAdmin.client();
    if (route === 'logout') { const { error } = await client.auth.signOut({ scope: 'local' }); if (error) throw Error(window.aiRiskAdmin.describe(error)); return; }
    const names = { state: 'airisk_ontology_state', save: 'airisk_ontology_save', publish: 'airisk_ontology_publish' };
    const args = route === 'state' ? {} : { expected_revision: payload.revision, ...(route === 'save' ? { document: payload.ontology } : {}) };
    return window.aiRiskAdmin.rpc(names[route], args);
  }
  function install(next) { state = next; draft = structuredClone(next.draft); dirty = false; render(); }
  async function load() {
    try {
      const client = await window.aiRiskAdmin.client();
      const { data: { user }, error } = await client.auth.getUser();
      if (error || !user) { if (!state) location.replace('login.html'); throw Error('로그인이 만료되었습니다. JSON을 보관하고 다시 로그인하세요.'); }
      install(await api('state')); $('editor').hidden = false; $('access-gate').hidden = true; message('Supabase에서 초안을 불러왔습니다.');
    } catch (e) { if (!state) $('gate-message').textContent = e.message; message(e.message, true); }
  }
  $('reload').onclick = () => dirty ? confirm('편집 내용 버리기', '저장하지 않은 변경을 버리고 서버 최신본을 불러올까요?', load) : load();
  async function mutate(action) {
    const submitted = JSON.stringify(draft);
    busy = true; renderVersion();
    try {
      const next = await api(action, { revision: state.revision, ontology: JSON.parse(submitted) });
      if (JSON.stringify(draft) === submitted) install(next);
      else { state = next; dirty = true; render(); }
      message((action === 'save' ? '초안을 저장했습니다. 발행 전까지 공개 분석에 반영되지 않습니다.' : '발행했습니다. 공개 사이트에서 온톨로지를 다시 불러오면 적용됩니다.') + (dirty ? ' 요청 중 추가한 변경은 아직 저장되지 않았습니다.' : ''));
    }
    catch (e) { message(e.message, true); } finally { busy = false; renderVersion(); }
  }
  $('save').onclick = () => { const errors = model.validate(draft); if (errors.length) return message(errors.join('\n'), true); mutate('save'); };
  $('publish').onclick = () => {
    const errors = model.validate(draft); if (errors.length) return message(errors.join('\n'), true);
    const count = key => draft[key].filter(x => x.review === 'reviewed').length;
    confirm('검토 완료 항목 발행', `개념 ${count('concepts')}개 · 관계 ${count('relations')}개 · 정책 연결 ${count('bindings')}개\n초안 상태의 항목은 제외됩니다. 발행된 출처와 근거 메모는 공개됩니다.\n현재 공개 발행본을 교체할까요?`, () => mutate('publish'));
  };
  $('logout').onclick = () => confirm('로그아웃', dirty ? '저장하지 않은 변경이 있습니다. 로그아웃하면 현재 편집 내용을 잃습니다.' : '관리자 세션을 종료할까요?', async () => { try { await api('logout', {}); dirty = false; location.replace('login.html'); } catch (e) { message(e.message, true); } });
  $('export').onclick = () => { if (!draft) return; const url = URL.createObjectURL(new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' })); const a = make('a'); a.href = url; a.download = 'ontology-draft.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
  $('import').onchange = async e => {
    if (!state) { e.target.value = ''; return message('서버 초안을 먼저 불러오세요.', true); }
    const file = e.target.files[0]; if (!file) return;
    try {
      if (file.size > 1024 * 1024) throw Error('최대 1MB JSON을 가져올 수 있습니다.');
      const data = JSON.parse(await file.text()), errors = model.validate(data); if (errors.length) throw Error(errors.join('\n'));
      confirm('초안 가져오기', '현재 편집 내용을 가져온 JSON으로 교체합니다. 저장·발행은 별도로 진행합니다.', () => { draft = data; selected = null; mark(); render(); message('JSON을 가져왔습니다. 검토 후 초안을 저장하세요.'); });
    } catch (err) { message(err.message, true); } finally { e.target.value = ''; }
  };
  $('add').onclick = () => {
    if (!draft) return;
    const id = group.slice(0, 1) + '-' + crypto.randomUUID().slice(0, 8), base = { id, review: 'draft', source: '', note: '' };
    draft[group].push(group === 'concepts' ? { ...base, kind: 'principle', label: '새 개념', aliases: [] } : group === 'relations' ? { ...base, type: 'requires', from: '', to: '' } : { ...base, policyId: 1, country: 'KOR', control: '', validFrom: '', validTo: '' });
    selected = id; mark(); render();
  };
  $('search').oninput = renderList;
  $('ontology-name').oninput = e => { if (!draft) return; draft.name = e.target.value; mark(); };
  function renderList() {
    $('items').replaceChildren(); if (!draft) return;
    const query = $('search').value.toLowerCase();
    const rows = draft[group].filter(row => JSON.stringify(row).toLowerCase().includes(query));
    for (const row of rows) {
      const b = make('button'); b.type = 'button'; b.setAttribute('aria-current', String(row.id === selected));
      const title = group === 'concepts' ? row.label : group === 'relations' ? row.from + ' → ' + row.to : row.country + ' · 정책 ' + row.policyId + ' → ' + row.control;
      b.append(make('strong', title), make('small', row.id + ' · ' + (row.review === 'reviewed' ? '검토 완료' : '초안'))); b.onclick = () => { selected = row.id; renderList(); renderDetail(); }; $('items').append(b);
    }
    if (!rows.length) $('items').append(make('p', '항목이 없습니다. 새 항목을 추가하세요.'));
  }
  function field(form, row, key, title, options, type = 'text') {
    const label = make('label', title); let input;
    if (options) { input = make('select'); for (const [value, name] of options) { const option = make('option', name); option.value = value; input.append(option); } }
    else { input = make(type === 'textarea' ? 'textarea' : 'input'); if (type !== 'textarea') input.type = type; }
    input.value = key === 'aliases' ? row[key].join('\n') : (row[key] ?? '');
    input.oninput = () => { row[key] = key === 'aliases' ? input.value.split('\n').map(v => v.trim()).filter(Boolean) : key === 'policyId' ? Number(input.value) : input.value; mark(); renderList(); };
    if (['source', 'note', 'aliases'].includes(key)) label.className = 'wide'; label.append(input); form.append(label); return input;
  }
  function renderDetail() {
    const box = $('detail'); box.replaceChildren(); const row = draft?.[group].find(x => x.id === selected);
    if (!row) { box.append(make('p', '목록에서 항목을 선택하거나 새 항목을 추가하세요.')); return; }
    box.append(make('h2', '항목 편집'), make('p', 'ID: ' + row.id)); const form = make('div'); form.className = 'fields';
    const choices = control => [['', '선택하세요'], ...draft.concepts.filter(c => (c.kind === 'control') === control).map(c => [c.id, c.label + ' (' + c.id + ')'])];
    if (group === 'concepts') {
      field(form, row, 'kind', '종류', Object.entries(kinds)); field(form, row, 'label', '대표 이름'); field(form, row, 'aliases', '별칭 · 한 줄에 하나', null, 'textarea');
    } else if (group === 'relations') {
      field(form, row, 'from', '위험·원칙·보호 대상', choices(false)); field(form, row, 'to', '필요한 통제수단', choices(true));
    } else {
      field(form, row, 'policyId', 'OECD 정책 ID', null, 'number'); field(form, row, 'country', '국가 코드 · ISO 3자리'); field(form, row, 'control', '정책이 다루는 통제수단', choices(true));
      field(form, row, 'validFrom', '적용 시작일 · 확인된 경우', null, 'date'); field(form, row, 'validTo', '적용 종료일 · 확인된 경우', null, 'date');
    }
    field(form, row, 'review', '검토 상태', [['draft', '초안 · 분석 제외'], ['reviewed', '검토 완료 · 발행 시 적용']]); field(form, row, 'source', '근거 출처 URL', null, 'url'); field(form, row, 'note', '근거 메모 · 해당 조항·범위·별칭 판단 근거', null, 'textarea'); box.append(form);
    const remove = make('button', '항목 삭제'); remove.className = 'danger';
    remove.onclick = () => {
      if (group === 'concepts' && [...draft.relations.flatMap(r => [r.from, r.to]), ...draft.bindings.map(b => b.control)].includes(row.id)) return message('다른 관계·정책 연결에서 참조 중입니다. 연결부터 수정하거나 삭제하세요.', true);
      confirm('항목 삭제', row.id + ' 항목을 편집 초안에서 삭제할까요?', () => { draft[group] = draft[group].filter(x => x !== row); selected = null; mark(); render(); });
    }; const actions = make('div'); actions.className = 'actions'; actions.append(remove); box.append(actions);
  }
  function render() {
    $('ontology-name').value = draft.name || '';
    renderVersion(); $('tabs').replaceChildren();
    for (const [key, title] of Object.entries(groups)) { const b = make('button', title + ' · ' + draft[key].length); b.setAttribute('aria-pressed', String(group === key)); b.onclick = () => { group = key; selected = null; $('search').value = ''; render(); }; $('tabs').append(b); }
    $('list-title').textContent = groups[group]; renderList(); renderDetail(); $('history').replaceChildren();
    for (const h of state.history) { const row = make('div'); row.className = 'history-row'; const restore = make('button', '초안으로 복원'); restore.onclick = () => confirm('이전 발행본 복원', '편집 초안을 이전 발행본으로 교체합니다. 공개 반영에는 저장·재발행이 필요합니다.', () => { draft = structuredClone(h.ontology); selected = null; mark(); render(); }); row.append(make('span', (h.publishedAt || '초기 발행본') + ' · ' + h.version), restore); $('history').append(row); }
    if (!state.history.length) $('history').append(make('p', '아직 이전 발행본이 없습니다.'));
  }
  $('preview-form').elements.date.value = new Date().toISOString().slice(0, 10);
  $('preview-form').onsubmit = e => {
    e.preventDefault(); if (!draft) return; const errors = model.validate(draft); if (errors.length) return message(errors.join('\n'), true);
    const input = Object.fromEntries(new FormData(e.currentTarget)), split = v => v.split(',').map(x => x.trim()).filter(Boolean);
    const result = window.aiRiskGap.analyze({ country: { code: input.country }, to: input.date, total: 1, records: [{ id: 'preview', properties: Object.fromEntries(['principles', 'harm_types', 'harmed_entities'].map(k => [k, split(input[k])])) }] }, { country: { code: input.country }, records: [{ id: Number(input.policyId), principles: split(input.policyPrinciples) }] }, draft);
    $('preview-result').textContent = JSON.stringify({ status: result.rows[0].status, candidates: result.rows[0].candidates, assessment: result.assessment }, null, 2);
  };
  window.addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
  renderVersion(); load();
})();

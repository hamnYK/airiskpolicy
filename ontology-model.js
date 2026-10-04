'use strict';
((root) => {
  const normal = v => v.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  const kinds = ['principle', 'harm', 'entity', 'control'];
  const fields = { principle: 'principles', harm: 'harm_types', entity: 'harmed_entities' };
  const url = v => { try { return ['https:', 'http:'].includes(new URL(v).protocol); } catch { return false; } };
  function validate(data) {
    const errors = [];
    if (!data || data.schemaVersion !== 1 || !Array.isArray(data.concepts) || !Array.isArray(data.relations) || !Array.isArray(data.bindings)) return ['schemaVersion: 1 및 concepts / relations / bindings 배열이 필요합니다.'];
    if (data.name !== undefined && (typeof data.name !== 'string' || !data.name.trim() || data.name.length > 120)) errors.push('온톨로지 이름은 1~120자여야 합니다.');
    if (data.concepts.length > 500 || data.relations.length > 2000 || data.bindings.length > 5000) return ['최대 개념 500 / 관계 2000 / 정책 연결 5000개입니다.'];
    const ids = new Set(), concepts = new Map(), aliases = new Map();
    const text = (v, max = 300) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
    const id = (row, label) => { if (!row || !text(row.id, 80) || !/^[a-zA-Z0-9_-]+$/.test(row.id) || ids.has(row.id)) errors.push(label + ': 고유한 영문·숫자 ID가 필요합니다.'); else ids.add(row.id); };
    const evidence = (row, label) => {
      if (!['draft', 'reviewed'].includes(row.review)) errors.push(label + ': 검토 상태를 확인하세요.');
      if (row.source && !url(row.source)) errors.push(label + ': 출처는 HTTP(S) URL이어야 합니다.');
      if (row.review === 'reviewed' && (!url(row.source) || !text(row.note, 2000))) errors.push(label + ': 검토 완료에는 출처와 근거 메모가 필요합니다.');
      if (typeof row.note !== 'string' || row.note.length > 2000) errors.push(label + ': 메모는 2000자 이내입니다.');
    };
    for (const c of data.concepts) {
      id(c, '개념'); if (!c) continue;
      if (!kinds.includes(c.kind) || !text(c.label) || !Array.isArray(c.aliases) || c.aliases.length > 30 || c.aliases.some(v => !text(v))) { errors.push(c.id + ': 개념 종류·이름·별칭을 확인하세요.'); continue; }
      evidence(c, c.id); concepts.set(c.id, c);
      for (const alias of [c.label, ...c.aliases]) {
        const key = c.kind + ':' + normal(alias);
        if (!normal(alias)) errors.push(c.id + ': 빈 정규화 별칭입니다.');
        if (aliases.has(key) && aliases.get(key) !== c.id) errors.push(c.id + ': 다른 개념과 별칭이 중복됩니다: ' + alias);
        aliases.set(key, c.id);
      }
    }
    for (const r of data.relations) {
      id(r, '관계'); if (!r) continue; evidence(r, r.id);
      const from = concepts.get(r.from), to = concepts.get(r.to);
      if (!(r.type === 'requires' && from && from.kind !== 'control' && to?.kind === 'control') && !(r.type === 'broader' && from?.kind === 'principle' && to?.kind === 'principle' && r.from !== r.to)) errors.push(r.id + ': 통제수단 필요 관계 또는 AI 원칙 간 상위 원칙 연결을 선택하세요.');
      if (r.review === 'reviewed' && [r.from, r.to].some(key => concepts.get(key)?.review !== 'reviewed')) errors.push(r.id + ': 연결 개념도 검토 완료여야 합니다.');
    }
    const date = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
    for (const b of data.bindings) {
      id(b, '정책 연결'); if (!b) continue; evidence(b, b.id);
      if (!Number.isSafeInteger(b.policyId) || b.policyId < 1 || !/^[A-Z]{3}$/.test(b.country) || concepts.get(b.control)?.kind !== 'control') errors.push(b.id + ': 정책 ID·국가 코드·통제수단을 확인하세요.');
      if ((b.validFrom && !date(b.validFrom)) || (b.validTo && !date(b.validTo)) || (b.validFrom && b.validTo && b.validFrom > b.validTo)) errors.push(b.id + ': 적용 기간을 확인하세요.');
      if (b.review === 'reviewed' && concepts.get(b.control)?.review !== 'reviewed') errors.push(b.id + ': 통제수단도 검토 완료여야 합니다.');
    }
    return errors;
  }
  function match(record, policy, country, ontology, asOf) {
    const evidence = [];
    if (!ontology) return evidence;
    const concepts = ontology.concepts.filter(c => c.review === 'reviewed');
    const has = (values, c) => (values || []).some(v => [c.label, ...c.aliases].some(a => normal(v) === normal(a)));
    const riskConcepts = concepts.filter(c => fields[c.kind] && has(record.properties?.[fields[c.kind]], c));
    for (const c of riskConcepts) {
      if (c.kind === 'principle' && has(policy.principles, c)) evidence.push({ type: 'concept', conceptId: c.id, label: c.label, source: c.source, note: c.note });
      for (const r of ontology.relations.filter(r => r.review === 'reviewed' && r.from === c.id)) {
        if (r.type === 'broader') {
          const target = concepts.find(x => x.id === r.to);
          if (target && has(policy.principles, target)) evidence.push({ type: 'broader', conceptId: c.id, targetConceptId: target.id, relationId: r.id, label: c.label + ' ▶ ' + target.label, source: r.source, note: r.note });
          continue;
        }
        for (const b of ontology.bindings.filter(b => b.review === 'reviewed' && b.control === r.to && b.country === country && b.policyId === policy.id)) {
          if ((b.validFrom || b.validTo) && !asOf) continue;
          if ((b.validFrom && asOf < b.validFrom) || (b.validTo && asOf > b.validTo)) continue;
          evidence.push({ type: 'control', conceptId: c.id, controlId: r.to, label: c.label + ' ▶ ' + concepts.find(x => x.id === r.to)?.label, relationId: r.id, bindingId: b.id, source: b.source, relationSource: r.source, note: b.note, validFrom: b.validFrom, validTo: b.validTo });
        }
      }
    }
    return evidence;
  }
  const api = { validate, match, normal, kinds };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.aiRiskOntology = api;
})(globalThis);

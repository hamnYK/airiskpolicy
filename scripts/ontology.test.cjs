'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict');
const model = require('../ontology-model.js'), { analyze } = require('../gap-engine.js');
function fixture() {
  const common = { review: 'reviewed', source: 'https://example.org/evidence', note: 'Synthetic test evidence, not a policy claim.' };
  return { schemaVersion: 1, version: 'test', concepts: [
    { id: 'harm', kind: 'harm', label: 'Physical', aliases: [], ...common },
    { id: 'control', kind: 'control', label: 'Safety testing', aliases: [], ...common },
    { id: 'transparency', kind: 'principle', label: 'Transparency', aliases: ['Explainability'], ...common }
  ], relations: [{ id: 'requires-test', from: 'harm', to: 'control', type: 'requires', ...common }], bindings: [{ id: 'binding', country: 'KOR', policyId: 7, control: 'control', validFrom: '2025-01-01', validTo: '2027-01-01', ...common }] };
}
test('reviewed risk-control-policy path is evidence, not coverage', () => {
  const ontology = fixture(); assert.deepEqual(model.validate(ontology), []);
  const a = analyze({ country: { code: 'KOR' }, to: '2026-01-01', total: 1, records: [{ properties: { harm_types: ['Physical'] } }] }, { country: { code: 'KOR' }, records: [{ id: 7, principles: [] }] }, ontology);
  assert.equal(a.rows[0].status, 'candidate'); assert.equal(a.rows[0].candidates[0].evidence[0].bindingId, 'binding'); assert.equal(a.assessment, 'unverified'); assert.equal(a.ontologyVersion, 'test');
});
test('country, policy ID, dates and review status constrain paths', () => {
  const o = fixture(), r = { properties: { harm_types: ['Physical'] } }, p = { id: 7 };
  for (const [policy, country, date] of [[p, 'USA', '2026-01-01'], [{ id: 8 }, 'KOR', '2026-01-01'], [p, 'KOR', '2028-01-01'], [p, 'KOR', undefined]]) assert.deepEqual(model.match(r, policy, country, o, date), []);
  o.bindings[0].review = 'draft'; assert.deepEqual(model.match(r, p, 'KOR', o, '2026-01-01'), []);
});
test('reviewed aliases unify concepts while drafts do not', () => {
  const o = fixture(), r = { properties: { principles: ['Explainability'] } }, p = { id: 1, principles: ['Transparency'] };
  assert.equal(model.match(r, p, 'KOR', o).length, 1);
  o.concepts[2].review = 'draft'; assert.equal(model.match(r, p, 'KOR', o).length, 0);
});
test('dangling links, ambiguous aliases, unsafe sources and invalid dates are rejected', () => {
  const changes = [o => o.relations[0].to = 'absent', o => o.concepts[1].id = 'harm', o => o.concepts[2].source = 'javascript:alert(1)', o => o.bindings[0].validTo = '2026-02-31', o => o.concepts[0].review = 'draft', o => o.concepts.push({ ...o.concepts[2], id: 'duplicate-label' })];
  for (const change of changes) { const o = fixture(); change(o); assert.ok(model.validate(o).length); }
});
module.exports = { fixture };
test('common AI principle seed provides editable matching concepts without legal claims', () => {
  const seed = require('../supabase/seeds/common-ai-principles.json');
  assert.deepEqual(model.validate(seed), []);
  assert.equal(seed.name, '공통 AI 원칙 매칭');
  assert.equal(seed.concepts.length, 10);
  for (const concept of seed.concepts) {
    assert.deepEqual(concept.aliases, []);
    const evidence = model.match({ properties: { principles: [concept.label] } }, { principles: [concept.label] }, 'KOR', seed);
    assert.equal(evidence.length, 1);
    assert.equal(evidence[0].conceptId, concept.id);
  }
  assert.deepEqual(seed.relations, []); assert.deepEqual(seed.bindings, []);
});

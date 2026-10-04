'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { analyze: run } = require('../gap-engine.js');
const ontology = require('../supabase/seeds/common-ai-principles.json');
const analyze = (risk, policy) => run(risk, policy, ontology);
const risk = { country: { code: 'KOR' }, total: 200, records: [
  { id: '1', properties: { principles: ['Transparency & explainability', 'Safety', 'Safety'] } },
  { id: '2', properties: { principles: ['Privacy'] } },
  { id: '3', properties: { principles: [] } }
] };
const policy = { country: { code: 'KOR' }, records: [
  { id: 1, principles: ['transparency and explainability'] },
  { id: 2, principles: ['TRANSPARENCY & EXPLAINABILITY', 'Safety', 'Safety'] },
  { id: 3, principles: [] },
  { id: 4, principles: ['Safety'], status: 'Discontinued' }
] };
test('candidate clues, missing labels and no candidate remain distinct', () => {
  const a = analyze(risk, policy);
  assert.deepEqual(a.counts, { candidate: 1, unmatched: 1, insufficient: 1 });
  assert.equal(a.sampleCount, 3); assert.equal(a.riskTotal, 200);
  assert.equal(a.unclassifiedPolicies, 1); assert.equal(a.assessment, 'unverified');
  assert.deepEqual(a.rows[0].candidates.map(c => c.policy.id), [2, 4]);
  assert.equal(a.rows[0].candidates[0].sharedPrinciples.length, 2);
});
test('absent and mismatched snapshots cannot produce a report', () => {
  assert.equal(analyze(risk, null), null);
  assert.equal(analyze(null, policy), null);
  assert.equal(analyze(risk, { ...policy, country: { code: 'USA' } }), null);
});
test('empty inventory is different from an entirely unclassified inventory', () => {
  assert.deepEqual(analyze(risk, { ...policy, records: [] }).counts, { candidate: 0, unmatched: 2, insufficient: 1 });
  assert.deepEqual(analyze(risk, { ...policy, records: [{ id: 1, principles: [] }] }).counts, { candidate: 0, unmatched: 0, insufficient: 3 });
});
test('empty risk sample has no fabricated gaps and inputs remain unchanged', () => {
  const before = JSON.stringify({ risk, policy }); analyze(risk, policy);
  assert.equal(JSON.stringify({ risk, policy }), before);
  assert.deepEqual(analyze({ ...risk, records: [] }, policy).counts, { candidate: 0, unmatched: 0, insufficient: 0 });
});

test('only ontology evidence can admit a candidate; no exact-label fallback', () => {
  const r = { country: { code: 'KOR' }, records: [{ properties: { principles: ['Safety'] } }] };
  const p = { country: { code: 'KOR' }, records: [{ id: 1, principles: ['Safety'] }] };
  const o = structuredClone(ontology);
  assert.equal(run(r, p, o).counts.candidate, 1);
  assert.equal(run(r, p, o).method, 'ontology-only-v2');
  o.concepts.forEach(c => c.review = 'draft');
  assert.equal(run(r, p, o).counts.candidate, 0);
  o.concepts = [];
  assert.equal(run(r, p, o).counts.candidate, 0);
  assert.equal(run(r, p, null), null);
});
test('edited aliases enable and remove shared-principle candidates', () => {
  const o = structuredClone(ontology), c = o.concepts.find(c => c.label === 'Safety');
  const r = { country: { code: 'KOR' }, records: [{ properties: { principles: ['Custom safety label'] } }] };
  const p = { country: { code: 'KOR' }, records: [{ id: 1, principles: ['Safety'] }] };
  assert.equal(run(r, p, o).counts.candidate, 0);
  c.aliases.push('Custom safety label');
  const result = run(r, p, o);
  assert.equal(result.counts.candidate, 1);
  assert.deepEqual(result.rows[0].candidates[0].sharedPrinciples, ['Safety']);
  c.aliases = [];
  assert.equal(run(r, p, o).counts.candidate, 0);
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const model = require('../ontology-model.js');
const { analyze } = require('../gap-engine.js');
const ontology = require('../supabase/seeds/oecd-principle-crosswalk.json');
const fixture = require('./fixtures/kor-principles-20261005.json');
test('real KOR labels reproduce the failure and recover 79 classified risk records', () => {
  assert.deepEqual(model.validate(ontology), []);
  assert.equal(analyze(fixture.risk, fixture.policy, require('../supabase/seeds/common-ai-principles.json')).counts.candidate, 0);
  const result = analyze(fixture.risk, fixture.policy, ontology);
  assert.deepEqual(result.counts, { candidate: 79, unmatched: 0, insufficient: 21 });
  assert.equal(result.policyCount, 29);
  assert.equal(result.unclassifiedPolicies, 1);
  assert.ok(result.rows.some(r => r.candidates.some(c => c.evidence.some(e => e.type === 'broader'))));
  assert.equal(result.assessment, 'unverified');
});
test('broader mappings are directed, reviewed, one-hop evidence, never synonyms', () => {
  const o = structuredClone(ontology), privacy = 'Privacy & data governance', broad = o.concepts.find(c => c.id === 'oecd-1-2').label;
  const match = (risk, policy) => model.match({ properties: { principles: [risk] } }, { principles: [policy] }, 'KOR', o);
  assert.equal(match(privacy, broad)[0].type, 'broader');
  assert.equal(match(broad, privacy).length, 0);
  assert.equal(match(privacy, 'Fairness').length, 0);
  assert.equal(match(privacy, '2.1 Investing in AI research and development').length, 0);
  o.relations.find(r => r.from === 'shared-principle-01').review = 'draft';
  assert.equal(match(privacy, broad).length, 0);
  o.relations[0].to = o.relations[0].from;
  assert.ok(model.validate(o).length);
});

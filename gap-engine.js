'use strict';
/* Discovery only: shared inventory labels never establish legal coverage. */
((root) => {
  const model = typeof module !== 'undefined' && module.exports ? require('./ontology-model.js') : root.aiRiskOntology;
  const normal = value => value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  const labels = values => [...new Map((values || []).filter(v => typeof v === 'string' && normal(v)).map(v => [normal(v), v])).values()];
  function analyze(risk, policy, ontology = null) {
    if (!risk || !policy || !risk.country?.code || risk.country.code !== policy.country?.code) return null;
    if (ontology && model.validate(ontology).length) throw Error('Invalid ontology');
    const policies = policy.records.map(record => ({ record, principles: labels(record.principles) }));
    const unclassifiedPolicies = policies.filter(p => !p.principles.length).length;
    const rows = risk.records.map(record => {
      const principles = labels(record.properties?.principles);
      const keys = new Set(principles.map(normal));
      const candidates = policies.map(p => ({ policy: p.record, sharedPrinciples: p.principles.filter(v => keys.has(normal(v))), evidence: model?.match(record, p.record, risk.country.code, ontology, risk.to) || [] }))
        .filter(p => p.sharedPrinciples.length || p.evidence.length).sort((a, b) => b.evidence.length - a.evidence.length || b.sharedPrinciples.length - a.sharedPrinciples.length || String(a.policy.id).localeCompare(String(b.policy.id)));
      const status = candidates.length ? 'candidate' : !principles.length || (policies.length > 0 && unclassifiedPolicies === policies.length) ? 'insufficient' : 'unmatched';
      return { record, principles, candidates, status };
    });
    const counts = { candidate: 0, unmatched: 0, insufficient: 0 };
    rows.forEach(row => counts[row.status]++);
    return { country: risk.country, rows, counts, unclassifiedPolicies, policyCount: policies.length,
      sampleCount: rows.length, riskTotal: risk.total, from: risk.from, to: risk.to,
      riskFetchedAt: risk.fetchedAt, policyFetchedAt: policy.fetchedAt, method: ontology ? 'ontology-and-principles-v1' : 'shared-principles-v1', ontologyVersion: ontology?.version || null, asOf: risk.to || null, assessment: 'unverified' };
  }
  const api = { analyze };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.aiRiskGap = api;
})(globalThis);

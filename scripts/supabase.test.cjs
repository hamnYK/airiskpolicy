'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const model = require('../ontology-model.js');
test('Supabase SQL: anonymous, ordinary user, administrator, publish and revocation', async t => {
  const db = new PGlite(); t.after(() => db.close());
  const admin = '11111111-1111-4111-8111-111111111111', member = '22222222-2222-4222-8222-222222222222';
  await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public to anon, authenticated;
    insert into auth.users values ('${admin}'), ('${member}');`);
  await db.exec(fs.readFileSync(path.join(__dirname, '../supabase/migrations/202610040001_ontology_admin.sql'), 'utf8'));
  await db.exec(fs.readFileSync(path.join(__dirname, '../supabase/migrations/202610040002_ontology_name.sql'), 'utf8'));
  await db.exec(`insert into airisk_private.ontology_admins(user_id) values ('${admin}');`);
  const role = async (name, uid = '') => { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid]); await db.exec('set role ' + name); };
  const rpc = async (name, params = [], casts = []) => (await db.query(`select public.${name}(${params.map((_, i) => '$' + (i + 1) + '::' + casts[i]).join(',')}) as result`, params)).rows[0].result;
  await role('anon'); const initial = await rpc('airisk_ontology_published'); assert.equal(initial.concepts.length, 0);
  await assert.rejects(rpc('airisk_ontology_state'), /permission denied/);
  await assert.rejects(db.exec('select * from airisk_private.ontology_state'), /permission denied/);
  await assert.rejects(rpc('airisk_ontology_save', [null, {}], ['uuid','jsonb']), /permission denied/);
  await role('authenticated', member);
  await assert.rejects(rpc('airisk_ontology_state'), /administrator access required/);
  await assert.rejects(db.exec(`insert into airisk_private.ontology_admins values ('${member}')`), /permission denied/);
  await assert.rejects(rpc('airisk_ontology_publish', [null], ['uuid']), /administrator access required/);
  await role('authenticated', admin);
  let state = await rpc('airisk_ontology_state');
  const common = { review: 'reviewed', source: 'https://example.org/test', note: 'Synthetic SQL test fixture.' };
  const document = { schemaVersion: 1, name: 'Common AI principles', version: 'fixture', concepts: [
    { id: 'risk', kind: 'harm', label: 'Physical', aliases: [], ...common },
    { id: 'control', kind: 'control', label: 'Safety tests', aliases: [], ...common },
    { id: 'draft', kind: 'principle', label: 'Private draft', aliases: [], review: 'draft', source: '', note: 'Private' }
  ], relations: [{ id: 'requires', type: 'requires', from: 'risk', to: 'control', ...common }], bindings: [{ id: 'binding', country: 'KOR', policyId: 7, control: 'control', ...common }] };
  assert.deepEqual(model.validate(document), []);
  const previous = state.revision;
  state = await rpc('airisk_ontology_save', [state.revision, document], ['uuid','jsonb']);
  assert.deepEqual(await rpc('airisk_ontology_published'), initial);
  await assert.rejects(rpc('airisk_ontology_publish', [previous], ['uuid']), /another session/);
  await assert.rejects(rpc('airisk_ontology_publish', [null], ['uuid']), /another session/);
  const invalid = structuredClone(document); invalid.relations[0].to = 'missing';
  await assert.rejects(rpc('airisk_ontology_save', [state.revision, invalid], ['uuid','jsonb']), /Invalid requires/);
  const duplicate = structuredClone(document); duplicate.concepts.push({ ...document.concepts[0], id: 'other-risk' });
  await assert.rejects(rpc('airisk_ontology_save', [state.revision, duplicate], ['uuid','jsonb']), /Ambiguous alias/);
  const unsafe = structuredClone(document); unsafe.concepts[0].source = 'javascript:alert(1)';
  await assert.rejects(rpc('airisk_ontology_save', [state.revision, unsafe], ['uuid','jsonb']), /Invalid evidence URL/);
  const invalidDate = structuredClone(document); invalidDate.bindings[0].validFrom = '2026-02-31';
  await assert.rejects(rpc('airisk_ontology_save', [state.revision, invalidDate], ['uuid','jsonb']), /date\/time|Invalid binding date/);
  const unreviewed = structuredClone(document); unreviewed.concepts[1].review = 'draft';
  await assert.rejects(rpc('airisk_ontology_save', [state.revision, unreviewed], ['uuid','jsonb']), /Reviewed relations need reviewed concepts/);
  state = await rpc('airisk_ontology_publish', [state.revision], ['uuid']);
  assert.equal(state.published.concepts.length, 2); assert.equal(state.history.length, 1); assert.deepEqual(model.validate(state.published), []);
  const published = state.published;
  assert.equal(published.name, document.name);
  await role('anon'); assert.deepEqual(await rpc('airisk_ontology_published'), published);
  await assert.rejects(db.exec('select * from airisk_private.ontology_history'), /permission denied/);
  await db.exec('reset role'); await db.exec(`delete from airisk_private.ontology_admins where user_id = '${admin}'`);
  await role('authenticated', admin); await assert.rejects(rpc('airisk_ontology_state'), /administrator access required/);
});

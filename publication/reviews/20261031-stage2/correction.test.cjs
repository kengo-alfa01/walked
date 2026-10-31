'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {hash} = require('../../lib.cjs');
const {functionSource} = require('../../location-audit.cjs');
const root = path.resolve(__dirname, '../../..');
const read = p => JSON.parse(fs.readFileSync(path.join(root, p)));
const proposal = JSON.parse(fs.readFileSync(path.join(__dirname, 'site-correction-proposal.json')));
const sites = read('sengoku/sites.json');
const cards = read('sengoku/cards.json');
const oldSite = sites.find(s => s.id === proposal.siteId);
// This is a fixture-only patch. No runtime JSON or user storage is written.
function correctedFixture() {
  assert.equal(hash(oldSite), proposal.expectedRecordHash);
  return sites.map(s => s.id === proposal.siteId ? {...s, municipalityCode: proposal.newMunicipalityCode} : structuredClone(s));
}
function reconcile(code, found = {}) {
  const visited = {[code]: {first: '2020-01-01', last: '2020-01-02', source: '手動'}};
  const ctx = {state: {visited}, MACHIDA_CODE:'13209', MACHIDA_PREFIX:'m:', SAGAMIHARA_PREFIX:'s:', NATION_PREFIX:'n:',
    sengokuSites:correctedFixture(), sengokuCards:cards, sengokuFound:structuredClone(found), sengokuStoreKey:'fixture',
    writeStore(){}, renderSengoku(){}, refreshSengokuPins(){}, toastSengokuCards(){}};
  vm.createContext(ctx);
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const n of ['canonicalAreaKey','areaMunicipalityCode','eligibleSengokuCard','reconcileSengokuVisits']) vm.runInContext(functionSource(html,n),ctx);
  ctx.reconcileSengokuVisits();
  assert.deepEqual(ctx.state.visited, visited);
  return ctx;
}
const affected = cards.filter(c => c.siteId === proposal.siteId);
test('only municipalityCode changes; every existing site ID and coordinate survives', () => {
  const fixed = correctedFixture();
  for (const s of sites) assert.deepEqual(fixed.find(x => x.id === s.id), s.id === proposal.siteId ? {...s,municipalityCode:'11408'} : s);
  assert.deepEqual(sites.find(s=>s.id===proposal.siteId).point, proposal.point);
  assert.equal(oldSite.municipalityCode, '11362');
});
test('pinned boundary audit distinguishes Minano from Yorii at the same point', () => {
  const a = JSON.parse(fs.readFileSync(path.join(__dirname, 'boundary-audit.json')));
  assert.equal(a.boundarySHA256, read('data/title-registry.json').sourceSHA256);
  assert.deepEqual(a.results.map(x=>[x.municipalityCode,x.pointInMunicipality]),[['11362',false],['11408',true]]);
});
test('past Yorii visits unlock eligible legacy Hachigata cards without revisiting', () => {
  for(const key of ['11408','n:11408:114080120']) {
    const c = reconcile(key);
    const eligible = affected.filter(x=>c.eligibleSengokuCard(x));
    assert.ok(eligible.length>0);
    for(const x of eligible) assert.ok(c.sengokuFound[x.id]);
    const once = JSON.stringify(c.sengokuFound); c.reconcileSengokuVisits(); assert.equal(JSON.stringify(c.sengokuFound),once);
  }
});
test('Minano-only visits cannot newly unlock Hachigata after the correction', () => {
  const c = reconcile('11362'); for(const x of affected) assert.equal(c.sengokuFound[x.id],undefined);
});
test('previous awards and visit dates survive even when obtained under the old code', () => {
  const prior = {[affected[0].id]: {at:'2020-01-01',siteId:proposal.siteId}, unknown_old_card:{at:'2019-01-01',siteId:'unknown'}};
  const c = reconcile('11362',prior); for(const [id,data] of Object.entries(prior)) assert.deepEqual(c.sengokuFound[id],data);
  assert.deepEqual(Object.keys(c.state.visited),['11362']); // never relabel a real Minano visit as Yorii
});
test('proposal remains unapproved and cannot masquerade as an added publication delta', () => {
  assert.equal(proposal.appliedToGame,false); assert.equal(proposal.requiresUserApproval,true);
  assert.equal(proposal.candidatePublicationState,'公開審査待ち');
  assert.deepEqual(proposal.affectedLegacyCardIds, affected.map(x=>x.id));
  assert.equal(proposal.newCardCount,0);
});

'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const core=require('../sengoku-v2-core.js');
const cleanup=require('../sengoku-card-cleanup.js');
const root=path.resolve(__dirname,'..');
const json=rel=>JSON.parse(fs.readFileSync(path.join(root,rel),'utf8'));
const cur=json('sengoku/v2/approved-c-20261124-v6-staging.json');
const old=json('sengoku/v2/approved-c-20261120-new9-80.json');
const master=json('docs/c-release/20261124-v6-master-metadata.json');
const sha=s=>crypto.createHash('sha256').update(s,'utf8').digest('hex');
const known=new Set(json('data/title-registry.json').areas.map(a=>a.code));
const catalog=core.validate(cur,known,sha);
test('88-person version and 765 original ⑥ approval texts remain strictly valid',()=>{
 assert.equal(cur.people.length,88);
 assert.equal(cur.histories.length,1591);
 assert.equal(cur.sites.length,556);
 assert.equal(cur.relations.length,871);
 assert.equal(cur.retiredHistories.length,0);
 assert.equal(catalog.people.size,88);
 assert.equal(cur.version,'v2-approved-c-20261124-88-staging');
});
test('Ando v3 ⑥4466 unlocks on Noshiro municipal visit but not twice',()=>{
 const id='sg2hist-a54-ando-succession-1553-54-20261121';
 const h=catalog.histories.get(id);
 assert.equal(h.approval.sheetRow,4466);
 assert.equal(h.approval.version,'v3');
 assert.equal(h.personId,'sg-added-ando-chikasue-20261119');
 assert.equal(h.kind,'place');
 assert(catalog.codes.get(id).has('05202'));
 const first=core.award(catalog,{'05202':{first:'2026-11-24'}},{},[],'2026-11-24T00:00:00Z');
 assert(first.added.includes(id));
 assert.equal(first.records[id].siteId,'sg2site-new9-sweep-ando-hiyama-20261120');
 const second=core.award(catalog,{'05202':{first:'2026-11-24'}},first.records,[],'2026-11-24T01:00:00Z');
 assert(!second.added.includes(id));
});
test('all municipality-reviewed nonplace events have zero direct municipal award codes',()=>{
 const nonplace=cur.histories.filter(h=>h.kind==='nonplace'&&h.approval.rights==='自治体確認済・権利OK');
 assert(nonplace.length>=16);
 for(const h of nonplace){
  assert.equal(catalog.codes.has(h.historyId),false,'Unapproved region card '+h.historyId);
  assert(!cur.relations.some(r=>r.historyId===h.historyId));
 }
});
test('valid B-approved new Masanobu award survives removal of obsolete Honshoji relation',()=>{
 const h='sg2hist-masanobu-1563-ikko';
 assert(cur.histories.find(x=>x.historyId===h)?.kind==='place');
 assert(cur.relations.some(r=>r.historyId===h&&r.siteId==='sg2site-a9-masanobu-ueno-castle-20261121'));
 assert(!cur.relations.some(r=>r.historyId===h&&r.siteId==='sg2site-ieyasu-honshoji'));
});
test('old 419 pin coordinate+approval metadata invariant; 120 new sites cannot route',()=>{
 const oldPins=old.sites.filter(x=>x.publicPin);
 assert.equal(oldPins.length,419);
 const newSites=cur.sites.filter(x=>!old.sites.some(a=>a.siteId===x.siteId));
 assert.equal(newSites.length,120);
 assert(newSites.every(s=>s.publicPin===false&&s.point===null&&!s.pinApproval&&!s.pinReview));
 const siteMap=new Map(cur.sites.map(s=>[s.siteId,s]));
 for(const s of oldPins){
  const now=siteMap.get(s.siteId);
  assert.deepEqual(now.point,s.point);
  assert.deepEqual(now.pinApproval,s.pinApproval);
  assert.deepEqual(now.pinReview,s.pinReview);
 }
});
test('retired/unknown acquired cards are never kept after safe restore',()=>{
 const active=cur.histories[0].historyId;
 const records={[active]:{at:'2026-11-20'},'sg2hist-hanbei-shigekado-birth':{at:'2020-01-01'},'sg2hist-hanbei-nagashino-1575':{at:'2020-01-02'},'sg2hist-another-unapproved':{at:'2020-01-03'}};
 const cleaned=cleanup.prune(records,catalog);
 assert.deepEqual(Object.keys(cleaned.records),[active]);
 assert.equal(cleaned.removedIds.length,3);
});
test('story remains locked until its exact current history set is acquired',()=>{
 const pid='sg-added-ando-chikasue-20261119';
 assert.equal(core.canUnlockStory(catalog,pid,{},sha),false);
 const all={};
 for(const h of cur.histories.filter(h=>h.personId===pid))all[h.historyId]={at:'2026-11-24'};
 assert.equal(core.canUnlockStory(catalog,pid,all,sha),true);
 delete all[cur.histories.find(h=>h.personId===pid).historyId];
 assert.equal(core.canUnlockStory(catalog,pid,all,sha),false);
});
test('B-qualified relationship set excludes every retired link and dangling reference',()=>{
 const hist=new Set(cur.histories.map(h=>h.historyId)),site=new Set(cur.sites.map(s=>s.siteId));
 const seen=new Set();
 for(const r of cur.relations){
  assert(hist.has(r.historyId)&&site.has(r.siteId));
  assert.equal(r.bStatus,'合格');
  assert.equal(r.linkDecision,'関係上対象');
  const k=r.historyId+'|'+r.siteId;assert(!seen.has(k));seen.add(k);
 }
 const external=master.relations.filter(r=>!site.has(r.siteId)||!hist.has(r.historyId));
 assert.equal(external.length,9);
});

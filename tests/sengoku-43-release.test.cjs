const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const V=require('../sengoku-v2-core.js');
const root=path.join(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const next=read('sengoku/v2/approved-up-to-muneshige.json');
const prev=read('sengoku/v2/approved-up-to-ujimasa.json');
const known=new Set(read('data/title-registry.json').areas.map(x=>x.code));
const hash=s=>crypto.createHash('sha256').update(s,'utf8').digest('hex');
const catalog=V.validate(next,known,hash);
test('new 43-person release: only approved scope and immutable 234 existing pins',()=>{
 assert.equal(catalog.people.size,43);assert.equal(catalog.histories.size,980);assert.equal(catalog.sites.size,350);
 assert.equal(next.relations.length,546);
 assert.equal(next.sites.filter(s=>s.publicPin).length,234);
 assert.equal(next.sites.filter(s=>!s.publicPin&&s.point===null).length,116);
 assert.deepEqual(next.people.map(p=>p.name).slice(0,20),prev.people.map(p=>p.name));
 assert.equal(next.people.at(-1).name,'立花宗茂');
 assert.deepEqual(next.histories.slice(0,prev.histories.length),prev.histories);
 assert.deepEqual(next.sites.slice(0,prev.sites.length),prev.sites);
 assert.deepEqual(next.relations.slice(0,prev.relations.length),prev.relations);
 assert.ok(next.people.every(p=>p.introduction?.approval?.user==='公開OK'&&p.story?.approval?.user==='公開OK'));
 assert.ok(next.histories.every(h=>h.approval.user==='公開OK'));
 assert.ok(next.sites.every(s=>s.approval.user==='公開OK'));
 assert.ok(!catalog.histories.has('sg2hist-ujiyasu-konodai1538'));
});
test('every new direct link is approved; no guessed coordinates, no duplicate links',()=>{
 const keys=new Set();
 for(const r of next.relations){
  const k=r.historyId+'|'+r.siteId;
  assert.ok(!keys.has(k),k);keys.add(k);
  assert.equal(r.bStatus,'合格');assert.equal(r.linkDecision,'関係上対象');
  assert.ok(['本人直接','出来事直接（史料）','出来事直接（公的伝承）'].includes(r.classification));
 }
 for(const site of next.sites.slice(prev.sites.length)){
  assert.equal(site.publicPin,false);
  assert.equal(site.point,null);
  assert.ok(site.municipalityCodes.every(c=>known.has(c)));
 }
});
test('municipality-only site awards exactly one event card, visited history is never erased',()=>{
 const h=next.histories.find(x=>x.personId===next.people.at(-1).personId&&x.kind==='place');
 assert.ok(h,'立花宗茂 has public event linked to a municipality');
 const link=next.relations.find(r=>r.historyId===h.historyId),site=catalog.sites.get(link.siteId);
 assert.ok(link&&site);const visit=site.codes[0],oldSave={'legacy-history':{at:'2020-01-01'}};
 const once=V.award(catalog,{[visit]:{first:'2025-02-01'}},oldSave,[],'2026-11-12');
 assert.ok(once.records[h.historyId]);assert.deepEqual(once.records['legacy-history'],oldSave['legacy-history']);
 assert.equal(V.award(catalog,{[visit]:{}},once.records,[]).added.includes(h.historyId),false);
});
test('all 43 story lock lists equal their individually approved history IDs',()=>{
 for(const p of next.people){
  const hh=next.histories.filter(h=>h.personId===p.personId);
  assert.equal(p.story.unlock.requiredHistoryCount,hh.length,p.name);
  assert.equal(p.story.unlock.requiredPlaceHistoryCount,hh.filter(h=>h.kind==='place').length,p.name);
  assert.equal(p.story.unlock.historyIdsSHA256,hash(hh.map(h=>h.historyId).sort().join('\n')));
  assert.equal(V.canUnlockStory(catalog,p.personId,{},hash),false);
  const all=Object.fromEntries(hh.map(h=>[h.historyId,{at:'2026-11-12'}]));
  assert.equal(V.canUnlockStory(catalog,p.personId,all,hash),true);
 }
});

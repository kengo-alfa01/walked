'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
const read=p=>JSON.parse(fs.readFileSync(path.join(__dirname,'..',p),'utf8'));
const hash=s=>crypto.createHash('sha256').update(s,'utf8').digest('hex');
const V=require('../sengoku-v2-core.js');
const m=read('docs/c-release/20261119-fixed57-approved-manifest.json');
const b=read('sengoku/v2/approved-c-20261119.json');
const r=read('sengoku/v2/approved-c-20261119-57.json');
const qa=read('docs/c-release/20261119-fixed57-delta-qa.json');
const codes=new Set(read('data/title-registry.json').areas.map(a=>a.code));
const catalog=V.validate(r,codes,hash),hm=new Map(r.histories.map(h=>[h.historyId,h])),sm=new Map(r.sites.map(s=>[s.siteId,s]));
const oldSites=new Map(b.sites.map(s=>[s.siteId,s])),oldHists=new Map(b.histories.map(h=>[h.historyId,h]));
const siteTargetIds=new Set(m.items.filter(i=>i.type==='史跡').map(i=>i.sourceId));
const historyTargetIds=new Set(m.items.filter(i=>i.type==='経歴').map(i=>i.sourceId));
test('fixed M:Z 57 approval versions, publish hold 11 excluded',()=>{
 assert.equal(m.items.length,57);assert.equal(m.heldFixedIds.length,11);assert.equal(qa.completedCount,57);
 assert.deepEqual(qa.completedIds,m.items.map(i=>i.fixedId),'same IDs and immutable old-first order');
 assert.equal(new Set(m.items.map(i=>i.fixedId)).size,57);
 assert.ok(m.heldFixedIds.every(id=>!qa.completedIds.includes(id)));
 assert.deepEqual({histories:m.items.filter(i=>i.kind==='自治体獲得の実装整合').length,
  name:m.items.filter(i=>i.kind==='承認済み名称版の反映').length,
  pins:m.items.filter(i=>i.pin).length},{histories:6,name:1,pins:50});
 assert.equal(r.version,'v2-approved-c-20261119-57');
});
test('exact ⑥ row, version, text, attribution, approved pin coordinates and B colors',()=>{
 for(const i of m.items){
  const o=i.type==='経歴'?hm.get(i.sourceId):sm.get(i.sourceId);
  assert.ok(o,i.fixedId+' missing');
  assert.equal(i.type==='経歴'?o.text:o.description,i.text,i.fixedId+' text altered');
  assert.equal(o.title||o.name,i.title,i.fixedId+' title altered');
  assert.equal(o.approval.sheetRow,i.approvedRow);assert.equal(o.approval.version,i.approvedVersion);
  assert.equal(o.approval.sha256,hash(i.text));assert.equal(o.approval.user,'公開OK');
  assert.equal(o.approval.quality,'品質合格');assert.equal(o.approval.sourceMatch,'一致');
  assert.equal(o.approval.personId,i.approvalPersonRaw,'Do not infer ⑥ M');
  if(i.pin){
   assert.equal(o.publicPin,true,i.fixedId);assert.deepEqual(o.point,[i.pin.lng,i.pin.lat],i.fixedId);
   assert.equal(o.pinApproval.sheetRow,i.approvedRow);assert.equal(o.pinApproval.version,i.approvedVersion);
   assert.equal(o.pinApproval.sha256,hash(i.text),'Pin uses same latest approved body');
   assert.equal(o.pinReview.accessStatus,i.pin.accessStatus);
   assert.equal(o.pinReview.approvedE,i.related,'⑥E exact archived');
   assert.equal(o.pinReview.sourceSheetRow,i.pin.sourceSheetRow);
   assert.equal(o.pinReview.municipality,i.site.municipalityName);
   if(i.pin.accessStatus!=='green')assert.ok(o.pinReview.restriction.length>20);
  }
 }
 const special=sm.get('sg2site-motonari-niitakayama');
 assert.equal(special.name,'新高山城跡（小早川隆景の居城）');
 assert.equal(special.approval.sheetRow,3564);assert.equal(special.approval.version,'v5');
 assert.deepEqual(special.point,oldSites.get(special.siteId).point,'Existing GPS immutable');
 assert.deepEqual(special.pinReview,oldSites.get(special.siteId).pinReview);
});
test('six independent municipality links are B-reviewed, GPS-free, visit award works, double award prevented',()=>{
 assert.equal(r.municipalityAwards.length,6);assert.equal(catalog.municipalityAwards.size,6);
 for(const i of m.items.filter(i=>i.kind==='自治体獲得の実装整合')){
  const h=hm.get(i.sourceId),a=r.municipalityAwards.find(a=>a.historyId===i.sourceId);
  assert.equal(h.kind,'place');assert.equal(h.approval.sheetRow,i.approvedRow);
  assert.equal(a.municipalityCode,i.history.municipalityCode);
  assert.equal(a.relationSheetRow,i.history.relation.sheetRow);
  assert.equal(a.relatedSiteId,i.history.relation.siteId);
  assert.equal(a.bStatus,'合格');assert.equal(a.linkDecision,'関係上対象');
  assert.ok(!sm.has(a.relatedSiteId),'Held site must not be published '+a.relatedSiteId);
  assert.ok(catalog.codes.get(i.sourceId).has(a.municipalityCode));
  const visited={[a.municipalityCode]:{first:'2026-11-19',last:'2026-11-19'}};
  const prior={'old-retired-card':{at:'2021-01-01'},'sg2hist-nobu-1534-birth':{at:'2020-01-01'}};
  const aw=V.award(catalog,visited,prior,[], '2026-11-19T14:00:00Z');
  assert.ok(aw.added.includes(i.sourceId),'Visit award failed '+i.fixedId);
  assert.equal(aw.records[i.sourceId].siteId,'','No fake GPS/site ID');
  assert.deepEqual(aw.records['old-retired-card'],prior['old-retired-card']);
  assert.deepEqual(aw.records['sg2hist-nobu-1534-birth'],prior['sg2hist-nobu-1534-birth']);
  const again=V.award(catalog,visited,aw.records,[], '2026-11-19T15:00:00Z');
  assert.ok(!again.added.includes(i.sourceId),'Double award');
  assert.deepEqual(again.records[i.sourceId],aw.records[i.sourceId]);
 }
 const old=oldHists.get('sg2hist-nobuyuki-1620-komatsu');
 const upgraded=hm.get(old.historyId);
 assert.equal(old.kind,'nonplace');assert.equal(upgraded.kind,'place');
 assert.ok(upgraded.priorApprovedVersions?.some(p=>p.approval.sheetRow===old.approval.sheetRow&&p.text===old.text));
});
test('no non-target content loss, prior 350 pins immutable, retired cards and relations preserved',()=>{
 assert.equal(r.people.length,65);assert.equal(r.histories.length,1208);assert.equal(r.sites.length,417);
 assert.equal(r.sites.filter(x=>x.publicPin).length,400);
 assert.deepEqual(r.retiredHistories,b.retiredHistories);
 assert.deepEqual(r.relations,b.relations);
 for(const h of b.histories){const actual=hm.get(h.historyId);assert.ok(actual,'Lost history '+h.historyId);
  if(!historyTargetIds.has(h.historyId))assert.deepEqual(actual,h,'Unrelated history changed '+h.historyId);}
 for(const old of b.sites){const actual=sm.get(old.siteId);assert.ok(actual,'Lost site '+old.siteId);
  if(!siteTargetIds.has(old.siteId))assert.deepEqual(actual,old,'Unrelated site changed '+old.siteId);
  if(old.publicPin){assert.deepEqual(actual.point,old.point,'Moved old pin '+old.siteId);
   assert.deepEqual(actual.pinReview,old.pinReview,'Old B conditions changed '+old.siteId);
   assert.deepEqual(actual.pinApproval,old.pinApproval,'Old approved pin body changed '+old.siteId);}}
 assert.deepEqual(new Set(r.sites.filter(s=>s.publicPin&&!oldSites.get(s.siteId)?.publicPin).map(s=>s.siteId)),
  new Set(m.items.filter(i=>i.pin).map(i=>i.sourceId)));
 const states=r.sites.filter(s=>s.publicPin&&siteTargetIds.has(s.siteId)&&m.items.find(i=>i.sourceId===s.siteId)?.pin)
  .map(s=>s.pinReview.accessStatus);
 assert.equal(states.filter(x=>x==='red').length,9);
 assert.equal(states.filter(x=>x==='green').length,15);
 assert.equal(states.filter(x=>x==='yellow').length,26);
});
test('risk specifics: red no-route Otomo/Komenoyama, yellow Seijuji/Kunohe, no invented Otomo ④',()=>{
 const otomo=sm.get('sg2site-a-sorin-funai-residence-20261114'),
  kome=sm.get('sg2site-a-joun-1583-komenoyama-20261113'),
  seiju=sm.get('sg2site-a-nanbu-seijuji-20261114'),
  nine=sm.get('sg2site-a-kunohe-sanohazama-20261114');
 assert.deepEqual(otomo.point,[131.6178125,33.2303125]);
 assert.equal(otomo.pinReview.accessStatus,'red');
 assert.match(otomo.pinReview.restriction,/庭園の入口/);
 assert.equal(kome.pinReview.accessStatus,'red');
 assert.match(kome.pinReview.restriction,/採石/);
 assert.equal(kome.pinApproval.personId,'','⑥M must remain blank');
 assert.equal(seiju.pinApproval.sheetRow,3598);assert.equal(seiju.pinReview.accessStatus,'yellow');
 assert.equal(nine.pinReview.accessStatus,'yellow');assert.match(nine.pinReview.restriction,/私有地/);
 assert.ok(!r.relations.some(x=>x.siteId===otomo.siteId),'No new ④ award for Otomo');
});

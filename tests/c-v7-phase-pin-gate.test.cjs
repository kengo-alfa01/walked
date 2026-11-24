'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const core=require('../sengoku-v2-core.js');
const root=path.join(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const sha=s=>crypto.createHash('sha256').update(s,'utf8').digest('hex');
const known=new Set(read('data/title-registry.json').areas.map(x=>x.code));
const base=read('sengoku/v2/approved-c-20261120-new9-80.json');
const audit=read('docs/c-release/20261124-v7-phase1-pin-review.json');
const stages=[
 ['P1',read('sengoku/v2/approved-c-20261124-v7-phase1-staging.json')],
 ['P2',read('sengoku/v2/approved-c-20261124-v7-phase2-staging.json')]
];
const approved=audit.sites.filter(x=>x.decision==='PIN_OK');
const withheld=audit.sites.filter(x=>x.decision==='NO_PIN');
const oldPins=base.sites.filter(s=>s.publicPin);
test('all 70 latest B site decisions are fixed and source-linked, including 16 held GPS',()=>{
 assert.equal(audit.sourceSpreadsheetId,'1KirrKgmmK6j9boIzsOGlGqFAGVK7t8K5yoDvWsxfSsw');
 assert.equal(audit.counts.total,70);
 assert.equal(approved.length,35);
 assert.equal(withheld.length,35);
 assert.equal(withheld.filter(x=>x.gpsHeldInCanonical).length,16);
 assert.equal(withheld.filter(x=>!x.gpsHeldInCanonical).length,19);
 assert.equal(oldPins.length,419);
 assert.equal(new Set(audit.sites.map(x=>x.id)).size,70);
 for(const rec of audit.sites){
  assert(rec.bEvidence&&!rec.bEvidence.includes('管理用'));
  assert(rec.approvalRow>=2&&/^v[1-9]\d*$/.test(rec.approvalVersion));
  assert(/^[0-9a-f]{64}$/.test(rec.textSha256));
  if(rec.decision==='PIN_OK'){
   assert.equal(rec.rights,'地点確認済・権利OK');
   assert.equal(rec.license,'条件付き');
   assert(Array.isArray(rec.point)&&rec.point.length===2);
   assert(['red','yellow','green'].includes(rec.accessColor));
   assert(/^\d{4}-\d\d-\d\d$/.test(rec.bReviewedAt));
   assert(rec.visitorNotice.length>10);
  }else{
   // Even a private coordinate from ③ is not copied to the user-facing manifest.
   assert(!('point'in rec),'Prohibited held GPS in public audit: '+rec.id);
   assert(!('positionEvidenceUrl'in rec));
   assert(!('accessColor'in rec));
  }
 }
});
test('16 approved related-only site IDs never gain phantom history links',()=>{
 const flagged=audit.sites.filter(x=>x.relatedOnly===true);
 assert.equal(flagged.length,16);
 assert.equal(audit.counts.independentRelatedSites,16);
 for(const rec of flagged){
  assert(rec.personIds.length>0);
  for(const [,doc] of stages){
   const site=doc.sites.find(x=>x.siteId===rec.id);
   assert.equal(site.relatedOnly,true,'Missing related-only flag '+rec.id);
   assert(!doc.relations.some(r=>r.siteId===rec.id),'Made-up history link '+rec.id);
  }
 }
});
for(const [phase,data] of stages){
 test(phase+': 35 independently approved new pins, 35 site-only, preserve all 419 baseline pins',()=>{
  const catalog=core.validate(data,known,sha);
  assert.equal(catalog.people.size,phase==='P1'?74:88);
  assert.equal(data.sites.filter(s=>s.publicPin).length,454);
  const siteMap=new Map(data.sites.map(s=>[s.siteId,s]));
  for(const rec of approved){
   const s=siteMap.get(rec.id);
   assert(s,'Missing approved pin '+rec.id);
   assert.equal(s.publicPin,true);
   assert.deepEqual(s.point,rec.point);
   assert.equal(s.pinApproval.sheetRow,rec.approvalRow);
   assert.equal(s.pinApproval.version,rec.approvalVersion);
   assert.equal(s.approval.sha256,rec.textSha256);
   assert.deepEqual(s.pinPersonIds,rec.personIds);
   assert.equal(s.pinReview.sourceSheetRow,rec.siteRow);
   assert.equal(s.pinReview.accessStatus,rec.accessColor);
   assert.equal(s.pinReview.checkedAt,rec.bReviewedAt);
   assert.equal(s.pinReview.restriction,rec.visitorNotice);
   assert(s.pinReview.attributions.length>0,'Missing visible credit '+rec.id);
   assert(s.pinReview.attributions.every(a=>a.url.startsWith('https://')&&a.label));
   if(rec.codhAttributionRequired){
    assert(s.pinReview.attributions.some(a=>a.label.includes('CODH')),'CODH license missing '+rec.id);
    assert(s.pinReview.attributions.some(a=>a.label.includes('CC BY')),'CC BY condition missing '+rec.id);
   }
  }
  for(const rec of withheld){
   const s=siteMap.get(rec.id);
   assert(s,'Missing no-pin site prose '+rec.id);
   assert.equal(s.publicPin,false);
   assert.equal(s.point,null,'Held ③ GPS leaked to game '+rec.id);
   assert.equal(s.pinApproval,null);
   assert.equal(s.pinReview,null);
  }
  for(const s of oldPins){
   const now=siteMap.get(s.siteId);
   assert(now&&now.publicPin);
   assert.deepEqual(now.point,s.point,'419 baseline coordinate changed '+s.siteId);
   assert.deepEqual(now.pinReview,s.pinReview,'419 baseline access changed '+s.siteId);
  }
  assert.equal(data.histories.length,phase==='P1'?1421:1591);
  assert.equal(data.relations.length,phase==='P1'?791:871);
 });
 test(phase+': independently collected related-only sites do not mint event cards or bypass story unlock',()=>{
  const catalog=core.validate(data,known,sha);
  const related= audit.sites.filter(x=>x.relatedOnly===true);
  for(const rec of related){
   const site=catalog.sites.get(rec.id);
   assert(site,'related-only canonical site missing '+rec.id);
   const visited={};
   for(const c of site.codes)visited[c]={first:'2026-11-24'};
   const before=core.collectedRelatedSites(catalog,{},rec.personIds[0]);
   assert(!before.some(x=>x.siteId===rec.id),'Unvisited site revealed '+rec.id);
   const after=core.collectedRelatedSites(catalog,visited,rec.personIds[0]);
   assert(after.some(x=>x.siteId===rec.id),'Previously visited site not collected '+rec.id);
   assert(after.find(x=>x.siteId===rec.id).visitedMunicipalityCodes.length>0);
   assert(!data.relations.some(r=>r.siteId===rec.id),'Related-only site has extra event relation '+rec.id);
   const awards=core.award(catalog,visited,{},[]);
   for(const h of awards.added)assert(catalog.histories.has(h),'Unknown synthetic history ID '+h);
   assert(!core.canUnlockStory(catalog,rec.personIds[0],{},sha),'Independent site unlocks biography '+rec.id);
  }
 });
 test(phase+': public position and B color are tamper-evident',()=>{
  const modified=structuredClone(data);
  const s=modified.sites.find(s=>s.siteId===approved[0].id);
  s.point=[s.point[0]+0.00001,s.point[1]];
  assert.throws(()=>core.validate(modified,known,sha),/位置版と③最新B記録/);
  const modifiedColor=structuredClone(data);
  const c=modifiedColor.sites.find(s=>s.siteId===approved[0].id);
  c.pinReview.accessStatus=c.pinReview.accessStatus==='red'?'green':'red';
  assert.throws(()=>core.validate(modifiedColor,known,sha),/位置版と③最新B記録/);
  const badNoPin=structuredClone(data);
  const n=badNoPin.sites.find(s=>s.siteId===withheld.find(x=>x.gpsHeldInCanonical).id);
  n.point=[130.0,35.0];
  assert.throws(()=>core.validate(badNoPin,known,sha),/未承認または範囲外のピン/);
 });
}

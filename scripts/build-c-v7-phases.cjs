#!/usr/bin/env node
'use strict';
// Build strictly separate NOT-LIVE candidates. Phase 1 = currently published 74
// people with their latest approved records. Phase 2 adds the approved new 14.
// This script never changes index.html, main, live CSV or player storage.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const core=require('../sengoku-v2-core.js');
const root=path.join(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const write=(p,x)=>fs.writeFileSync(path.join(root,p),JSON.stringify(x,null,2)+'\n');
const sha=s=>crypto.createHash('sha256').update(s,'utf8').digest('hex');
const base=read('sengoku/v2/approved-c-20261120-new9-80.json');
const full=read('sengoku/v2/approved-c-20261124-v6-staging.json');
const frozen=read('docs/c-release/20261124-v6-approved-diff.json');
const oldIds=new Set(base.people.map(p=>p.personId));
const addedIds=new Set(full.people.map(p=>p.personId).filter(id=>!oldIds.has(id)));
const known=new Set(read('data/title-registry.json').areas.map(x=>x.code));
assert.equal(oldIds.size,74);
assert.equal(addedIds.size,14);
assert.equal(frozen.items.length,765);
assert.equal(full.people.length,88);
const groups={P1:[],P2:[]};
for(const item of frozen.items){
 assert(item.personIds.length>0);
 const parts=new Set(item.personIds.map(id=>oldIds.has(id)?'P1':addedIds.has(id)?'P2':'INVALID'));
 assert.equal(parts.size,1,'Mixed-phase ⑥ item must be explicitly adjudicated: '+item.id);
 const phase=[...parts][0];
 assert(phase==='P1'||phase==='P2','Unknown owner in ⑥ item: '+item.id);
 groups[phase].push(item);
}
assert.equal(groups.P1.length,517,'P1 frozen content count changed; re-audit, never guess');
assert.equal(groups.P2.length,248,'P2 frozen content count changed; re-audit, never guess');
const active=new Set(oldIds);
const baseSites=new Map(base.sites.map(s=>[s.siteId,s]));
const phase1=structuredClone(full);
phase1.version='v2-approved-c-20261124-p1-74-staging';
phase1.people=phase1.people.filter(p=>active.has(p.personId));
phase1.histories=phase1.histories.filter(h=>active.has(h.personId));
// Do not load a P2-only description on a site already in P1: fall back to its
// original approved historical site/body, not a newer approval for new owners.
phase1.sites=phase1.sites.flatMap(s=>{
 const fromP2=(s.approvedPersonIds||[]).some(id=>addedIds.has(id));
 const old=baseSites.get(s.siteId);
 if(fromP2){
  if(!old)return[];
  return[structuredClone(old)];
 }
 if(!old&&!(s.approvedPersonIds||[]).some(id=>active.has(id)))return[];
 const copy=structuredClone(s);
 copy.personIds=(copy.personIds||[]).filter(id=>active.has(id));
 if(copy.approvedPersonIds)copy.approvedPersonIds=copy.approvedPersonIds.filter(id=>active.has(id));
 if(copy.pinPersonIds)copy.pinPersonIds=copy.pinPersonIds.filter(id=>active.has(id));
 assert(copy.personIds.length>0,'P1 site has no Phase1 owner: '+s.siteId);
 return[copy];
});
const siteIds=new Set(phase1.sites.map(s=>s.siteId));
const historyIds=new Set(phase1.histories.map(h=>h.historyId));
phase1.relations=phase1.relations.filter(r=>active.has(r.personId)&&historyIds.has(r.historyId)&&siteIds.has(r.siteId));
phase1.municipalityAwards=(phase1.municipalityAwards||[]).filter(a=>historyIds.has(a.historyId));
const place=new Set([...phase1.relations.map(r=>r.historyId),...phase1.municipalityAwards.map(a=>a.historyId)]);
for(const h of phase1.histories)h.kind=place.has(h.historyId)?'place':'nonplace';
for(const p of phase1.people){
 const hs=phase1.histories.filter(h=>h.personId===p.personId);
 assert(hs.length>0,'Empty Phase1 person: '+p.personId);
 p.story.unlock={requiredHistoryCount:hs.length,
  requiredPlaceHistoryCount:hs.filter(h=>h.kind==='place').length,
  historyIdsSHA256:sha(hs.map(h=>h.historyId).sort().join('\n'))};
}
const phase2=structuredClone(full);
phase2.version='v2-approved-c-20261124-p2-88-staging';
for(const [phase,doc] of [['P1',phase1],['P2',phase2]]){
 doc.notes={...doc.notes,cRelease:{...doc.notes?.cRelease,
  v7:{phase,production:false,status:'STAGING_ONLY',
   p1ApprovalCount:517,p2ApprovalCount:248,
   includedApprovalRows:(phase==='P1'?groups.P1:frozen.items).map(i=>i.row),
   blockedNewPins:120,reason:'new pin location/safety and real-device QA pending'}}};
 delete doc.notes.cRelease.v6;
 const index=core.validate(doc,known,sha);
 assert.equal(index.people.size,phase==='P1'?74:88,'Person count');
 const phaseItems=phase==='P1'?groups.P1:frozen.items;
 const records=new Map([
  ...doc.people.flatMap(p=>[['人物紹介|'+p.personId,{text:p.introduction.text,a:p.introduction.approval}],
    ['完成版ストーリー|'+p.personId,{text:p.story.text,a:p.story.approval}]]),
  ...doc.histories.map(h=>['経歴|'+h.historyId,{text:h.text,a:h.approval}]),
  ...doc.sites.map(s=>['史跡|'+s.siteId,{text:s.description,a:s.approval}])
 ]);
 for(const i of phaseItems){
  const v=records.get(i.kind+'|'+i.id);
  assert(v,'Approved row omitted from '+phase+': '+i.kind+'|'+i.id);
  assert.equal(v.a.sheetRow,i.row,'⑥ row drift '+i.id);
  assert.equal(v.a.version,i.version,'⑥ version drift '+i.id);
  assert.equal(sha(v.text),i.bodySha256,'⑥ body drift '+i.id);
 }
 for(const i of phase==='P1'?groups.P2:[]){
  const v=records.get(i.kind+'|'+i.id);
  assert(!v||v.a.sheetRow!==i.row||v.a.version!==i.version,
   'Phase2 approval incorrectly activated in Phase1 '+i.kind+'|'+i.id);
 }
 const pins=doc.sites.filter(s=>s.publicPin);
 assert.equal(pins.length,419,'No new pin until per-pin safety approval');
 const bySite=new Map(doc.sites.map(s=>[s.siteId,s]));
 for(const old of base.sites.filter(s=>s.publicPin)){
  const s=bySite.get(old.siteId);
  assert(s&&s.publicPin,'Missing existing pin '+old.siteId);
  assert.deepEqual(s.point,old.point,'Existing location drift '+old.siteId);
  assert.deepEqual(s.pinReview,old.pinReview,'Existing safety drift '+old.siteId);
 }
 assert.equal(doc.retiredHistories.length,0,'Archived full prose must not be exposed');
 const expected=phase==='P1'?74:88;
 assert.equal(doc.people.length,expected);
 if(phase==='P1'){
  assert(doc.histories.every(h=>oldIds.has(h.personId)));
  assert(doc.sites.every(s=>s.personIds.every(id=>oldIds.has(id))));
  assert(doc.relations.every(r=>oldIds.has(r.personId)));
 }
 const outfile=phase==='P1'?'sengoku/v2/approved-c-20261124-v7-phase1-staging.json':
  'sengoku/v2/approved-c-20261124-v7-phase2-staging.json';
 write(outfile,doc);
 console.log('C_V7_'+phase+'_STAGING_PASS '+JSON.stringify({
  approvedDiff:phaseItems.length,people:doc.people.length,histories:doc.histories.length,
  sites:doc.sites.length,relations:doc.relations.length,pins:pins.length,outfile}));
}
const report={schema:'nmf-c-v7-two-phase-staging-v1',
 status:'STAGING_ONLY_NOT_LIVE',baseline:base.version,
 sourceFrozenCount:frozen.items.length,
 phases:{P1:{people:74,approvedDiff:517,rows:groups.P1.map(i=>i.row)},
  P2:{newPeople:14,newApprovedDiff:248,combinedPeople:88,rows:groups.P2.map(i=>i.row)}},
 newSitePins:{eligibleForPinReview:93,withoutGPS:27,currentlyNewPublicPins:0},
 releaseGate:'NO-GO until location/safety provenance, browser QA and explicit release approval'};
write('docs/c-release/20261124-v7-phases-staging-qa.json',report);
console.log('C_V7_SPLIT_PASS '+JSON.stringify({phase1Diff:517,phase2Diff:248,total:765,
 newPeople:14,release:'NO-GO_NOT_LIVE'}));

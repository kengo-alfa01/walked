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
const pinAudit=read('docs/c-release/20261124-v7-phase1-pin-review.json');
const phase2PinAudit=read('docs/c-release/20261124-v7-phase2-pin-reconciled.json');
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
// The 70 independent B site decisions take priority over the presence of GPS.
// Only the 35 explicitly B-permitted + individually ⑥-approved public positions
// can be made into pins; 16 GPS-held non-pins and 19 missing-GPS non-pins
// MUST remain private to ③ (never copied into a player JSON).
assert.equal(pinAudit.schema,'nmf-c-v7-phase1-pin-review-v1');
assert.deepEqual([pinAudit.counts.total,pinAudit.counts.yes,pinAudit.counts.no],[70,35,35]);
assert.equal(pinAudit.counts.independentRelatedSites,16);
const p1Sites=new Set(groups.P1.filter(x=>x.kind==='史跡').map(x=>x.id));
const bSites=new Set(base.sites.map(x=>x.siteId));
const listed=new Set();
for(const a of pinAudit.sites){
 assert(!listed.has(a.id)&&p1Sites.has(a.id)&&!bSites.has(a.id),'PIN audit scope '+a.id);
 listed.add(a.id);
}
const codhCredits=Object.freeze([
 {label:'『日本歴史地名大系』施設・地点項目データセット（CODH作成）doi:10.20676/00000456（CC BY 4.0）',url:'https://geoshape.ex.nii.ac.jp/nrct-poi/index.html.ja'},
 {label:'CC BY 4.0 利用条件',url:'https://creativecommons.org/licenses/by/4.0/deed.ja'}
]);
function activatePhase1Pins(doc){
 const byId=new Map(doc.sites.map(s=>[s.siteId,s]));
 let newPins=0,heldGPS=0,missingGPS=0;
 for(const rec of pinAudit.sites){
  const s=byId.get(rec.id);
  assert(s,'P1 canonical site missing from candidate '+rec.id);
  assert.equal(s.approval.sheetRow,rec.approvalRow,'⑥ site row mismatch '+rec.id);
  assert.equal(s.approval.version,rec.approvalVersion,'⑥ version mismatch '+rec.id);
  assert.equal(s.approval.sha256,rec.textSha256,'⑥ body SHA mismatch '+rec.id);
  assert.deepEqual(s.approvedPersonIds,rec.personIds,'⑥ site owners mismatch '+rec.id);
  if(rec.relatedOnly===true){
   assert(!doc.relations.some(r=>r.siteId===rec.id),'Unapproved ④ link cannot acquire a related-only site '+rec.id);
   s.relatedOnly=true;
  }
  assert.equal(s.publicPin,false,'Source candidate already has unsafe new pin '+rec.id);
  assert.equal(s.point,null,'Source candidate exposed a non-approved coordinate '+rec.id);
  if(rec.decision==='NO_PIN'){
   assert(!rec.point&&!rec.accessColor&&!rec.positionEvidenceUrl,'Held GPS leaked into player fixture '+rec.id);
   rec.gpsHeldInCanonical?heldGPS++:missingGPS++;
   continue;
  }
  assert.equal(rec.decision,'PIN_OK');
  assert.equal(rec.license,'条件付き');
  assert.equal(rec.rights,'地点確認済・権利OK');
  assert.equal(s.approval.rights,rec.rights);
  assert(Array.isArray(rec.point)&&rec.point.length===2&&rec.point.every(Number.isFinite));
  assert(['green','yellow','red'].includes(rec.accessColor));
  assert(/^\d{4}-\d{2}-\d{2}$/.test(rec.bReviewedAt||''));
  assert(typeof rec.visitorNotice==='string'&&rec.visitorNotice.length>=15);
  assert(!/[⑥④]|管理用|史料を転載/.test(rec.visitorNotice),'Administrative text must not appear in the user warning '+rec.id);
  const refs=rec.codhAttributionRequired?structuredClone(codhCredits):[];
  if(rec.officialInfoUrl)refs.push({label:'史跡の公表資料・案内',url:rec.officialInfoUrl});
  else if(!refs.length&&rec.positionEvidenceUrl)refs.push({label:'史跡位置の確認資料',url:rec.positionEvidenceUrl});
  assert(refs.length>0,'Missing site attribution '+rec.id);
  s.publicPin=true;
  s.point=[...rec.point];
  s.pinPersonIds=[...rec.personIds];
  s.pinApproval=structuredClone(s.approval);
  s.pinReview={
   decision:'可',sourceSheetRow:rec.siteRow,
   municipality:rec.municipality,
   locationKind:'B確認済みの史跡歴史情報参照点（安全な入口・移動経路ではありません）',
   accessStatus:rec.accessColor,
   restriction:rec.visitorNotice,
   checkedAt:rec.bReviewedAt,
   officialInfoUrl:rec.officialInfoUrl||null,
   positionEvidenceUrl:rec.positionEvidenceUrl||null,
   positionSourceIds:[...rec.sourceIds],
   attributions:refs,
   approvedE:'⑥'+rec.approvalRow+' '+rec.approvalVersion+'／③'+rec.siteRow+
    ' B公開ピン可・位置と見学色を別承認済み'
  };
  newPins++;
 }
 assert.equal(newPins,35);assert.equal(heldGPS,16);assert.equal(missingGPS,19);
 return {newPins,heldGPS,missingGPS};
}
// Phase2 is separate from Phase1 and MUST NOT add its 32 new pins to the
// Phase1-only file. A private residence with conditional B history is a
// non-pin until a safe public reference point is independently verified.
assert.equal(phase2PinAudit.schema,'nmf-c-v7-phase2-pin-reconciled-v1');
assert.deepEqual([phase2PinAudit.counts.total,phase2PinAudit.counts.approvedPins,
 phase2PinAudit.counts.noPin,phase2PinAudit.counts.conditionalPrivateHold],[50,32,17,1]);
const phase2SiteIds=new Set(groups.P2.filter(x=>x.kind==='史跡').map(x=>x.id));
function activatePhase2Pins(doc){
 const byId=new Map(doc.sites.map(s=>[s.siteId,s]));
 let added=0,without=0,privateHeld=0,standalone=0;
 const once=new Set();
 for(const rec of phase2PinAudit.sites){
  assert(!once.has(rec.id)&&phase2SiteIds.has(rec.id)&&!bSites.has(rec.id)&&!p1Sites.has(rec.id),
   'Phase2 audit scope '+rec.id);once.add(rec.id);
  const s=byId.get(rec.id);
  assert(s,'Phase2 site missing '+rec.id);
  assert.equal(s.approval.sheetRow,rec.approvalRow,'Phase2 ⑥ row mismatch '+rec.id);
  assert.equal(s.approval.version,rec.approvalVersion,'Phase2 ⑥ version mismatch '+rec.id);
  assert.equal(s.approval.sha256,rec.textSha256,'Phase2 ⑥ SHA mismatch '+rec.id);
  assert.deepEqual(s.approvedPersonIds,rec.personIds,'Phase2 owner set mismatch '+rec.id);
  assert.equal(s.publicPin,false,'Phase2 source has a premature pin '+rec.id);
  assert.equal(s.point,null,'Phase2 source leaked private GPS '+rec.id);
  if(rec.relatedOnly===true){
   assert(!doc.relations.some(r=>r.siteId===rec.id),'Related-only Phase2 site has an invented history link '+rec.id);
   s.relatedOnly=true;standalone++;
  }
  if(rec.decision!=='PIN_OK'){
   assert(!rec.point&&!rec.accessColor&&!rec.positionEvidenceUrl,
    'Phase2 private or withheld location leaked in audit '+rec.id);
   assert(rec.gpsOmitted,'Phase2 withheld location not flagged '+rec.id);
   if(rec.decision==='NO_PIN')without++;
   else if(rec.decision==='HOLD_CONDITIONAL_PRIVATE_SITE')privateHeld++;
   else throw Error('Unrecognized Phase2 location decision '+rec.id);
   continue;
  }
  assert.equal(rec.rights,'地点確認済・権利OK');
  assert.equal(rec.bSiteStatus,'地点確認済');
  assert.equal(rec.license,'条件付き');
  assert(Array.isArray(rec.point)&&rec.point.length===2&&rec.point.every(Number.isFinite));
  assert(['green','yellow','red'].includes(rec.accessColor));
  assert(/^\d{4}-\d{2}-\d{2}$/.test(rec.bReviewDate||''));
  assert(rec.approvedEHasMatchingCoordinate,'⑥ E did not match approved B GPS '+rec.id);
  assert(typeof rec.visitorNotice==='string'&&rec.visitorNotice.length>=20);
  assert(Array.isArray(rec.sourceUrls)&&rec.sourceUrls.length>0);
  const credits=rec.codhAttributionRequired?structuredClone(codhCredits):[];
  if(rec.officialInfoUrl)credits.push({label:'史跡の公表資料・公式案内',url:rec.officialInfoUrl});
  else if(!credits.length&&rec.positionEvidenceUrl)credits.push({
   label:'史跡位置の根拠資料',url:rec.positionEvidenceUrl});
  assert(credits.length>0,'Phase2 source/license credit missing '+rec.id);
  s.publicPin=true;
  s.point=[...rec.point];
  s.pinPersonIds=[...rec.personIds];
  s.pinApproval=structuredClone(s.approval);
  s.pinReview={
   decision:'可',sourceSheetRow:rec.siteRow,municipality:rec.municipality,
   locationKind:'B公表史跡・歴史情報参照点（現地入口・通行経路を示すものではありません）',
   accessStatus:rec.accessColor,
   restriction:rec.visitorNotice,
   checkedAt:rec.bReviewDate,
   officialInfoUrl:rec.officialInfoUrl||null,
   positionEvidenceUrl:rec.positionEvidenceUrl||null,
   positionSourceIds:[...rec.sourceIds],
   attributions:credits,
   approvedE:'⑥'+rec.approvalRow+' '+rec.approvalVersion+'／③'+rec.siteRow+
    ' B既存「公開位置可」または公開ピン可・最新版⑥の公開位置と見学色を照合済み'
  };
  added++;
 }
 assert.equal(once.size,50);
 assert.deepEqual([added,without,privateHeld,standalone],[32,17,1,8]);
 return {added,without,privateHeld,standalone};
}
for(const [phase,doc] of [['P1',phase1],['P2',phase2]]){
 const pinGate=activatePhase1Pins(doc);
 const phase2Gate=phase==='P2'?activatePhase2Pins(doc):{added:0,without:0,privateHeld:0,standalone:0};
 doc.notes={...doc.notes,cRelease:{...doc.notes?.cRelease,
  v7:{phase,production:false,status:'STAGING_ONLY',
   p1ApprovalCount:517,p2ApprovalCount:248,
   includedApprovalRows:(phase==='P1'?groups.P1:frozen.items).map(i=>i.row),
   newlyApprovedPins:pinGate.newPins+phase2Gate.added,heldP1Pins:pinGate.heldGPS+pinGate.missingGPS,
   phase2NewPins:phase2Gate.added,phase2NoPin:phase2Gate.without,phase2PrivateHeld:phase2Gate.privateHeld,
   blockedNewPins:phase==='P1'?35:53,
   reason:'Phase1 35 pins; Phase2 independently adds 32 pinned and withholds 18 incl 1 private residential site. Pages not published'}}};
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
 assert.equal(pins.length,phase==='P1'?454:486,'Phase1 419+35, Phase2 419+35+32 pinned');
 assert.equal(pins.filter(s=>!bSites.has(s.siteId)).length,phase==='P1'?35:67);
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
 newSitePins:{phase1Audited:70,phase1BApprovedPins:35,phase1Withheld:35,
  phase1WithheldGPS:16,phase1MissingGPS:19,phase2Audited:50,phase2BApprovedPins:32,
  phase2ExplicitNoPin:17,phase2ConditionalPrivateHold:1,
  stagedPhase1Pins:35,stagedPhase2NewPins:32,liveNewPublicPins:0},
 releaseGate:'NO-GO until location/safety provenance, browser QA and explicit release approval'};
write('docs/c-release/20261124-v7-phases-staging-qa.json',report);
console.log('C_V7_SPLIT_PASS '+JSON.stringify({phase1Diff:517,phase2Diff:248,total:765,
 newPeople:14,release:'NO-GO_NOT_LIVE'}));

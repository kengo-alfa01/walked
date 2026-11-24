#!/usr/bin/env node
'use strict';
// Release gate: a separately user-authorized Phase1 ONLY. Never publish Phase2 IDs.
const fs=require('node:fs');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const root=require('node:path').resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(root+'/'+p,'utf8'));
const sha=s=>crypto.createHash('sha256').update(s,'utf8').digest('hex');
const baseline=read('sengoku/v2/approved-c-20261120-new9-80.json');
const p1=read('sengoku/v2/approved-c-20261124-v7-phase1-staging.json');
const p2=read('sengoku/v2/approved-c-20261124-v7-phase2-staging.json');
const frozen=read('docs/c-release/20261124-v6-approved-diff.json');
const newly=read('docs/c-release/20261124-b-pin30-preflight.json');
const pinA=read('docs/c-release/20261124-v7-phase1-pin-review.json');
const core=require('../sengoku-v2-core.js');
const registry=new Set(read('data/title-registry.json').areas.map(x=>x.code));
assert.equal(baseline.people.length,74);
assert.equal(baseline.sites.filter(x=>x.publicPin).length,419);
assert.equal(p1.version,'v2-approved-c-20261124-p1-74-staging');
assert.equal(p2.people.length,88);
assert.equal(frozen.items.length,765);
assert.equal(newly.sites.length,30);
assert.deepEqual([p1.people.length,p1.histories.length,p1.sites.length,p1.relations.length,p1.sites.filter(x=>x.publicPin).length],[74,1421,506,791,473]);
const bPeople=new Set(baseline.people.map(p=>p.personId));
for(const p of p1.people)assert(bPeople.has(p.personId),'Phase2 person in Phase1 '+p.personId);
for(const s of p1.sites)assert(s.personIds.every(id=>bPeople.has(id)),'Phase2 site ownership in Phase1');
const pinned=new Map(p1.sites.filter(x=>x.publicPin).map(x=>[x.siteId,x]));
for(const old of baseline.sites.filter(x=>x.publicPin)){
 const now=pinned.get(old.siteId);assert(now,'Lost prior approved pin '+old.siteId);
 assert.deepEqual(now.point,old.point,'Legacy GPS changed '+old.siteId);
 assert.deepEqual(now.pinReview,old.pinReview,'Legacy B safety changed '+old.siteId);
}
const newP1=newly.sites.filter(x=>x.phase==='Phase1');
assert.equal(newP1.length,19);assert.equal(newly.sites.filter(x=>x.phase==='Phase2').length,11);
for(const pin of newP1){
 const s=pinned.get(pin.siteId);
 assert(s&&s.pinApproval?.sheetRow===pin.approval.sheetRow,'Missing newest ⑥ approval '+pin.siteId);
 assert.deepEqual(s.point,pin.point,'B GPS difference '+pin.siteId);
 assert.equal(s.pinReview?.accessStatus,pin.accessStatus,'C overwrote B classification '+pin.siteId);
 assert.equal(core.pinDetails(s).noRouting,pin.accessStatus==='red');
}
for(const pin of newly.sites.filter(x=>x.phase==='Phase2'))assert(!p1.sites.some(x=>x.siteId===pin.siteId),'Phase2 pin crossed Phase boundary');
assert.equal(pinA.sites.filter(x=>x.decision==='PIN_OK').length,54);
assert.equal(pinA.sites.filter(x=>x.decision==='NO_PIN').length,16);
assert.equal(p1.retiredHistories.length,0);
for(const old of frozen.holds.retiredHistoryIds)assert(!p1.histories.some(h=>h.historyId===old),'Retired history restored');
for(const old of frozen.holds.retiredRelationKeys)assert(!p1.relations.some(r=>r.historyId+'|'+r.siteId===old),'Retired relation restored');
assert(!p1.histories.some(h=>h.approval.sheetRow===4041),'Blocked Ando v2 restored');
const p1Approval=new Set((p1.notes?.cRelease?.v7?.includedApprovalRows)||[]);
assert.equal(p1Approval.size,517);
const allPeople=new Set(p1.people.map(p=>p.personId));
const expectedP1=frozen.items.filter(x=>x.personIds.every(id=>allPeople.has(id)));
assert.equal(expectedP1.length,517);
for(const x of expectedP1)assert(p1Approval.has(x.row),'Approved item missing '+x.id);
const candidate=structuredClone(p1);
candidate.version='v2-approved-c-20261124-p1-74';
candidate.notes.cRelease.v7={...candidate.notes.cRelease.v7,status:'PHASE1_RELEASE_CANDIDATE',production:false,release:'Awaiting main & Pages SHA proof'};
candidate.notes.cRelease.v8={phase:'P1',approvedRecords:517,finalBLocationPins:54,extraFromNov24:19,withheldNewPins:16,existingPinsRetained:419,productionVerified:false,source:'⑥ latest v2/v1 2026-11-24'};
const catalog=core.validate(candidate,registry,sha);
assert.equal(catalog.people.size,74);assert.equal(catalog.sites.size,506);
const output='sengoku/v2/approved-c-20261124-p1-74.json';
fs.writeFileSync(root+'/'+output,JSON.stringify(candidate,null,2)+'\n','utf8');
const htmlPath=root+'/index.html';
let html=fs.readFileSync(htmlPath,'utf8');
const older='./sengoku/v2/approved-c-20261120-new9-80.json';
const newer='./'+output;
assert.equal(html.split(older).length-1,1,'Expected exactly one live data pointer');
html=html.replace(older,newer);
for(const [olderCache,newCache] of [
 ['sengoku-v2-core.js?v=c20261120-new9','sengoku-v2-core.js?v=c20261124-p1'],
 ['sengoku-pin-display.js?v=c20261122-approved16','sengoku-pin-display.js?v=c20261124-p1']
]){
 assert.equal(html.split(olderCache).length-1,1,'Cache buster missing '+olderCache);
 html=html.replace(olderCache,newCache);
}
fs.writeFileSync(htmlPath,html,'utf8');
const raw=fs.readFileSync(root+'/'+output);
const blob=crypto.createHash('sha1').update('blob '+raw.length+'\0').update(raw).digest('hex');
console.log('PHASE1_RELEASE_CANDIDATE_PASS '+JSON.stringify({source:output,bytes:raw.length,gitBlobSha:blob,people:74,histories:1421,sites:506,pins:473,relations:791,phase1ApprovalRows:517,nov24Pins:19,noPin:16,phase2People:0,production:false}));

#!/usr/bin/env node
'use strict';
// Stage Phase2 separately. This code never alters main or the Phase1 live deployment.
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=require('node:path').resolve(__dirname,'..');
const load=p=>JSON.parse(fs.readFileSync(root+'/'+p,'utf8'));
const sha=s=>crypto.createHash('sha256').update(s,'utf8').digest('hex');
const base=load('sengoku/v2/approved-c-20261120-new9-80.json');
const p1=load('sengoku/v2/approved-c-20261124-v7-phase1-staging.json');
const p2=load('sengoku/v2/approved-c-20261124-v7-phase2-staging.json');
const frozen=load('docs/c-release/20261124-v6-approved-diff.json');
const new30=load('docs/c-release/20261124-b-pin30-preflight.json');
const core=require('../sengoku-v2-core.js');
const codes=new Set(load('data/title-registry.json').areas.map(x=>x.code));
assert.deepEqual([base.people.length,base.sites.filter(s=>s.publicPin).length],[74,419]);
assert.deepEqual([p1.people.length,p1.histories.length,p1.sites.length,p1.relations.length,p1.sites.filter(s=>s.publicPin).length],[74,1421,506,791,473]);
assert.deepEqual([p2.people.length,p2.histories.length,p2.sites.length,p2.relations.length,p2.sites.filter(s=>s.publicPin).length],[88,1591,556,871,517]);
assert.equal(frozen.items.length,765);
assert.equal(new30.sites.filter(x=>x.phase==='Phase1').length,19);
assert.equal(new30.sites.filter(x=>x.phase==='Phase2').length,11);
const oldPids=new Set(p1.people.map(x=>x.personId));
const newPids=p2.people.filter(x=>!oldPids.has(x.personId));
assert.equal(newPids.length,14);
for(const person of newPids){
 assert(person.introduction?.approval?.user==='公開OK'&&person.story?.approval?.user==='公開OK');
 assert(person.introduction.approval.sourceMatch==='一致'&&person.story.approval.sourceMatch==='一致');
}
const p2Sites=new Map(p2.sites.map(s=>[s.siteId,s]));
for(const s of p1.sites){
 const next=p2Sites.get(s.siteId);
 assert(next,'Phase2 discarded Phase1 site '+s.siteId);
 assert.equal(next.publicPin,s.publicPin,'Phase2 changed Phase1 published pin '+s.siteId);
 if(s.publicPin){
  assert.deepEqual(next.point,s.point,'Phase1 GPS changed '+s.siteId);
  assert.deepEqual(next.pinReview,s.pinReview,'Phase1 B colour/access changed '+s.siteId);
 }
}
for(const rec of new30.sites){
 const s=p2Sites.get(rec.siteId);
 assert(s&&s.publicPin&&s.pinApproval.sheetRow===rec.approval.sheetRow,'B/⑥ new pin missing '+rec.siteId);
 assert.deepEqual(s.point,rec.point,'B coordinate drift '+rec.siteId);
 assert.equal(s.pinReview.accessStatus,rec.accessStatus,'C altered B colour '+rec.siteId);
 assert.equal(core.pinDetails(s).noRouting,rec.accessStatus==='red');
}
const hachijo=p2Sites.get('sg2site-a-hachijo-hideie-residence-20261123');
assert(hachijo?.publicPin&&hachijo.pinReview.accessStatus==='red');
assert.equal(core.pinDetails(hachijo).noRouting,true);
assert.equal(p2.retiredHistories.length,0);
for(const rid of frozen.holds.retiredHistoryIds)assert(!p2.histories.some(h=>h.historyId===rid));
for(const rid of frozen.holds.retiredRelationKeys)assert(!p2.relations.some(x=>x.historyId+'|'+x.siteId===rid));
assert(!p2.histories.some(h=>h.approval.sheetRow===4041));
const rows=new Set(p2.notes.cRelease.v7.includedApprovalRows);
assert.equal(rows.size,765);
for(const i of frozen.items)assert(rows.has(i.row),'Missing ⑥ approved delta '+i.id);
const doc=structuredClone(p2);
doc.version='v2-approved-c-20261124-p2-88';
doc.notes.cRelease.v7={...doc.notes.cRelease.v7,status:'PHASE2_RELEASE_CANDIDATE',production:false,release:'After verified Phase1 main/Pages'};
doc.notes.cRelease.v8={phase:'P2',approvedRecordsCumulative:765,newPhase2Records:248,existingP1Pins:473,newPhase2Pins:44,nov24Phase2Pins:11,withheldPhase2Pins:6,productionVerified:false};
const verified=core.validate(doc,codes,sha);
assert.equal(verified.people.size,88);assert.equal(verified.sites.size,556);
const outfile='sengoku/v2/approved-c-20261124-p2-88.json';
fs.writeFileSync(root+'/'+outfile,JSON.stringify(doc,null,2)+'\n');
const oldPath='./sengoku/v2/approved-c-20261120-new9-80.json';
let html=fs.readFileSync(root+'/index.html','utf8');
assert.equal(html.split(oldPath).length-1,1,'Unexpected staging source app pointer');
html=html.replace(oldPath,'./'+outfile);
for(const [a,b] of [
 ['sengoku-v2-core.js?v=c20261120-new9','sengoku-v2-core.js?v=c20261124-p2'],
 ['sengoku-pin-display.js?v=c20261122-approved16','sengoku-pin-display.js?v=c20261124-p2']
]){
 assert.equal(html.split(a).length-1,1);
 html=html.replace(a,b);
}
fs.writeFileSync(root+'/index.html',html);
const raw=fs.readFileSync(root+'/'+outfile);
const blob=crypto.createHash('sha1').update('blob '+raw.length+'\0').update(raw).digest('hex');
console.log('PHASE2_RELEASE_CANDIDATE_PASS '+JSON.stringify({source:outfile,people:88,histories:1591,sites:556,relations:871,pins:517,newPeople:14,phase2Approved:248,allApproved:765,blobSha:blob,bytes:raw.length,production:false}));

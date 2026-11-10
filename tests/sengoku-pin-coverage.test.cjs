const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const ledger=read('sengoku/v2/pin-release-audit.json');
const doc=read('sengoku/v2/approved-three-person-staging.json');
test('C release registry matches all 15 separately ⑥-approved site pins, with no hidden pin-ready locations',()=>{
 assert.equal(ledger.schemaVersion,'walked.sengoku.pin-reconciliation.v1');
 assert.equal(ledger.awaitingNewUserApproval.length,0);
 assert.equal(doc.sites.length,62);
 assert.equal(doc.sites.filter(s=>!s.publicPin).length,0);
 const shipped=new Map(doc.sites.map(s=>[s.siteId,s]));
 const approved=ledger.shippedNewlyApproved;
 assert.equal(approved.length,15);
 assert.equal(new Set(approved.map(x=>x.siteId)).size,15);
 assert.deepEqual(approved.map(x=>x.pinApprovalRow).sort((a,b)=>a-b),[1553,...Array.from({length:14},(_,i)=>1554+i)]);
 for(const row of approved){
   const site=shipped.get(row.siteId);
   assert.ok(site?.publicPin,'a ⑥-approved site must be visible: '+row.siteId);
   assert.equal(site.pinApproval.sheetRow,row.pinApprovalRow);
   assert.equal(site.pinApproval.version,'v2');
   assert.equal(site.pinApproval.user,'公開OK');
   assert.equal(site.pinReview.sourceSheetRow,row.sourceRow);
   assert.equal(site.pinReview.accessStatus,row.access);
   assert.equal(site.approval.sheetRow,row.originalApprovalRow);
   assert.equal(row.state,'published');
 }
});
test('current approval v3 and ④ B relation correct the old nonplace Hideyoshi event without revoking any records',()=>{
 const change=ledger.hideyoshiAcquisitionCorrection;
 assert.equal(change.historyId,'sg2hist-hideyoshi-kyushu-1587');
 assert.equal(change.historyRow,53);
 assert.equal(change.relationshipRow,320);
 assert.equal(change.approvedHistoryRow,1425);
 assert.equal(change.municipality,'46215');
 assert.equal(change.oldKind,'nonplace');
 assert.equal(change.newKind,'place');
 assert.equal(change.storyPlaceCountAfter,26);
 assert.equal(change.existingCardsPreserved,true);
 const history=doc.histories.find(h=>h.historyId===change.historyId);
 assert.equal(history.kind,'place');
 assert.equal(history.approval.version,'v3');
 assert.equal(history.approval.sheetRow,1425);
 assert.ok(doc.relations.some(r=>r.historyId===history.historyId&&
   r.siteId===change.relatedSiteId&&r.bStatus==='合格'&&r.linkDecision==='関係上対象'));
 assert.equal(doc.people.find(p=>p.personId===history.personId).story.unlock.requiredPlaceHistoryCount,26);
 assert.equal(doc.histories.length,108);
});
test('first-three-person site release stays isolated from other historical characters and retains provenance',()=>{
 assert.equal(doc.people.length,3);
 assert.equal(doc.sites.filter(s=>s.publicPin).length,62);
 assert.equal(ledger.masterSnapshot.registeredSites,319);
 assert.equal(ledger.masterSnapshot.otherCharactersApprovedSitesNotShipped,252);
 assert.ok(ledger.processRule.includes('Do not copy F/G'));
 assert.equal(new Set(doc.sites.map(s=>s.siteId)).size,62);
});

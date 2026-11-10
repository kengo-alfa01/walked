const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const ledger=read('sengoku/v2/pin-release-audit.json');
const doc=read('sengoku/v2/approved-three-person-staging.json');
test('C release audit accounts for every B-approved but not-yet-published site pin',()=>{
 assert.equal(ledger.schemaVersion,'walked.sengoku.pin-reconciliation.v1');
 const waiting=ledger.awaitingNewUserApproval;
 assert.equal(waiting.length,14);
 assert.equal(new Set(waiting.map(x=>x.siteId)).size,waiting.length);
 const inGame=new Map(doc.sites.map(s=>[s.siteId,s]));
 const missingPins=doc.sites.filter(s=>!s.publicPin);
 assert.equal(missingPins.length,14);
 assert.deepEqual(missingPins.map(s=>s.siteId).sort(),waiting.map(s=>s.siteId).sort(),
   'Every included but unpinned site requires a tracked ⑥ latest v2 approval');
 for(const item of waiting){
   const site=inGame.get(item.siteId);
   assert.ok(site&&!site.publicPin&&!site.pinApproval);
   assert.equal(site.approval.version,'v1');
   assert.equal(site.approval.sheetRow,item.originalApprovalRow);
   assert.ok(item.sourceRow>=2);
   assert.equal(item.pinVersion,'v2');
   assert.equal(item.state,'ユーザー確認待ち');
   assert.ok(['green','yellow','red'].includes(item.access));
 }
 const published=ledger.shippedNewlyApproved;
 assert.equal(published.length,1);
 for(const item of published){
   const s=inGame.get(item.siteId);
   assert.ok(s?.publicPin&&s.pinApproval?.sheetRow===item.pinApprovalRow);
   assert.equal(s.pinApproval.version,'v2');
   assert.equal(s.pinReview.accessStatus,item.access);
 }
});
test('C review separates excluded character backlog from 3-person release; no user approvals are fabricated',()=>{
 assert.equal(doc.people.length,3);
 assert.equal(doc.histories.length,108);
 assert.equal(doc.sites.length,62);
 assert.equal(doc.sites.filter(x=>x.publicPin).length,48);
 assert.equal(ledger.masterSnapshot.registeredSites,319);
 assert.equal(ledger.masterSnapshot.otherCharactersApprovedSitesNotShipped,252);
 assert.ok(ledger.processRule.includes('Do not copy F/G'));
 assert.ok(!doc.sites.some(s=>ledger.awaitingNewUserApproval.some(i=>i.siteId===s.siteId)&&s.publicPin));
});

'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.join(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const hash=s=>crypto.createHash('sha256').update(s,'utf8').digest('hex');
const V=require('../sengoku-v2-core.js'),r=read('sengoku/v2/approved-c-20261119.json');
const snap=read('docs/c-release/20261119-fixed-approved-snapshot.json');
const qa=read('docs/c-release/20261119-delta-qa.json');
const prev=read('sengoku/v2/approved-up-to-muneshige-pins-100.json');
const known=new Set(read('data/title-registry.json').areas.map(x=>x.code));
const catalog=V.validate(r,known,hash);
const mp=new Map(r.people.map(x=>[x.personId,x])),mh=new Map(r.histories.map(x=>[x.historyId,x])),ms=new Map(r.sites.map(x=>[x.siteId,x]));
const kept=new Set([...r.histories.map(x=>x.historyId),...r.sites.map(x=>x.siteId)]);
test('fixed C batch, exact published scope, no guessed new pins',()=>{
 assert.equal(snap.fixed.length,1230);assert.equal(snap.legacy.length,31);assert.equal(snap.pinCandidates.length,77);
 assert.equal(r.people.length,65);assert.equal(r.histories.length,1203);assert.equal(r.sites.length,417);
 assert.equal(r.sites.filter(x=>x.publicPin).length,350);
 assert.equal(r.retiredHistories.length,31);
 assert.equal(qa.holds.history.length,6);assert.equal(qa.holds.site.length,1);assert.equal(qa.holds.pin.length,61);assert.equal(qa.processed.pin.length,16);
 assert.equal(qa.counts.records,65*2+1203+417);
});
test('existing content preserved except explicit old ID retirement',()=>{
 const retired=new Set(r.retiredHistories.map(x=>x.history.historyId));
 for(const site of prev.sites)assert.ok(ms.has(site.siteId),'unexpected site disappearance '+site.siteId);
 for(const h of prev.histories)assert.ok(mh.has(h.historyId)||retired.has(h.historyId),'unexpected history disappearance '+h.historyId);
 for(const old of r.retiredHistories){assert.ok(!mh.has(old.history.historyId));assert.equal(hash(old.history.text),old.history.approval.sha256);}
});
test('334 existing published pins preserve exact public coordinates and access conditions',()=>{
 const before=new Map(prev.sites.filter(x=>x.publicPin).map(x=>[x.siteId,x]));
 for(const old of prev.sites.filter(x=>x.publicPin)){
  const s=ms.get(old.siteId);assert.ok(s,'lost previously published pin '+old.siteId);
  assert.deepEqual(s.point,old.point);assert.equal(s.pinReview.accessStatus,old.pinReview.accessStatus);
  assert.equal(s.pinReview.sourceSheetRow,old.pinReview.sourceSheetRow);
  assert.equal(hash(s.pinApprovalText||s.description),s.pinApproval.sha256);
 }
 const manifest=read('docs/c-release/20261119-approved-pin-projection.json');
 assert.equal(manifest.ready.length,16);assert.equal(manifest.held.length,61);
 const newPinIds=new Set(r.sites.filter(x=>x.publicPin&&!before.has(x.siteId)).map(x=>x.siteId));
 assert.deepEqual(newPinIds,new Set(manifest.ready.map(x=>x.siteId)));
 for(const pin of manifest.ready){
  const site=ms.get(pin.siteId);
  assert.ok(site.publicPin);assert.deepEqual(site.point,[pin.lng,pin.lat]);
  assert.equal(site.pinReview.accessStatus,pin.accessStatus);
  assert.equal(site.pinApproval.sheetRow,pin.approvedSheetRow);
  assert.equal(site.pinReview.sourceSheetRow,pin.sourceSheetRow);
  assert.equal(site.pinReview.checkedAt,pin.checkedAt);
  assert.equal(site.pinApproval.sha256,site.approval.sha256);
 }
 for(const pin of manifest.held)assert.ok(!ms.get(pin.siteId)?.publicPin,'unapproved pin '+pin.siteId);
});
test('new content references only ⑥F=公開OK P=一致 and all ④B-qualified acquisition links',()=>{
 for(const f of snap.fixed){
  const a=f.approval;
  if(qa.holds.history.some(x=>x.key===f.key)||qa.holds.site.some(x=>x.key===f.key))continue;
  const item=a.type==='経歴'?mh.get(a.id):a.type==='史跡'?ms.get(a.id):mp.get(a.id)?.[a.type==='人物紹介'?'introduction':'story'];
  assert.ok(item,'missing approved item '+f.key);
  const body=a.type==='史跡'?item.description:item.text,approval=item.approval;
  assert.equal(body,a.text);assert.equal(approval.sheetRow,a.sheetRow);assert.equal(approval.version,a.version);
  assert.equal(approval.sha256,a.sha256);
  assert.equal(approval.user,'公開OK');assert.equal(approval.sourceMatch,'一致');
 }
 for(const r0 of r.relations){assert.ok(mh.has(r0.historyId));assert.ok(ms.has(r0.siteId));
  assert.equal(r0.bStatus,'合格');assert.equal(r0.linkDecision,'関係上対象');}
});
test('municipality-only award, multi-location OR, and duplicate prevention',()=>{
 const h=r.histories.find(x=>x.kind==='place'&&(catalog.codes.get(x.historyId)?.size||0)>1);
 assert.ok(h,'B-approved multi-municipality acquisition example should exist');
 const codes=[...catalog.codes.get(h.historyId)];
 const one=V.award(catalog,{[codes[0]]:{first:'2026-11-19'}},{},[]);
 const two=V.award(catalog,{[codes[1]]:{first:'2026-11-19'}},one.records,[]);
 assert.ok(one.added.includes(h.historyId));assert.ok(!two.added.includes(h.historyId));
 assert.ok(two.records[h.historyId]);
 const preserved={'old-retired-card':{at:'2020-01-01'}};
 const back=V.award(catalog,{[codes[0]]:{first:'2026-11-19'}},preserved,[]);
 assert.deepEqual(back.records['old-retired-card'],preserved['old-retired-card']);
});
test('retired cards remain retrievable but cannot be newly awarded',()=>{
 for(const x of r.retiredHistories){assert.ok(catalog.retiredHistories.has(x.history.historyId));assert.ok(!catalog.histories.has(x.history.historyId));}
 const retiredIds=new Set(r.retiredHistories.map(x=>x.history.historyId));
 const visit=Object.fromEntries([...catalog.sites.values()].flatMap(s=>s.codes.map(code=>[code,{first:'2026-11-19'}])));
 const awarded=V.award(catalog,visit,{},[]);
 assert.ok(awarded.added.every(x=>!retiredIds.has(x)));
});
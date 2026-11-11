const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const V=require('../sengoku-v2-core.js');
const read=p=>JSON.parse(fs.readFileSync(path.join(__dirname,'..',p),'utf8'));
const hash=s=>crypto.createHash('sha256').update(s,'utf8').digest('hex');
const d=read('sengoku/v2/approved-up-to-ujimasa.json'),old=read('sengoku/v2/approved-three-person-staging.json'),ledger=read('sengoku/v2/pin-release-20261111.json');
const known=new Set(read('data/title-registry.json').areas.map(a=>a.code));
const sites=new Map(d.sites.map(s=>[s.siteId,s]));
test('172 approved new sites add to 62 old pins and leave two nonpublic coordinates',()=>{
 assert.equal(ledger.schemaVersion,'walked.sengoku.pin-release.v2');
 assert.equal(ledger.records.length,172);assert.equal(new Set(ledger.records.map(x=>x.siteId)).size,172);
 assert.equal(d.sites.filter(s=>s.publicPin).length,234);assert.equal(d.sites.length,236);
 assert.deepEqual(d.sites.slice(0,62),old.sites);assert.deepEqual(d.people.slice(0,3),old.people);
 assert.deepEqual(d.histories.slice(0,108),old.histories);assert.deepEqual(d.relations.slice(0,78),old.relations);
 assert.deepEqual(d.sites.filter(s=>!s.publicPin).map(s=>s.siteId).sort(),['sg2site-a-naoe-uroko-yashiki','sg2site-kanbei-aga'].sort());
 assert.deepEqual(ledger.colors,{green:128,yellow:42,red:2});
 const colors={green:0,yellow:0,red:0};
 for(const e of ledger.records){
  const s=sites.get(e.siteId);assert.ok(s&&s.publicPin);
  assert.equal(s.pinApproval.user,'公開OK');assert.equal(s.pinApproval.sourceMatch,'一致');
  assert.equal(s.pinApproval.handoff,'C候補（別途公開承認）');
  assert.equal(s.pinApproval.sha256,hash(s.description));
  assert.equal(s.pinApproval.sheetRow,e.approvalRow);assert.equal(s.pinApproval.version,e.approvalVersion);
  assert.deepEqual(s.point,e.position);assert.equal(s.pinReview.sourceSheetRow,e.sourceRow);
  assert.equal(s.pinReview.accessStatus,e.accessStatus);assert.equal(s.pinReview.checkedAt,e.checkedAt);
  assert.deepEqual(s.pinPersonIds||s.personIds,e.pinPersonIds);
  assert.ok(/^https:\/\//.test(s.pinReview.officialInfoUrl));assert.ok(s.pinReview.positionEvidenceUrl);
  if(e.accessStatus==='red')assert.match(s.pinReview.restriction,/立入禁止区域/);
  colors[e.accessStatus]++;
 }
 assert.deepEqual(colors,ledger.colors);
});
test('full 20-person catalog validates, refuses swapped pin coordinates, color, approval edition and people',()=>{
 const index=V.validate(d,known,hash);
 assert.equal(index.people.size,20);assert.equal(index.histories.size,515);assert.equal(index.sites.size,236);
 assert.equal(d.sites.filter(s=>s.publicPin&&s.pinReview.accessStatus==='red').length,2);
 const sample=d.sites.find(s=>s.publicPin&&s.pinApproval.version==='v3');
 const clone=()=>JSON.parse(JSON.stringify(d));
 const position=clone();position.sites.find(s=>s.siteId===sample.siteId).point[0]+=0.00001;
 assert.throws(()=>V.validate(position,known,hash),/座標・見学区分/);
 const wrongVersion=clone();wrongVersion.sites.find(s=>s.siteId===sample.siteId).pinApproval.version='v2';
 assert.throws(()=>V.validate(wrongVersion,known,hash),/座標・見学区分|位置版/);
 const people=clone();people.sites.find(s=>s.siteId==='sg2site-kenshin-kasugayama').pinPersonIds=['sg-dc8c550d8769'];
 assert.throws(()=>V.validate(people,known,hash),/位置版⑥人物ID|元ID・人物|承認行の人物・文章種別・元ID/);
});
test('17 Date Masamune, seven Niigata sites and preserved visit/card records',()=>{
 const dateId='sg-31e0e85d7a10';
 const date=d.sites.filter(s=>(s.pinPersonIds||s.personIds).includes(dateId));
 assert.equal(date.length,17);assert.ok(date.every(s=>s.publicPin));
 const niigata=['sg2site-kenshin-kasugayama','sg2site-kenshin-rinsenji','sg2site-kenshin-tochio','sg2site-kenshin-joanji','sg2site-kenshin-sakado','sg2site-kanetsugu-untouan','sg2site-kanetsugu-yoita'];
 assert.ok(niigata.every(id=>sites.get(id)?.publicPin));
 assert.equal(sites.get('sg2site-masamune-wakabayashi').pinReview.accessStatus,'red');
 const index=V.validate(d,known,hash),visits={'06202':{first:'2019-01-01'}},oldCards={'old-card':{at:'2000-01-01'}};
 const a=V.award(index,visits,oldCards,[],'2026-11-11');
 assert.deepEqual(a.records['old-card'],oldCards['old-card']);
 assert.equal(Object.keys(a.records).length,Object.keys(oldCards).length+a.added.length);
 assert.deepEqual(V.award(index,visits,a.records,[]).added,[]);
 assert.deepEqual(visits,{'06202':{first:'2019-01-01'}});
});

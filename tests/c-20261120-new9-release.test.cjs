'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const hash=t=>crypto.createHash('sha256').update(t).digest('hex');
const core=require('../sengoku-v2-core.js');
const m=read('docs/c-release/20261120-new9-approved-manifest.json');
const base=read('sengoku/v2/approved-c-20261119-57.json');
const cur=read('sengoku/v2/approved-c-20261120-new9-80.json');
const audit=read('docs/c-release/20261120-new9-qa.json');
const codes=new Set(read('data/title-registry.json').areas.map(a=>a.code));
const index=core.validate(cur,codes,hash),bm=new Map(base.sites.map(s=>[s.siteId,s]));
const pm=new Map(cur.people.map(p=>[p.personId,p])),hm=new Map(cur.histories.map(h=>[h.historyId,h])),sm=new Map(cur.sites.map(s=>[s.siteId,s]));
test('frozen ⑥80 exactly approved and no extra records',()=>{
 assert.equal(m.approved.length,80);assert.equal(new Set(m.approved.map(x=>x.row)).size,80);
 assert.deepEqual(m.approved.map(x=>x.row).sort((a,b)=>a-b),Array.from({length:80},(_,i)=>i+3600));
 assert.equal(m.people.length,9);assert.equal(m.histories.length,43);assert.equal(m.sites.length,19);
 assert.equal(m.relations.length,28);
 assert.equal(cur.version,'v2-approved-c-20261120-new9-80');
 assert.deepEqual(audit.released,{introductions:9,stories:9,histories:43,sites:19,relations:28,redPins:10,yellowPins:5,greenPins:4});
});
test('80 exact approved ⑥ D, row/version/person/content IDs and SHA-256',()=>{
 for(const a of m.approved){
  let record,content;
  if(a.kind==='人物紹介'||a.kind==='完成版ストーリー'){
   record=pm.get(a.personId)?.[a.kind==='人物紹介'?'introduction':'story'];content=record?.text;
  }else if(a.kind==='経歴'){record=hm.get(a.originalId);content=record?.text;}
  else {record=sm.get(a.originalId);content=record?.description;}
  assert.ok(record,'missing '+a.row);
  assert.equal(content,a.text,'altered text '+a.row);
  assert.equal(record.approval.sheetRow,a.row);
  assert.equal(record.approval.version,a.version);
  assert.equal(record.approval.sha256,hash(a.text));
  assert.equal(record.approval.personId,a.personId);
  assert.equal(record.approval.sourceId,a.originalId);
  assert.equal(record.approval.rights,a.rights);
  assert.equal(record.approval.user,'公開OK');
  assert.equal(record.approval.quality,'品質合格');
  assert.equal(record.approval.handoff,'C候補（別途公開承認）');
  assert.equal(record.approval.sourceMatch,'一致');
 }
});
test('all 19 newly approved pin coordinates, color, restricted no-route, optional award',()=>{
 assert.equal(cur.sites.filter(x=>x.publicPin).length,419);
 assert.deepEqual(audit.pinPrefectureDelta,{熊本県:8,茨城県:2,秋田県:4,香川県:2,鳥取県:2,奈良県:1});
 for(const s of m.sites){
  const v=sm.get(s.id);assert.ok(v&&v.publicPin);
  assert.deepEqual(v.point,[s.longitude,s.latitude]);
  assert.equal(v.pinReview.accessStatus,s.accessStatus);
  assert.equal(v.pinReview.sourceSheetRow,s.sheetRow);
  assert.equal(v.pinReview.approvedE,s.approvedPositionAndSafety);
  assert.equal(v.pinApproval.sheetRow,s.approvalRow);
  assert.equal(v.pinApproval.sha256,hash(s.description));
  if(s.accessStatus==='red')assert.equal(core.pinDetails(v).noRouting,true);
 }
 assert.match(sm.get('sg2site-new9-tozawa-kojoyama-20261119').pinReview.restriction,/立入禁止/);
 assert.match(sm.get('sg2site-new9-sweep-aso-hama-20261120').pinReview.restriction,/学校|高校/);
});
test('28 unique B-qualified links and 12 rejected/held relations never admitted',()=>{
 const keys=new Set(m.relations.map(r=>r.historyId+'|'+r.siteId));
 assert.equal(keys.size,28);
 for(const r of m.relations){
  const found=cur.relations.find(x=>x.historyId===r.historyId&&x.siteId===r.siteId);
  assert.ok(found);assert.equal(found.bStatus,'合格');
  assert.equal(found.linkDecision,'関係上対象');
  assert.equal(found.classification,r.classification);
  assert.ok(index.codes.get(r.historyId).has(sm.get(r.siteId).municipalityCode));
 }
 const forbidden=[
  ['sg2hist-new9-aso-1559-1-20261119','sg2site-new9-sweep-aso-hama-20261120'],
  ['sg2hist-new9-sagara-1555-1-20261119','sg2site-new9-sweep-sagara-hitoyoshi-20261120'],
  ['sg2hist-new9-deep-matsu-1573-rebellion-20261120','sg2site-a-junkei-tamon-20261112'],
  ['sg2hist-new9-sogo-1582-1-20261119','sg2site-new9-sogo-castle-20261119']
 ];
 for(const [hid,sid] of forbidden)assert.ok(!cur.relations.some(x=>x.historyId===hid&&x.siteId===sid));
 const passive=sm.get('sg2site-new9-sagara-grave-20261119');
 assert.ok(passive.publicPin&&!cur.relations.some(r=>r.siteId===passive.siteId),'information-only site must not acquire card');
 assert.ok(!sm.has('sg2site-new9-matsunaga-tamon-20261119'),'old 多聞城 duplicated');
 assert.ok(sm.has('sg2site-a-junkei-tamon-20261112'));
});
test('same-year historical order and provenance preserved',()=>{
 for(const [id,order] of [
  ['sg-added-kikkawa-tsuneie-20261119',[10,20,30,40]],
  ['sg-added-yamana-toyokuni-20261119',[10,20]],
  ['sg-added-oda-ujiharu-20261119',[10,20]]]){
  const yr=id.includes('kikkawa')?1581:id.includes('yamana')?1580:1601;
  assert.deepEqual(cur.histories.filter(h=>h.personId===id&&h.eventYear===yr&&h.displayOrder).map(h=>h.displayOrder).sort((a,b)=>a-b),order);
 }
 assert.equal(pm.get('sg-40aa320a08e4').name,'松永久秀');
 assert.equal(cur.people.filter(p=>p.personId==='sg-40aa320a08e4').length,1);
 assert.equal(cur.people.length,74);assert.equal(cur.histories.length,1251);assert.equal(cur.sites.length,436);
 assert.equal(cur.relations.length,687);
});
test('prior owned cards, 400 pins, area catalog and retired history identifiers immutable',()=>{
 assert.deepEqual(cur.people.slice(0,65),base.people);
 assert.deepEqual(cur.histories.slice(0,1208),base.histories);
 assert.deepEqual(cur.retiredHistories,base.retiredHistories);
 assert.deepEqual(cur.municipalityAwards,base.municipalityAwards);
 assert.deepEqual(cur.relations.slice(0,659),base.relations);
 for(const old of base.sites){
  const now=sm.get(old.siteId);assert.ok(now);
  if(old.publicPin){
   assert.deepEqual(now.point,old.point);assert.deepEqual(now.pinApproval,old.pinApproval);
   assert.deepEqual(now.pinReview,old.pinReview);
  }
 }
 const prior={'previous-card':{at:'2018-03-01'},'sg2hist-nobu-1534-birth':{at:'2018-03-01'}};
 for(const r of m.relations){
  const code=sm.get(r.siteId).municipalityCode;
  const visited={[code]:{first:'2026-11-20'}};
  const res=core.award(index,visited,prior,[],'2026-11-20');
  assert.ok(res.added.includes(r.historyId),'not municipality-awarded '+r.historyId);
  assert.deepEqual(res.records['previous-card'],prior['previous-card']);
  const again=core.award(index,visited,res.records,[],'2026-11-21');
  assert.ok(!again.added.includes(r.historyId),'repeat award '+r.historyId);
 }
});
test('active app pointer and C records/status ledgers match approved 80 and current JSON',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 assert.match(html,/fetch\('\.\/sengoku\/v2\/approved-c-20261120-new9-80\.json'/);
 assert.ok(!html.includes("fetch('./sengoku/v2/approved-c-20261119-57.json'"));
 const status=fs.readFileSync(path.join(root,'data/c-release/status.csv'),'utf8').trim().split('\n');
 assert.equal(status.length,2);
 assert.match(status[1],/^v2-approved-c-20261120-new9-80,/);
 assert.match(status[1],/,74,1251,436,419,1835$/);
 const records=fs.readFileSync(path.join(root,'data/c-release/records.csv'),'utf8').trim().split('\n');
 assert.equal(records.length,1836);
});

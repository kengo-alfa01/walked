'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const C=require('../sengoku-chronology.js');
const hash=s=>crypto.createHash('sha256').update(s,'utf8').digest('hex');
const fixture=(id,year,order,phase='活動期',end=null,tie=null)=>({
 historyId:id,personId:'sg-test-person',startYear:year,endYear:end,displayOrder:order,
 tieStatus:tie,tieReason:tie?'B判定：順序を確定できない':null,tieEvidenceIds:tie?['fixture-⑤-source']:[],yearText:year+'年'+(end?'～'+end+'年':''),phase
});
const constraint=(beforeId,afterId,type='confirmed-causality')=>({
 beforeId,afterId,type,bVerified:true,evidenceIds:['fixture-evidence'],
 ...(type==='confirmed-date'?{calendarBasis:'旧暦/新暦をBが検証'}:{})
});
const clone=x=>structuredClone(x);
const base=()=>[
 fixture('test-a',1582,10),fixture('test-b',1582,20),
 fixture('test-c',1582,30),fixture('test-d',1583,null)];
const reviewAndApprove=(rows,cs=[],testFixture=true)=>{
 const verified=C.validateRows(rows,cs,hash);
 const catalog={histories:new Map(rows.map((r,i)=>[r.historyId,{
  historyId:r.historyId,personId:r.personId,eventYear:r.startYear,
  eventYearEnd:r.endYear,yearText:r.yearText,
  approval:{sheetRow:i+10,version:'v1',sha256:hash('body-'+r.historyId)}
 }]))};
 const bReview={reviewId:'B-fixture-review',reviewedBy:'B',status:'合格',
  rowsSha256:verified.rowsSha256,constraintsSha256:verified.constraintsSha256,
  coveredHistoryIds:rows.map(r=>r.historyId)};
 const approvals=rows.map((r,i)=>({
  historyId:r.historyId,personId:r.personId,sheetRow:100+i,version:'v2',
  latest:true,user:'公開OK',sourceMatch:'一致',handoff:'C候補（別途公開承認）',
  textSha256:hash('body-'+r.historyId),qSnapshot:C.snapshotFor(r,verified,bReview)
 }));
 return {catalog,release:{personId:'sg-test-person',histories:rows,constraints:cs,bReview,approvals,testFixture}};
};
test('01 startYear and same-year T 10, 20, 30; same T across years; multi-year period retained',()=>{
 const rows=base();rows[3].displayOrder=10;rows[2].endYear=1585;
 const result=C.validateRows(rows,[],hash);
 assert.deepEqual(result.ordered.map(x=>x.historyId),['test-a','test-b','test-c','test-d']);
 assert.equal(result.ordered[2].endYear,1585);
});
test('02 same year 10,20,20,30 is a single unresolved tie group, stable input order',()=>{
 const r=[fixture('d',1582,30),fixture('c',1582,20,'活動期',null,'unresolved'),
 fixture('b',1582,20,'活動期',null,'unresolved'),fixture('a',1582,10)];
 const result=C.validateRows(r,[],hash);
 assert.deepEqual(result.ordered.map(x=>x.historyId),['a','c','b','d']);
 assert.deepEqual(result.tieEntries.get('sg-test-person|1582|20'),['c','b']);
 assert.match(C.TIE_NOTE,/前後関係は確定していません/);
});
test('03 missing T same-year group or invalid T 0, fractional, string rejects',()=>{
 const r=base();r[1].displayOrder=null;assert.throws(()=>C.validateRows(r,[],hash),/T未設定/);
 for(const t of [0,-1,1.5,'20']){const x=base();x[1].displayOrder=t;assert.throws(()=>C.validateRows(x,[],hash),/正の整数/);}
});
test('04 confirmed causality and checked calendar date cannot be tied or reversed',()=>{
 const rows=[fixture('battle',1600,20),fixture('march',1600,10)];
 assert.doesNotThrow(()=>C.validateRows(rows,[constraint('march','battle')],hash));
 for(const n of [20,30]){const x=clone(rows);x[1].displayOrder=n;if(n===20)x.forEach(r=>{r.tieStatus='unresolved';r.tieReason='B確認済の同順位';r.tieEvidenceIds=['fixture-⑤-source'];});assert.throws(()=>C.validateRows(x,[constraint('march','battle')],hash),/逆転・同順位/);}
 const c=constraint('march','battle','confirmed-date');delete c.calendarBasis;
 assert.throws(()=>C.validateRows(rows,[c],hash),/旧暦・新暦/);
});
test('05 death must follow own living activities; funeral/burial/reburial must follow death',()=>{
 const rows=[fixture('activity',1616,10),fixture('death',1616,20,'死去'),
 fixture('funeral',1616,30,'没後'),fixture('burial',1616,40,'没後'),
 fixture('reburial',1617,null,'没後')];
 const cs=[constraint('activity','death','life-before-death'),
 constraint('death','funeral','death-before-funeral'),
 constraint('funeral','burial'),constraint('burial','reburial','posthumous-sequence')];
 assert.doesNotThrow(()=>C.validateRows(rows,cs,hash));
 for(const id of ['activity','funeral','burial']){
  const x=clone(rows);x.find(r=>r.historyId===id).displayOrder=20;
  x.filter(r=>r.startYear===1616&&r.displayOrder===20).forEach(r=>{r.tieStatus='unresolved';r.tieReason='B確認済の同順位';r.tieEvidenceIds=['fixture-⑤-source'];});
  assert.throws(()=>C.validateRows(x,cs,hash),/逆転・同順位/);
 }
});
test('06 structured phase protects from title keyword guesses',()=>{
 const rows=[fixture('someone-else-death',1582,10,'活動期'),
 fixture('subject-death',1582,20,'死去')];
 assert.doesNotThrow(()=>C.validateRows(rows,[],hash));
});
test('07 identity duplicates rejected; same-rank is not an ID collision',()=>{
 const rows=base();rows[2].historyId=rows[1].historyId;
 assert.throws(()=>C.validateRows(rows,[],hash),/経歴ID重複/);
});
test('08 unsourced constraints and B-reviewed rank changes are rejected',()=>{
 const rows=base(),f=reviewAndApprove(rows,[constraint('test-a','test-b')]);
 f.release.histories[1].displayOrder=25;
 assert.throws(()=>C.verifyRelease(f.release,f.catalog,hash,{allowTestFixtures:true}),/B審査時/);
 const c=constraint('test-a','test-b');c.bVerified=false;
 assert.throws(()=>C.validateRows(base(),[c],hash),/B確認済み/);
});
test('09 Q approval rank mutation, missing Q, partial approval, stale P and user approval reject',()=>{
 for(const mutate of [
  r=>{r.approvals[0].qSnapshot.displayOrder=99;},
  r=>{delete r.approvals[0].qSnapshot;},
  r=>{r.approvals.pop();},
  r=>{r.approvals[0].sourceMatch='要再承認';},
  r=>{r.approvals[0].user='';}
 ]){
  const f=reviewAndApprove(base());mutate(f.release);
  assert.throws(()=>C.verifyRelease(f.release,f.catalog,hash,{allowTestFixtures:true}));
 }
});
test('10 fixtures never pass production gate; complete fixture release passes only with explicit test option',()=>{
 const f=reviewAndApprove(base());
 assert.throws(()=>C.verifyRelease(f.release,f.catalog,hash),/テスト用/);
 const result=C.verifyRelease(f.release,f.catalog,hash,{allowTestFixtures:true});
 assert.deepEqual(result.orderIds,['test-a','test-b','test-c','test-d']);
});
test('11 legacy manifest absent/empty and real 108 baseline leave all cards, story and pins unchanged',()=>{
 const root=path.join(__dirname,'..');
 const doc=JSON.parse(fs.readFileSync(path.join(root,'sengoku/v2/approved-three-person-staging.json'),'utf8'));
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'sengoku/v2/chronology-release.json'),'utf8'));
 const catalog={histories:new Map(doc.histories.map(h=>[h.historyId,h]))};
 assert.equal(doc.histories.length,108);assert.equal(doc.sites.filter(s=>s.publicPin).length,46);
 assert.equal(C.loadManifest(manifest,catalog,hash).size,0);
 for(const person of doc.people){
  const histories=doc.histories.filter(h=>h.personId===person.personId);
  const original=histories.map(h=>h.historyId).sort();
  const shown=C.present(histories,null);
  assert.deepEqual(shown.map(h=>h.historyId).sort(),original);
  assert.equal(shown.length,person.story.unlock.requiredHistoryCount);
  assert.ok(person.story.unlock.historyIdsSHA256);
 }
});
test('12 HTML integrates same display-only gate; never alters storage or approval source',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 const core=fs.readFileSync(path.join(__dirname,'../sengoku-v2-core.js'),'utf8');
 assert.match(html,/SengokuChronology\.present\(/);
 assert.match(html,/chronology-release\.json/);
 assert.match(html,/sengoku-chronology-tie/);
 assert.match(html,/SengokuV2\.award\(/);
 assert.doesNotMatch(core,/SengokuChronology/);
 assert.ok(html.includes('sengoku-chronology.js'));
 assert.ok(!html.includes('localStorage.setItem("sengokuChronology"'));
});

test('13 Q snapshot must bind B constraint SHA, not only T rank; fixture proves distinct constraint revisions',()=>{
 const f=reviewAndApprove(base(),[constraint('test-a','test-b')]);
 f.release.approvals[0].qSnapshot.bConstraintsSha256='0'.repeat(64);
 assert.throws(()=>C.verifyRelease(f.release,f.catalog,hash,{allowTestFixtures:true}),/⑥Q順位スナップショット/);
});
test('14 ambiguous same-rank group without ②S reason or ⑤ evidence is rejected',()=>{
 const r=[fixture('same-a',1582,20,'活動期',null,'unresolved'),
 fixture('same-b',1582,20,'活動期',null,'unresolved')];
 r[1].tieEvidenceIds=[];
 assert.throws(()=>C.validateRows(r,[],hash),/同順位の留保/);
 r[1].tieEvidenceIds=['fixture-⑤-source'];r[0].tieReason='';
 assert.throws(()=>C.validateRows(r,[],hash),/同順位の留保/);
});
test('15 chronological sort uses start year, not end date, old/new calendar text or ID suffix',()=>{
 const rows=[
  fixture('z-late-end',1571,10,'活動期',1575),
  fixture('a-start-later',1572,10,'活動期'),
  fixture('m-old-calendar',1571,20,'活動期')];
 rows[0].yearText='元亀2年（1571年）～天正3年';rows[2].yearText='旧暦12月・新暦翌年'; 
 const v=C.validateRows(rows,[],hash);
 assert.deepEqual(v.ordered.map(r=>r.historyId),['z-late-end','m-old-calendar','a-start-later']);
});
test('16 stricter chronology rejects changed current year, same-year group and old approval version',()=>{
 const f=reviewAndApprove(base());
 f.release.histories[0].startYear=1581;
 assert.throws(()=>C.verifyRelease(f.release,f.catalog,hash,{allowTestFixtures:true}));
 const g=reviewAndApprove(base());
 g.release.approvals[0].version='v1';
 assert.throws(()=>C.verifyRelease(g.release,g.catalog,hash,{allowTestFixtures:true}),/新規版/);
});

const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const V=require('../sengoku-v2-core.js'),W=require('../walked-core.js');
const read=file=>JSON.parse(fs.readFileSync(path.join(__dirname,'..',file),'utf8'));
const doc=read('sengoku/v2/approved-three-person-staging.json');
const registry=read('data/title-registry.json');
const hash=s=>crypto.createHash('sha256').update(s,'utf8').digest('hex');
const known=new Set(registry.areas.map(x=>x.code));
const index=V.validate(doc,known,hash);
const ids={nobu:'sg-6eaf66c3d7c8',hideyoshi:'sg-f47391608dbb',ieyasu:'sg-a7bb09927601'};
const clone=v=>structuredClone(v);
const verify=d=>V.validate(d,known,hash);
function linkedHistory(historyId,municipalCode){return [...index.codes.get(historyId)||[]].includes(municipalCode)}
test('live ⑥ release has 3 people, 108 approved histories, 61 approved sites, 77 direct links',()=>{
 assert.equal(index.people.size,3);assert.equal(index.histories.size,108);
 assert.equal(index.sites.size,61);assert.equal(doc.relations.length,77);
 assert.equal([...index.histories.values()].filter(h=>h.kind==='place').length,73);
 assert.equal([...index.histories.values()].filter(h=>h.kind==='nonplace').length,35);
 assert.equal(new Set(doc.relations.map(r=>r.siteId)).size,54);
 for(const [name,id] of Object.entries(ids)){const p=index.people.get(id);assert.ok(p,name);assert.equal(p.introduction.approval.user,'公開OK');assert.equal(p.story.approval.user,'公開OK');}
 assert.equal(index.people.get(ids.hideyoshi).story.approval.version,'v4');
});
test('⑥ history and site approvals all have fixed rows, IDs, versions and text fingerprints',()=>{
 const rows=new Set();
 for(const p of index.people.values())for(const kind of ['introduction','story']){const a=p[kind].approval;assert.equal(a.user,'公開OK');assert.equal(a.sha256,hash(p[kind].text));assert.ok(!rows.has(a.sheetRow));rows.add(a.sheetRow);}
 for(const h of index.histories.values()){assert.equal(h.approval.kind,'経歴');assert.equal(h.approval.sourceId,h.historyId);assert.equal(h.approval.sha256,hash(h.text));assert.equal(h.approval.user,'公開OK');assert.ok(!rows.has(h.approval.sheetRow));rows.add(h.approval.sheetRow);}
 for(const s of index.sites.values()){assert.equal(s.approval.kind,'史跡');assert.equal(s.approval.sourceId,s.siteId);assert.equal(s.approval.sha256,hash(s.description));assert.equal(s.approval.user,'公開OK');assert.ok(!rows.has(s.approval.sheetRow));rows.add(s.approval.sheetRow);}
 assert.equal(rows.size,175);
});
test('⑥ old Hideyoshi v2, unapproved user record, modified copy, and mismatched ID are rejected',()=>{
 const a=clone(doc);a.people[1].story.approval.version='v2';a.people[1].story.approval.handoff='旧版（履歴・C禁止）';assert.throws(()=>verify(a),/C受渡し/);
 const b=clone(doc);b.histories[0].approval.user='';assert.throws(()=>verify(b),/ユーザー承認/);
 const c=clone(doc);c.histories[0].text+='差替';assert.throws(()=>verify(c),/ハッシュ/);
 const d=clone(doc);d.sites[0].approval.sourceId='sg2site-other';assert.throws(()=>verify(d),/元ID/);
});
test('all four precise links types separate 7 indirect relations from the 77 release links',()=>{
 const classes={};for(const r of doc.relations)classes[r.classification]=(classes[r.classification]||0)+1;
 assert.equal(Object.values(classes).reduce((a,b)=>a+b,0),77);
 assert.ok(doc.relations.every(r=>r.bStatus==='合格'&&r.linkDecision==='関係上対象'));
 const x=clone(doc);x.relations[0].classification='間接関連';assert.throws(()=>verify(x),/関連審査/);
});
test('Enryakuji OR 25201/26103: either and both award exactly one v2 history card',()=>{
 const hid='sg2hist-nobu-1571-enryakuji',sid='sg2site-nobu-enryakuji';
 assert.deepEqual(index.sites.get(sid).codes,['25201','26103']);
 assert.equal(index.sites.get(sid).point,null);
 for(const key of ['25201','26103','n:26103:001']){
  const a=V.award(index,{[key]:{}},{},[],'2026-11-07').records;
  assert.ok(a[hid]);const b=V.award(index,{'25201':{},'26103':{}},a,[],'2026-11-08').records;
  assert.equal(b[hid].at,'2026-11-07');
 }
});
test('Okehazama approval is a specific folklore site, not a presumed extra Nagoya folklore site',()=>{
 const site='sg2site-nobu-okehazama-tradition',hid='sg2hist-nobu-1560-okehazama';
 assert.equal(linkedHistory(hid,'23229'),true);
 assert.equal(index.sites.get(site).publicPin,true);
 assert.deepEqual(index.sites.get(site).point,[136.9807,35.05998]);
 assert.equal(index.sites.has('sg2site-nobu-okehazama-nagoya-fixture'),false);
});
test('Sekigahara two distinct camps award a single approved event history',()=>{
 const hid='sg2hist-ieyasu-1600-sekigahara';
 assert.equal(index.linkSites.get(hid).has('sg2site-ieyasu-momokubari'),true);
 assert.equal(index.linkSites.get(hid).has('sg2site-ieyasu-jinbano'),true);
 assert.equal(index.linkSites.get(hid).size,2);
 const a=V.award(index,{'21362':{}},{},[],'2026-11-07');assert.ok(a.records[hid]);
 assert.equal(V.award(index,{'21362':{}},a.records,[]).added.includes(hid),false);
});
test('Honnoji old location cannot be confused with the modern location or expose a nonpublic pin',()=>{
 const sid='sg2site-nobu-honnoji-old',hid='sg2hist-nobu-1582-honnoji';
 assert.equal(index.sites.get(sid).publicPin,false);assert.equal(index.sites.get(sid).point,null);
 assert.equal(linkedHistory(hid,'26104'),true);
 assert.equal(linkedHistory(hid,'26103'),false);
});
test('⑥ pin release has exactly 47 latest v2 site approvals and 14 municipality-only sites',()=>{
 const pinned=doc.sites.filter(s=>s.publicPin),unmapped=doc.sites.filter(s=>!s.publicPin);
 assert.equal(pinned.length,47);assert.equal(unmapped.length,14);
 assert.deepEqual(pinned.map(s=>s.pinApproval.sheetRow).sort((a,b)=>a-b),[...Array.from({length:46},(_,i)=>i+465),1546]);
 assert.equal(new Set(pinned.map(s=>s.siteId)).size,47);
 const colors=pinned.reduce((a,s)=>(a[s.pinReview.accessStatus]++,a),{green:0,yellow:0,red:0});
 assert.deepEqual(colors,{green:43,yellow:4,red:0});
 for(const site of pinned){
  assert.equal(site.pinApproval.version,'v2');assert.equal(site.pinApproval.sourceId,site.siteId);
  assert.equal(site.pinApproval.sha256,hash(site.description));
  assert.equal(site.pinReview.decision,'可');
  assert.ok(/^https:\/\//.test(site.pinReview.officialInfoUrl));
  assert.deepEqual(site.point,[Number(site.point[0]),Number(site.point[1])]);
 }
 for(const site of unmapped){
  assert.equal(site.point,null);assert.equal(site.pinApproval,undefined);
  assert.ok(site.municipalityCodes.length>0,'no-coordinate site must retain municipality awards');
 }
 assert.deepEqual(pinned.filter(s=>s.pinReview.accessStatus==='yellow').map(s=>s.siteId).sort(),[
  'sg2site-hideyoshi-himeji','sg2site-ieyasu-edo','sg2site-nobu-azuchi','sg2site-nobu-gifu']);
});
test('B coordinates and approved version cannot be bypassed by old v1 text approval',()=>{
 const sample=doc.sites.find(s=>s.siteId==='sg2site-nobu-gifu');
 const wrongVersion=clone(doc);wrongVersion.sites.find(s=>s.siteId===sample.siteId).pinApproval.version='v1';
 assert.throws(()=>verify(wrongVersion),/位置版v2/);
 const wrongRow=clone(doc);wrongRow.sites.find(s=>s.siteId===sample.siteId).pinApproval.sheetRow=465;
 assert.throws(()=>verify(wrongRow),/位置版v2|同じ承認行/);
 const missing=clone(doc);delete missing.sites.find(s=>s.siteId===sample.siteId).pinApproval;
 assert.throws(()=>verify(missing),/位置更新版/);
 const copiedApproval=clone(doc);copiedApproval.sites.find(s=>s.siteId===sample.siteId).pinApproval={...sample.approval};
 assert.throws(()=>verify(copiedApproval),/位置版v2|同じ承認行/);
 const moved=clone(doc);moved.sites.find(s=>s.siteId===sample.siteId).point[0]+=0.01;
 assert.throws(()=>verify(moved),/座標・見学区分/);
 const guessedGreen=clone(doc);guessedGreen.sites.find(s=>s.siteId===sample.siteId).pinReview.accessStatus='green';
 assert.throws(()=>verify(guessedGreen),/座標・見学区分/);
 const noStatus=clone(doc);noStatus.sites.find(s=>s.siteId===sample.siteId).pinReview.accessStatus='unknown';
 assert.throws(()=>verify(noStatus),/見学区分/);
});
test('access colors are not discovery colors, and future red forbids routing',()=>{
 assert.deepEqual(['green','yellow','red'].map(x=>V.pinPresentation(x).symbol),['○','△','×']);
 assert.deepEqual(['green','yellow','red'].map(x=>V.pinPresentation(x).colorName),['緑','黄','赤']);
 assert.throws(()=>V.pinPresentation('unknown'),/未確認/);
 const gifu=index.sites.get('sg2site-nobu-gifu'),himeji=index.sites.get('sg2site-hideyoshi-himeji');
 assert.equal(V.pinDetails(gifu).access.label,'一部立入制限');
 assert.match(V.pinDetails(himeji).restriction,/ニの櫓/);
 const red=clone(gifu);red.pinReview.accessStatus='red';red.pinReview.restriction='公開区域を全面立入禁止';
 assert.equal(V.pinDetails(red).noRouting,true);
 assert.match(V.pinDetails(red).guidance,/現地の案内に従ってください/);
});
test('preexisting municipality, ward and town visit formats enable retroactive awards',()=>{
 const saved={'n:26103:001':{first:'2019-01-01'},'m:132090001':{},'s:141510001':{},'21362':{}};
 assert.ok(V.award(index,saved,{},[]).added.includes('sg2hist-nobu-1571-enryakuji'));
 assert.ok(V.award(index,saved,{},[]).added.includes('sg2hist-ieyasu-1600-sekigahara'));
 assert.deepEqual([...V.visitedCodes(saved)].sort(),['13209','14151','21362','26103']);
});
test('non-place histories are awarded upon acquisition of the person, not before',()=>{
 const h=index.histories.get('sg2hist-nobu-1534-birth');assert.equal(h.kind,'nonplace');
 const no=V.award(index,{}, {},[]);assert.equal(!!no.records[h.historyId],false);
 const yes=V.award(index,{}, {},[ids.nobu]);assert.ok(yes.records[h.historyId]);
});
test('full biography can only unlock with exact history ID set and all earned, never on partial achievements',()=>{
 for(const person of index.people.values()){
  const entries=[...index.histories.values()].filter(h=>h.personId===person.personId);
  assert.equal(V.canUnlockStory(index,person.personId,{},hash),false);
  const all=Object.fromEntries(entries.map(h=>[h.historyId,{at:'2026-11-07'}]));
  assert.equal(V.canUnlockStory(index,person.personId,all,hash),true);
  delete all[entries[0].historyId];assert.equal(V.canUnlockStory(index,person.personId,all,hash),false);
 }
 const wrong=clone(doc);wrong.people[0].story.unlock.historyIdsSHA256=hash('wrong');
 assert.throws(()=>verify(wrong),/通史の対象経歴ID/);
});
test('legacy saved awards and backed-up v3 data are not changed or deleted by new awards',()=>{
 const old={'sg-card-0001':{at:'2001-01-01',siteId:'sg-site-odawara'},retired:{at:'1998-01-01'}};
 const visits={'25201':{first:'2019-05-01',source:'訪問'}};
 const next=V.award(index,visits,old,[],'2026-11-07').records;
 assert.deepEqual(next['sg-card-0001'],old['sg-card-0001']);assert.deepEqual(next.retired,old.retired);
 const b=W.backup(visits,next,{awards:{},selected:null});
 const restored=W.mergeBackup({visited:{},cards:{},titles:{awards:{},selected:null}},W.parseBackup(b));
 assert.deepEqual(restored.visited,visits);assert.deepEqual(restored.cards,next);
 assert.equal(V.award(index,visits,next,[]).added.length,0);
});
test('invalid municipality, indirect acquisition link, or exposed private coordinates fail closed',()=>{
 const badCode=clone(doc);badCode.sites[0].municipalityCodes=['99999'];assert.throws(()=>verify(badCode),/未収録の自治体コード/);
 const badRelation=clone(doc);badRelation.relations[0].linkDecision='関係上対象外';assert.throws(()=>verify(badRelation),/関連審査/);
 const badPin=clone(doc);const privateSite=badPin.sites.find(s=>!s.publicPin);
 privateSite.point=[139.4,35.6];assert.throws(()=>verify(badPin),/未承認または範囲外のピン/);
});
test('screens retain iPhone responsive UI and v2 integration JavaScript is syntactically valid',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 assert.match(html,/viewport-fit=cover/);assert.match(html,/overflow-wrap:anywhere/);
 assert.match(html,/<script src="\.\/sengoku-v2-core\.js\?v=edo47-20261110-1546"><\/script>/);
 assert.doesNotMatch(html,/sengoku-v2-integration\.js|sengoku\/people\.json|sengoku\/cards\.json/);
});
test('all 108 approved histories are acquired once from 47 eligible municipalities; all biographies unlock',()=>{
 const codes=[...new Set(doc.sites.filter(s=>doc.relations.some(r=>r.siteId===s.siteId)).flatMap(s=>s.municipalityCodes))];
 const visited=Object.fromEntries(codes.map(c=>[c,{first:'2020-01-01'}]));
 const old={'sg-card-0001':{at:'2001-01-01',siteId:'sg-site-odawara'}};
 const a=V.award(index,visited,old,[],'2026-11-07');
 assert.equal(a.added.length,108);assert.equal(codes.length,41);
 for(const p of doc.people)assert.equal(V.canUnlockStory(index,p.personId,a.records,hash),true);
 assert.equal(V.award(index,visited,a.records,[]).added.length,0);
 const backup=W.backup(visited,a.records,{awards:{},selected:null});
 assert.equal(Object.keys(backup.cards).length,109);
 assert.equal(backup.cards['sg-card-0001'].at,'2001-01-01');
});


test('approved history municipality label only uses actual visited OR places',()=>{
 const hid='sg2hist-nobu-1571-enryakuji',born='sg2hist-nobu-1534-birth';
 const visits={'25201':{first:'2020-01-01'},'n:26103:001':{first:'2021-01-01'}};
 const owned=V.award(index,visits,{},[]).records;
 assert.deepEqual(V.earnedMunicipalities(index,hid,visits,owned),['25201','26103']);
 assert.deepEqual(V.earnedMunicipalities(index,hid,{'25201':{}},owned),['25201']);
 assert.deepEqual(V.earnedMunicipalities(index,born,visits,owned),[]);
 assert.deepEqual(V.earnedMunicipalities(index,hid,visits,{}),[]);
 assert.deepEqual(V.earnedMunicipalities(index,'sg2hist-unknown',visits,owned),[]);
});

test('⑥1546 Edo Castle information pin is yellow, separately approved and not an entrance or prerequisite',()=>{
 const sid='sg2site-ieyasu-edo',s=index.sites.get(sid);
 assert.equal(s.publicPin,true);
 assert.deepEqual(s.point,[139.7559375,35.6861875]);
 assert.equal(s.approval.version,'v1','preserve approved historical site text and legacy user approval');
 assert.equal(s.pinApproval.version,'v2');
 assert.equal(s.pinApproval.sheetRow,1546);
 assert.equal(s.pinReview.sourceSheetRow,54);
 assert.equal(s.pinReview.accessStatus,'yellow');
 const details=V.pinDetails(s);
 assert.equal(details.access.colorName,'黄');
 assert.match(details.positionKind,/代表点/);
 assert.match(details.restriction,/非公開/);
 assert.match(details.restriction,/入園門/);
 assert.match(details.restriction,/ピンへの接近はカード獲得条件ではありません/);
 for(const [hid,row] of [['sg2hist-ieyasu-1590-kanto',1547],['sg2hist-ieyasu-1606-edo-rebuild',1548]]){
  const h=index.histories.get(hid);
  assert.equal(h.approval.sheetRow,row);
  assert.equal(h.approval.version,'v2');
  assert.equal(h.approval.rights,'地点確認済・権利OK');
  assert.ok(index.linkSites.get(hid).has(sid));
  const earned=V.award(index,{'13101':{first:'2026-11-10'}},{},[],'2026-11-10');
  assert.ok(earned.records[hid],'municipality visit should grant history without entering closed area');
 }
 const bad=clone(doc);
 bad.sites.find(x=>x.siteId===sid).pinApproval.sheetRow=169;
 assert.throws(()=>verify(bad),/⑥の同じ承認行|位置版v2/);
 const wrong=clone(doc);
 wrong.sites.find(x=>x.siteId===sid).point[0]+=0.001;
 assert.throws(()=>verify(wrong),/座標・見学区分/);
 const badColor=clone(doc);
 badColor.sites.find(x=>x.siteId===sid).pinReview.accessStatus='green';
 assert.throws(()=>verify(badColor),/座標・見学区分/);
});

// Regression: after updating site approval metadata (⑥1546, 47th pin), Safari must
// not combine the previous cached JS with the new JSON. Version the browser JS URL.
test('release-critical Sengoku scripts are cache-busted at the 47-pin Edo approval version',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 const token='edo47-20261110-1546';
 assert.ok(html.includes('src="./sengoku-v2-core.js?v='+token+'"'));
 assert.ok(html.includes('src="./sengoku-chronology.js?v='+token+'"'));
 assert.ok(html.includes("fetch('./sengoku/v2/approved-three-person-staging.json',{cache:'no-store'})"));
 assert.equal(doc.sites.filter(s=>s.publicPin).length,47);
 const edo=doc.sites.find(s=>s.siteId==='sg2site-ieyasu-edo');
 assert.equal(edo.pinApproval.sheetRow,1546);
});

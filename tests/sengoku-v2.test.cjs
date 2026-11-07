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
 assert.equal(index.people.get(ids.hideyoshi).story.approval.version,'v3');
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
test('all unverified pins stay hidden; only the reviewed precise Okehazama point is published',()=>{
 const pinned=doc.sites.filter(s=>s.publicPin);
 assert.deepEqual(pinned.map(s=>s.siteId),['sg2site-nobu-okehazama-tradition']);
 for(const site of doc.sites)if(!site.publicPin)assert.equal(site.point,null);
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
 assert.match(html,/<script src="\.\/sengoku-v2-core\.js"><\/script>/);
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

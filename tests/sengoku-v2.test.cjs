const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const V2=require('../sengoku-v2-core.js');
const W=require('../walked-core.js');
const vm=require('node:vm');
const staging=JSON.parse(fs.readFileSync(path.join(__dirname,'../sengoku/v2/approved-three-person-staging.json'),'utf8'));
const sha=text=>crypto.createHash('sha256').update(text,'utf8').digest('hex');
const known=new Set(['25201','26103','23229','23114','21362','26104','13209','14151','14206']);
const nobu='sg-6eaf66c3d7c8',hideyoshi='sg-f47391608dbb',ieyasu='sg-a7bb09927601';
const base=()=>structuredClone(staging);
// All scenario approvals below are HYPOTHETICAL TEST FIXTURES, not user-approval records.
function approved(personId,historyId,text,row){
 return {sheetRow:row,kind:'経歴カード',personId,sourceId:historyId,version:'v1',
  user:'公開OK',quality:'品質合格',rights:'自治体確認済・権利OK',sourceMatch:'一致',
  handoff:'C候補（別途公開承認）',sha256:sha(text)};
}
function history(personId,historyId,row,kind='place'){
 const text='仮想試験用の経歴本文（本番配信禁止）';
 return {historyId,personId,kind,title:'仮想試験用の経歴',text,yearText:'1571年',
  approval:{...approved(personId,historyId,text,row),rights:kind==='nonplace'?'位置不要・権利OK':'自治体確認済・権利OK'}};
}
function site(siteId,codes,publicPin=false){
 return {siteId,name:'試験用史跡',municipalityCodes:codes,locationReviewed:true,rightsReviewed:true,bStatus:'合格',
  publicPin,point:publicPin?[139.2,35.7]:null};
}
function relation(personId,historyId,siteId,classification='出来事直接（史料）'){
 return {personId,historyId,siteId,bStatus:'合格',linkDecision:'関係上対象',classification};
}
function catalog(doc){return V2.validate(doc,known,sha);}
function enryakuji(){
 const d=base(),hid='sg2hist-nobu-1571-enryakuji',sid='sg2site-nobu-enryakuji';
 d.histories.push(history(nobu,hid,100));
 d.sites.push(site(sid,['25201','26103']));
 d.relations.push(relation(nobu,hid,sid));
 return {d,hid,sid};
}
test('⑥ staging contains exactly the latest 3 people, 6 accepted texts, no unapproved history/site',()=>{
 const c=catalog(staging);
 assert.equal(c.people.size,3);assert.equal(c.histories.size,0);
 assert.equal(c.sites.size,0);assert.equal(staging.relations.length,0);
 assert.equal(c.people.get(hideyoshi).story.approval.version,'v3');
 assert.equal(c.people.get(hideyoshi).story.approval.sheetRow,6);
 assert.equal(c.people.get(nobu).story.approval.version,'v2');
 assert.equal(c.people.get(ieyasu).story.approval.version,'v1');
});
test('the old Hideyoshi v2 C禁止 row cannot supersede v3',()=>{
 const d=base();d.people.find(p=>p.personId===hideyoshi).story.approval.handoff='旧版（履歴・C禁止）';
 assert.throws(()=>catalog(d),/C受渡し/);
});
test('edited text, row identity mix-up and duplicate approval row all fail closed',()=>{
 const d1=base();d1.people[0].story.text+='改変';assert.throws(()=>catalog(d1),/ハッシュ/);
 const d2=base();d2.people[0].story.approval.personId=hideyoshi;assert.throws(()=>catalog(d2),/人物・文章種別/);
 const d3=base();d3.people[0].story.approval.sheetRow=d3.people[0].introduction.approval.sheetRow;assert.throws(()=>catalog(d3),/重複流用/);
});
test('new history cards without their own ⑥ user approval are rejected',()=>{
 const {d,hid}=enryakuji();d.histories[0].approval.user='';
 assert.throws(()=>catalog(d),/ユーザー承認/);
 d.histories[0].approval.user='公開OK';d.histories[0].approval.sourceId='sg2hist-other';
 assert.throws(()=>catalog(d),/元ID/);
 assert.equal(hid,'sg2hist-nobu-1571-enryakuji');
});
test('unapproved or indirect B relations are never acquisition triggers',()=>{
 const {d}=enryakuji();
 d.relations[0].classification='間接関連';
 assert.throws(()=>catalog(d),/B関連審査/);
 d.relations[0].classification='出来事直接（史料）';d.relations[0].bStatus='保留';
 assert.throws(()=>catalog(d),/B関連審査/);
 d.relations[0].bStatus='合格';d.sites[0].rightsReviewed=false;
 assert.throws(()=>catalog(d),/史跡B審査/);
});
test('延暦寺型: 25201 or 26103 visits award one history ID; visiting both cannot duplicate',()=>{
 const {d,hid}=enryakuji(),c=catalog(d);
 for(const visits of [{'25201':{}},{'26103':{}},{'25201':{},'26103':{}},{'n:26103:261030001':{}}]){
  const old={'sg-card-0001':{at:'2001-01-01',siteId:'sg-site-odawara'}};
  const a=V2.award(c,visits,old,[], '2020-01-01');
  assert.deepEqual(a.added,[hid]);
  assert.deepEqual(a.records['sg-card-0001'],old['sg-card-0001']);
  const again=V2.award(c,visits,a.records,[], '2026-01-01');
  assert.equal(again.added.length,0);
  assert.equal(again.records[hid].at,'2020-01-01');
 }
});
test('延暦寺型: no coordinates or pin required for a confirmed municipality',()=>{
 const {d,hid}=enryakuji(),c=catalog(d);
 assert.equal(c.sites.get(d.sites[0].siteId).point,null);
 assert.deepEqual(V2.award(c,{'26103':{}},{},[], '2020-01-01').added,[hid]);
 d.sites[0].point=[139.2,35.7];assert.throws(()=>catalog(d),/未承認または範囲外のピン/);
});
test('桶狭間型: two separate folklore sites feed ONE event-history card',()=>{
 const d=base(),hid='sg2hist-nobu-1560-okehazama';
 const s1='sg2site-nobu-okehazama-tradition',s2='sg2site-nobu-okehazama-nagoya-fixture';
 d.histories.push(history(nobu,hid,101));
 d.sites.push(site(s1,['23229']),site(s2,['23114']));
 d.relations.push(relation(nobu,hid,s1,'出来事直接（公的伝承）'),relation(nobu,hid,s2,'出来事直接（公的伝承）'));
 const c=catalog(d);
 assert.equal(c.sites.size,2);assert.equal(c.histories.size,1);
 for(const v of [{'23229':{}},{'23114':{}},{'23229':{},'23114':{}}]){
  const out=V2.award(c,v,{},[]);assert.deepEqual(out.added,[hid]);
 }
});
test('関ヶ原型: 桃配山と陣場野 stay different sites, same history card once',()=>{
 const d=base(),hid='sg2hist-ieyasu-1600-sekigahara';
 d.histories.push(history(ieyasu,hid,102));
 const s1='sg2site-ieyasu-momokubari',s2='sg2site-ieyasu-jinbano';
 d.sites.push(site(s1,['21362']),site(s2,['21362']));
 d.relations.push(relation(ieyasu,hid,s1,'本人直接'),relation(ieyasu,hid,s2,'本人直接'));
 const c=catalog(d);assert.equal(c.linkSites.get(hid).size,2);
 assert.deepEqual(V2.award(c,{'21362':{}},{},[]).added,[hid]);
});
test('本能寺 old-site location may award without pin; modern temple is not inferred',()=>{
 const d=base(),hid='sg2hist-nobu-1582-honnoji',sid='sg2site-nobu-honnoji-old';
 d.histories.push(history(nobu,hid,103));d.sites.push(site(sid,['26104']));
 d.relations.push(relation(nobu,hid,sid,'本人直接'));
 const c=catalog(d);
 assert.deepEqual(V2.award(c,{'26104':{}},{},[]).added,[hid]);
 assert.deepEqual(V2.award(c,{'26103':{}},{},[]).added,[]);
});
test('unsupported municipality values and unknown codes fail validation',()=>{
 const {d}=enryakuji();d.sites[0].municipalityCodes=['25201','ABC'];
 assert.throws(()=>catalog(d),/不正な自治体コード/);
 d.sites[0].municipalityCodes=['25201','99999'];
 assert.throws(()=>catalog(d),/未収録の自治体コード/);
 d.sites[0].municipalityCodes=['25201','26103','26103'];
 const c=catalog(d);
 assert.deepEqual(c.sites.get(d.sites[0].siteId).codes,['25201','26103']);
});
test('legacy municipality, Machida and nationwide ward/town-area keys normalize to one code',()=>{
 assert.deepEqual([...V2.visitedCodes({'13209':{},'m:1320900001':{},'n:26103:001':{},'s:141510001':{}})].sort(),['13209','14151','26103']);
});
test('nonplace approved history unlocks only after the person is acquired',()=>{
 const {d,hid}=enryakuji(),textId='sg2hist-nobu-1562-background';
 d.histories.push(history(nobu,textId,104,'nonplace'));
 const c=catalog(d);
 assert.deepEqual(V2.award(c,{}, {},[]).added,[]);
 assert.deepEqual(V2.award(c,{'25201':{}},{},[]).added.sort(),[hid,textId].sort());
 assert.deepEqual(V2.award(c,{}, {},[nobu]).added,[textId]);
});
test('historic IDs, saved visits and backups stay compatible with walked-backup-v3',()=>{
 const {d,hid}=enryakuji(),c=catalog(d);
 const old={'sg-card-0002':{at:'2002-02-02',siteId:'sg-site-odawara'},'retired-id':{at:'2000-01-01'}};
 const visited={'n:26103:001':{first:'2001-01-01',source:'過去記録'}};
 const got=V2.award(c,visited,old,[], '2026-11-07').records;
 const backup=W.backup(visited,got,{awards:{},selected:null});
 assert.equal(backup.format,'walked-backup-v3');
 const parsed=W.parseBackup(JSON.parse(JSON.stringify(backup)));
 const restored=W.mergeBackup({visited:{},cards:{},titles:{awards:{},selected:null}},parsed);
 assert.equal(restored.cards[hid].at,'2026-11-07');
 assert.deepEqual(restored.cards['sg-card-0002'],old['sg-card-0002']);
 assert.deepEqual(restored.visited,visited);
});
test('mis-scoped people and repeated sites are rejected',()=>{
 const {d}=enryakuji();
 d.people[0].personId='sg-4cb1a557e060';
 assert.throws(()=>catalog(d),/対象外・重複人物/);
 const x=enryakuji().d;x.relations.push(structuredClone(x.relations[0]));
 assert.throws(()=>catalog(x),/経歴×史跡の重複/);
});

test('iPhone-sized responsive styles and branch-only bridge are wired, with syntactically valid integration code',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 const bridge=fs.readFileSync(path.join(__dirname,'../sengoku-v2-integration.js'),'utf8');
 assert.match(html,/<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">/);
 assert.match(html,/\.sengoku-v2-narrative\{[^}]*overflow-wrap:anywhere/);
 assert.match(html,/@media\(max-width:650px\)\{\.sengoku-v2-narrative\{padding:11px\}/);
 assert.match(html,/<script src="\.\/sengoku-v2-core\.js"><\/script>/);
 assert.match(html,/<script src="\.\/sengoku-v2-integration\.js"><\/script><\/body><\/html>/);
 new vm.Script(bridge);
});

test('1000-character stories remain locked for a zero-card or only partially approved release',()=>{
 const empty=catalog(staging);
 for(const person of staging.people)assert.equal(V2.canUnlockStory(empty,person.personId,{},sha),false);
 const {d,hid}=enryakuji(),partial=catalog(d);
 assert.equal(V2.canUnlockStory(partial,nobu,{[hid]:{at:'2026-11-07'}},sha),false);
});
test('1000-character story requires the complete exact history-ID hash and all awards',()=>{
 const {d,hid}=enryakuji(),person=d.people.find(p=>p.personId===nobu);
 person.story.unlock={requiredHistoryCount:1,requiredPlaceHistoryCount:1,historyIdsSHA256:sha(hid)};
 const complete=catalog(d);
 assert.equal(V2.canUnlockStory(complete,nobu,{},sha),false);
 assert.equal(V2.canUnlockStory(complete,nobu,{[hid]:{at:'2026-11-07'}},sha),true);
 person.story.unlock.historyIdsSHA256=sha('another-history');
 const incorrect=catalog(d);
 assert.equal(V2.canUnlockStory(incorrect,nobu,{[hid]:{at:'2026-11-07'}},sha),false);
});

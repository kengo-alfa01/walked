'use strict';
/*
 * C v6 release preflight. This reads a frozen SHA-256/ID approval snapshot,
 * never unapproved prose. The main release may NOT be switched until the
 * --candidate check succeeds and separate release authorization is given.
 *
 * node scripts/check-c-v6-prepublish.cjs
 * node scripts/check-c-v6-prepublish.cjs --candidate path/to/preview.json
 */
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const core=require('../sengoku-v2-core.js');
const read=rel=>JSON.parse(fs.readFileSync(path.resolve(root,rel),'utf8'));
const sha=text=>crypto.createHash('sha256').update(text,'utf8').digest('hex');
const frozen=read('docs/c-release/20261124-v6-approved-diff.json');
const source=read('sengoku/v2/approved-c-20261120-new9-80.json');
const keys=items=>items.map(x=>x.kind+'|'+x.id);
function csvRows(str){
 const rows=[];let row=[],value='',quoted=false;
 for(let i=0;i<str.length;i++){
  const ch=str[i];
  if(quoted){if(ch==='"'){if(str[i+1]==='"'){value+='"';i++}else quoted=false}else value+=ch}
  else if(ch==='"')quoted=true;
  else if(ch===','){row.push(value);value=''}
  else if(ch==='\n'){row.push(value.replace(/\r$/,''));rows.push(row);row=[];value=''}
  else value+=ch;
 }
 if(value||row.length){row.push(value);rows.push(row)}
 return rows;
}
const rawCsv=fs.readFileSync(path.join(root,'data/c-release/records.csv'),'utf8');
const csv=csvRows(rawCsv),header=csv.shift();
assert.deepEqual(header.slice(0,5),['kind','content_id','name','approval_row','approval_version']);
const published=new Map(csv.filter(r=>r[0]).map(r=>[r[0]+'|'+r[1],r]));
function checkManifest(){
 assert.equal(frozen.schema,'nmf-c-v6-frozen-approved-difference-v1');
 assert.equal(frozen.status,'PREPUBLISH_ONLY_NOT_LIVE');
 assert.equal(frozen.approvedDiffCount,764);
 assert.equal(frozen.items.length,764);
 assert.deepEqual(frozen.kinds,{史跡:195,経歴:464,完成版ストーリー:57,人物紹介:48});
 assert.equal(frozen.sourceReferenceCount,2807);
 assert.equal(published.size,1835);
 const unique=new Set(keys(frozen.items));
 assert.equal(unique.size,764,'承認IDと種別の重複');
 const personIds=new Set();
 for(const item of frozen.items){
  assert(Number.isInteger(item.row)&&item.row>=2);
  assert(/^v[1-9][0-9]*$/.test(item.version));
  assert(/^[a-f0-9]{64}$/.test(item.bodySha256));
  assert(Array.isArray(item.personIds)&&item.personIds.length>0);
  assert(Array.isArray(item.sourceIds)&&item.sourceIds.length>0);
  assert(['位置不要・権利OK','自治体確認済・権利OK','地点確認済・権利OK'].includes(item.rights));
  assert(![4041,4466].includes(item.row));
  assert.notEqual(item.id,'sg2hist-a54-ando-succession-1553-54-20261121');
  assert(item.kind==='人物紹介'||item.kind==='完成版ストーリー'||item.kind==='経歴'||item.kind==='史跡');
  const pub=published.get(item.kind+'|'+item.id);
  assert(!pub||(Number(pub[3])!==item.row||pub[4]!==item.version),'本番の版と差分が同一になっている');
  if(item.kind==='人物紹介')personIds.add(item.id);
 }
 const new14=['sg-596de9e9d2c2','sg-79a4eefd8d40','sg-master-0344','sg-master-0345','sg-master-0680','sg-master-0301','sg-master-1996','sg-37fdfb0d52c1','sg-master-0062','sg-added-new14-asakura-soteki-20261120','sg-added-new14-katakura-kagetsuna-20261120','sg-added-new14-ashina-moriuji-20261120','sg-added-new14-nagano-narimasa-20261120','sg-added-new14-sogo-kazumasa-20261120'];
 for(const id of new14)assert(personIds.has(id),'新14人物紹介の⑥承認がありません '+id);
 assert.equal(frozen.holds.retiredHistoryIds.length,2);
 assert.equal(frozen.holds.retiredRelationKeys.length,2);
 assert.equal(source.people.length,74);
 return new14;
}
function releaseContents(doc){
 return [
 ...doc.people.flatMap(p=>[{kind:'人物紹介',id:p.personId,personIds:[p.personId],text:p.introduction?.text,approval:p.introduction?.approval},{kind:'完成版ストーリー',id:p.personId,personIds:[p.personId],text:p.story?.text,approval:p.story?.approval}]),
 ...doc.histories.map(h=>({kind:'経歴',id:h.historyId,personIds:[h.personId],text:h.text,approval:h.approval})),
 ...doc.sites.map(s=>({kind:'史跡',id:s.siteId,personIds:s.approvedPersonIds||s.personIds,text:s.description,approval:s.approval}))
 ];
}
function checkCandidate(doc,new14){
 assert.equal(doc.schemaVersion,source.schemaVersion,'schema変更は禁止');
 assert.equal(doc.sourceSpreadsheetId,source.sourceSpreadsheetId,'正本変更は禁止');
 assert.equal(doc.people.length,88,'既存74人＋新14人の88人である必要があります');
 assert.equal(new Set(doc.people.map(p=>p.personId)).size,88);
 for(const p of source.people)assert(doc.people.some(x=>x.personId===p.personId),'旧人物が消えました: '+p.personId);
 for(const id of new14)assert(doc.people.some(p=>p.personId===id),'新人物が欠けました: '+id);
 const content=releaseContents(doc),map=new Map(content.map(x=>[x.kind+'|'+x.id,x]));
 assert.equal(content.length,map.size,'全種別のID重複');
 const baselineContent=new Map(releaseContents(source).map(x=>[x.kind+'|'+x.id,x]));
 const expected=new Set(keys(frozen.items));
 for(const item of frozen.items){
  const found=map.get(item.kind+'|'+item.id);
  assert(found,'最新版承認が未収録 '+item.kind+'|'+item.id);
  assert.equal(found.approval.sheetRow,item.row,'⑥承認行不一致 '+item.id);
  assert.equal(found.approval.version,item.version,'⑥承認版不一致 '+item.id);
  assert.equal(found.approval.sha256,item.bodySha256,'⑥SHA属性不一致 '+item.id);
  assert.equal(sha(found.text),item.bodySha256,'本文SHA不一致 '+item.id);
  assert.deepEqual(found.personIds,item.personIds,'承認人物IDの増減 '+item.id);
 }
 for(const [key,part] of map){
  assert(baselineContent.has(key)||expected.has(key),'⑥未承認の新規公開ID '+key);
  if(!expected.has(key)&&baselineContent.has(key)){
   const old=baselineContent.get(key);
   assert.deepEqual(part.approval,old.approval,'⑥承認差分外の版変更 '+key);
   assert.equal(part.text,old.text,'⑥承認差分外の本文変更 '+key);
  }
 }
 for(const hid of frozen.holds.retiredHistoryIds)assert(!doc.histories.some(h=>h.historyId===hid),'旧統合カードが有効 '+hid);
 for(const key of frozen.holds.retiredRelationKeys)assert(!doc.relations.some(r=>r.historyId+'|'+r.siteId===key),'旧B対象外の取得関係が有効 '+key);
 assert(!doc.histories.some(h=>h.historyId==='sg2hist-a54-ando-succession-1553-54-20261121'),'安東愛季の根拠保留が混入');
 assert(!(doc.retiredHistories||[]).some(r=>r.history&&r.history.text),'廃止カードの全文を本番JSONに再収録しない');
 const oldPin=new Map(source.sites.filter(s=>s.publicPin).map(s=>[s.siteId,s.point]));
 for(const [sid,coords]of oldPin){
  const now=doc.sites.find(s=>s.siteId===sid);
  assert(now&&now.publicPin,'既存公開ピンの欠落 '+sid);
  assert.deepEqual(now.point,coords,'既存ピン座標の未許可変更 '+sid);
 }
 for(const p of doc.people){
  const hs=doc.histories.filter(h=>h.personId===p.personId);
  const actual={requiredHistoryCount:hs.length,requiredPlaceHistoryCount:hs.filter(h=>h.kind==='place').length,historyIdsSHA256:sha(hs.map(h=>h.historyId).sort().join('\n'))};
  assert.deepEqual(p.story.unlock,actual,'通史カード解放条件の不一致 '+p.personId);
 }
 const known=new Set(read('data/title-registry.json').areas.map(a=>a.code));
 const catalog=core.validate(doc,known,sha);
 assert.equal(catalog.people.size,88);
 console.log(JSON.stringify({phase:'C_V6_PREPUBLISH',status:'PASS_PENDING_SEPARATE_RELEASE_APPROVAL',approvedRows:764,people:catalog.people.size,histories:catalog.histories.size,sites:catalog.sites.size,relations:doc.relations.length,publicPins:[...catalog.sites.values()].filter(s=>s.publicPin).length},null,2));
}
const new14=checkManifest();
if(process.argv[2]==='--candidate'){
 if(!process.argv[3])throw Error('candidate JSON path is required');
 const candidate=JSON.parse(fs.readFileSync(path.resolve(process.argv[3]),'utf8'));
 checkCandidate(candidate,new14);
}else if(process.argv.length===2||process.argv[2]==='--check-manifest'){
 console.log(JSON.stringify({phase:'C_V6_PREPUBLISH',status:'MANIFEST_PASS_RELEASE_NOT_BUILT',approvedRows:764,sourceReferences:2807,missingFromLive:764,newPeopleApproved:14,liveBaseline:1835},null,2));
}else{throw Error('Unknown option: '+process.argv[2])}

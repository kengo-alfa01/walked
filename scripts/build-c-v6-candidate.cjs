#!/usr/bin/env node
'use strict';
/* Japan Mifuroku — C v6 staged builder. NO production pointer changes. */
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const load=rel=>JSON.parse(fs.readFileSync(path.join(root,rel),'utf8'));
const hash=text=>crypto.createHash('sha256').update(text,'utf8').digest('hex');
const base=load('sengoku/v2/approved-c-20261120-new9-80.json');
const freeze=load('docs/c-release/20261124-v6-approved-prose.json');
const master=load('docs/c-release/20261124-v6-master-metadata.json');
const clone=o=>structuredClone(o);
const {sanitize}=require('./c-v6-sanitize.cjs');
const core=require('../sengoku-v2-core.js');
assert.equal(freeze.releaseStatus,'STAGING_ONLY');
assert.equal(freeze.approved.length,765,'⑥承認件数が765件でない');
assert.equal(master.relations.length,880,'B合格関係が想定外');
const version='v2-approved-c-20261124-88-staging';
const p=clone(base);p.version=version;p.retiredHistories=[];
const personMap=new Map(p.people.map(x=>[x.personId,x]));
const historyMap=new Map(p.histories.map(x=>[x.historyId,x]));
// Freeze an already-approved site's TEXT owner before adding new ④ owners.
for(const site of p.sites)if(!site.approvedPersonIds)
 site.approvedPersonIds=String(site.approval.personId||'').split('\n').filter(Boolean);
const siteMap=new Map(p.sites.map(x=>[x.siteId,x]));
const hMaster=new Map(master.history.map(x=>[x.id,x]));
const sMaster=new Map(master.sites.map(x=>[x.id,x]));
const unique=a=>[...new Set(a)];
const urls=ids=>unique(ids.map(id=>master.sourceUrls[id]).filter(u=>typeof u==='string'&&u.startsWith('https://')));
const personApproval=new Map(), historyApproval=new Map(), siteApproval=new Map();
for(const a of freeze.approved){
 const key=a.kind+'|'+(a.id||a.personIds[0]);
 const curr= a.kind==='人物紹介'||a.kind==='完成版ストーリー'?personApproval:a.kind==='経歴'?historyApproval:siteApproval;
 const fullkey=a.kind==='人物紹介'||a.kind==='完成版ストーリー'?key:a.id;
 if(curr.has(fullkey))throw Error('⑥承認元ID重複 '+key);
 curr.set(fullkey,a);
}
const asApproval=a=>({
 sheetRow:a.row,version:a.version,user:'公開OK',quality:'品質合格',rights:a.rights,
 handoff:'C候補（別途公開承認）',sourceMatch:'一致',sha256:hash(a.text),
 kind:a.kind,personId:a.personIds.join('\n'),sourceId:a.id||null
});
// ⑥の最新版人物紹介・通史の版別承認だけを使う。
for(const a of freeze.approved.filter(x=>x.kind==='人物紹介'||x.kind==='完成版ストーリー')){
 const id=a.personIds[0];assert.equal(a.personIds.length,1);
 let person=personMap.get(id);
 if(!person){person={personId:id,name:a.name};personMap.set(id,person);p.people.push(person)}
 assert.equal(person.name,a.name,'人物名・人物ID同定 '+id);
 const field=a.kind==='人物紹介'?'introduction':'story';
 const prev=person[field]||{};
 person[field]={...prev,text:a.text,yearText:a.year||prev.yearText||'',approval:asApproval(a)};
}
// ⑥承認済み②経歴本文と、②元ID・I/J/Tの時系列を同版で格納。
for(const a of freeze.approved.filter(x=>x.kind==='経歴')){
 const m=hMaster.get(a.id);assert(m,'②元経歴ID不明 '+a.id);
 assert(m.B==='B合格'&&m.adoption==='採用候補','②品質/採用ゲート '+a.id);
 assert.equal(m.personId,a.personIds[0],'②M・⑥M人物不一致 '+a.id);
 const old=historyMap.get(a.id)||{};
 const start=/^\d{3,4}$/.test(String(m.start))?Number(m.start):null;
 const end=/^\d{3,4}$/.test(String(m.end))?Number(m.end):null;
 const rec={...old,historyId:a.id,personId:m.personId,title:a.title,yearText:m.yearText||a.year||'年次未詳',
  eventYear:start,eventYearEnd:end,text:a.text,sourceIds:unique(a.sourceIds),
  sourceUrls:urls(a.sourceIds),approval:asApproval(a)};
 if(m.displayOrder!==''&&Number.isFinite(Number(m.displayOrder)))rec.displayOrder=Number(m.displayOrder);
 historyMap.set(a.id,rec);
 if(!old.historyId)p.histories.push(rec);
 else p.histories[p.histories.findIndex(x=>x.historyId===a.id)]=rec;
}
// 史跡の本文と市区町村取得はピン公開と独立。新地点は位置専用承認・実機QAまでピン非公開。
for(const a of freeze.approved.filter(x=>x.kind==='史跡')){
 const m=sMaster.get(a.id);assert(m,'③元史跡ID不明 '+a.id);
 assert(['地点確認済','自治体確認済'].includes(m.B),'③B位置審査未了 '+a.id);
 assert(['採用','採用候補'].includes(m.adoption),'③掲載決定未完 '+a.id);
 assert(m.license==='条件付き','③利用条件未確認 '+a.id);
 assert(m.municipalityCodes.length>0&&m.municipalityCodes.every(c=>/^\d{5}$/.test(String(c))),
  '③自治体コード不正 '+a.id);
 const old=siteMap.get(a.id);
 const ids=a.personIds;
 let site=old?{...old}:{
  siteId:a.id,publicPin:false,point:null,pinApproval:null,pinReview:null,
  locationReviewed:true,rightsReviewed:true,bStatus:'合格'
 };
 site.name=a.title;site.description=a.text;site.personIds=unique([...(old?.personIds||[]),...ids]);
 site.approvedPersonIds=ids;site.municipalityCodes=m.municipalityCodes;
 site.municipalityCode=m.municipalityCodes[0];site.locationAccuracy=m.accuracy;
 site.sourceIds=unique(a.sourceIds);site.sourceUrls=urls(a.sourceIds);site.approval=asApproval(a);
 // Never change previously approved GPS or show a new pin before independent approval.
 if(!old){site.publicPin=false;site.point=null;site.pinReview=null;site.pinApproval=null;}
 if(old){p.sites[p.sites.findIndex(x=>x.siteId===a.id)]=site}
 else p.sites.push(site);
 siteMap.set(a.id,site);
}
// Every Q=対象 / P=B合格 link must refer to a published history and a published site.
// Preserve old approved ID/coordinates while expanding person ownership by ④.
const links=[],rejected=[];
for(const r of master.relations){
 const h=historyMap.get(r.historyId),s=siteMap.get(r.siteId);
 if(!h||!s){rejected.push({row:r.row,historyId:r.historyId,siteId:r.siteId,reason:!h?'経歴未公開':'史跡未公開'});continue}
 if(h.personId!==r.personId)throw Error('④人物帰属不一致 '+r.historyId+' / '+r.siteId);
 s.personIds=unique([...(s.personIds||[]),r.personId]);
 links.push({personId:r.personId,historyId:r.historyId,siteId:r.siteId,
  classification:r.classification,bStatus:'合格',linkDecision:'関係上対象',
  sourceIds:unique(r.sourceIds),sourceUrls:urls(r.sourceIds)});
}
p.relations=links;
// Recalculate current place/non-place classification based on full B-approved ④.
const placeIds=new Set(links.map(x=>x.historyId));
for(const h of p.histories)h.kind=placeIds.has(h.historyId)?'place':'nonplace';
const pinnedIds=new Set(base.sites.filter(x=>x.publicPin).map(x=>x.siteId));
for(const s of p.sites){if(pinnedIds.has(s.siteId)&&(!s.publicPin||!s.point))throw Error('既存ピン破壊 '+s.siteId)}
// Revise the six preexisting municipality award references only to the current
// approved history's new ⑥ row/version. Never grant additional municipality awards.
for(const award of p.municipalityAwards||[]){
 const h=historyMap.get(award.historyId);if(h){award.approvalRow=h.approval.sheetRow;award.approvalVersion=h.approval.version}
}
// Prevent historical text in retiredHistories, and recalc the exact playable set.
// The safe-retirement pass expects the candidate's unlock metadata to exist.
for(const person of p.people){
 const histories=p.histories.filter(h=>h.personId===person.personId);
 if(!person.story)throw Error('完成版ストーリー未収録 '+person.personId);
 person.story.unlock={requiredHistoryCount:histories.length,
 requiredPlaceHistoryCount:histories.filter(h=>h.kind==='place').length,
 historyIdsSHA256:hash(histories.map(h=>h.historyId).sort().join('\n'))};
}
const safe=sanitize(p);
for(const person of safe.people){
 const histories=safe.histories.filter(h=>h.personId===person.personId);
 assert(histories.length>0,'本文だけの人物を公開しない '+person.personId);
 person.story.unlock={requiredHistoryCount:histories.length,
 requiredPlaceHistoryCount:histories.filter(h=>h.kind==='place').length,
 historyIdsSHA256:hash(histories.map(h=>h.historyId).sort().join('\n'))};
}
safe.notes={...safe.notes,cRelease:{...safe.notes?.cRelease,
 v6:{version,approvedRows:freeze.approved.map(x=>x.row),
  newPeople:14,approvedContentCount:765,
  withheldNewPinCount:safe.sites.filter(s=>!base.sites.some(b=>b.siteId===s.siteId)).length,
  excludedRelations:rejected,publication:'STAGING_ONLY_NOT_LIVE'}}};
const reg=load('data/title-registry.json');
const known=new Set(reg.areas.map(x=>x.code));
const index=core.validate(safe,known,hash);
assert.equal(index.people.size,88);
assert.equal(safe.histories.length,1590);
assert.equal(safe.sites.length,556);
assert.equal(new Set(safe.relations.map(x=>x.historyId+'|'+x.siteId)).size,safe.relations.length);
const output='sengoku/v2/approved-c-20261124-v6-staging.json';
fs.writeFileSync(path.join(root,output),JSON.stringify(safe,null,2)+'\n','utf8');
const report={version,stagingOnly:true,people:safe.people.length,histories:safe.histories.length,
 sites:safe.sites.length,relations:safe.relations.length,publishedPins:safe.sites.filter(x=>x.publicPin).length,
 rejectedRelations:rejected.length,rejectedExamples:rejected.slice(0,30),
 approvedContent:freeze.approved.length,retiredHistories:safe.retiredHistories.length,
 source:'⑥公開最終承認',out:output};
const reportPath='docs/c-release/20261124-v6-build-qa.json';
fs.writeFileSync(path.join(root,reportPath),JSON.stringify(report,null,2)+'\n');
console.log('C_V6_CANDIDATE_BUILT '+JSON.stringify(report));

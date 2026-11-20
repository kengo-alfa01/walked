#!/usr/bin/env node
'use strict';
// C 2026-11-20: solely the exact 80 latest ⑥-approved rows, independent of other C queues.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const load=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const save=(p,o)=>{const dest=path.join(root,p);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,JSON.stringify(o,null,2)+'\n','utf8')};
const sha=s=>crypto.createHash('sha256').update(s,'utf8').digest('hex');
const hashGitBlob=b=>crypto.createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
const assert=(yes,msg)=>{if(!yes)throw Error('C new9 abort: '+msg)};
const unique=a=>[...new Set(a)],deep=x=>JSON.parse(JSON.stringify(x));
const m=load('docs/c-release/20261120-new9-approved-manifest.json');
const baseBuffer=fs.readFileSync(path.join(root,m.baselinePath));
const base=JSON.parse(baseBuffer.toString('utf8'));
assert(m.batchId==='C-20261120-NEW9-80'&&m.targetVersion==='v2-approved-c-20261120-new9-80','wrong approved batch');
assert(hashGitBlob(baseBuffer)===m.baselineBlobSha,'stale or changed published base blob');
assert(m.approved.length===80&&m.people.length===9&&m.histories.length===43&&m.sites.length===19&&m.relations.length===28,'batch count drift');
assert(base.people.length===65&&base.histories.length===1208&&base.sites.length===417&&base.sites.filter(s=>s.publicPin).length===400,'published baseline count drift');
const types={};for(const a of m.approved){types[a.kind]=(types[a.kind]||0)+1;
 assert(a.row>=3600&&a.row<=3679&&a.version==='v1'&&a.gates.F==='公開OK'&&a.gates.H==='品質合格'&&
  a.gates.J==='C候補（別途公開承認）'&&a.gates.P==='一致','unapproved ⑥ '+a.row);
 assert(typeof a.text==='string'&&a.text.length>5,'missing exact ⑥ prose '+a.row);}
assert(JSON.stringify(types)===JSON.stringify({史跡:19,人物紹介:9,完成版ストーリー:9,経歴:43}), 'approval types drift');
assert(new Set(m.approved.map(a=>a.row)).size===80,'duplicate ⑥ row');
const pair=(kind,id)=>m.approved.find(a=>a.kind===kind&&(kind==='人物紹介'||kind==='完成版ストーリー'?a.personId===id:a.originalId===id));
const sources=new Map(m.sources.map(s=>[s.sourceId,s]));
const urls=ids=>unique(ids.map(id=>sources.get(id)?.url).filter(u=>typeof u==='string'&&/^https:\/\//.test(u)));
const approval=a=>({sheetRow:a.row,version:a.version,user:a.gates.F,quality:a.gates.H,rights:a.rights,
 handoff:a.gates.J,sourceMatch:a.gates.P,sha256:sha(a.text),kind:a.kind,personId:a.personId,sourceId:a.originalId});
const p=deep(base);p.version=m.targetVersion;
const oldPeople=new Set(base.people.map(p=>p.personId)),oldHists=new Set(base.histories.map(h=>h.historyId)),oldSites=new Set(base.sites.map(s=>s.siteId));
const personMap=new Map(m.people.map(p=>[p.personId,p]));
assert(personMap.size===9&&m.people.some(x=>x.name==='松永久秀'&&x.personId==='sg-40aa320a08e4'),'canonical existing Matsunaga master ID not reused');
for(const row of m.people){
 assert(!oldPeople.has(row.personId)&&row.sheetRow>=2,'duplicate person '+row.personId);
 const intro=pair('人物紹介',row.personId),story=pair('完成版ストーリー',row.personId);
 assert(intro&&story&&intro.name===row.name&&story.name===row.name,'missing 9 intro/story');
 p.people.push({personId:row.personId,name:row.name,
  introduction:{text:intro.text,yearText:intro.year||'',approval:approval(intro)},
  story:{text:story.text,yearText:story.year||'',approval:approval(story),unlock:null}});
}
const qualified=new Map(),relationKeys=new Set();
for(const r of m.relations){
 assert(r.bStatus==='合格'&&r.linkDecision==='関係上対象'&&r.adoption==='採用候補'&&
  ['本人直接','出来事直接（史料）','出来事直接（公的伝承）'].includes(r.classification),
  'not B eligible '+r.sheetRow);
 assert(!relationKeys.has(r.historyId+'|'+r.siteId),'duplicate ④ relationship');
 relationKeys.add(r.historyId+'|'+r.siteId);
 assert(personMap.has(r.personId),'relationship outside new nine');
 qualified.set(r.historyId,(qualified.get(r.historyId)||0)+1);
}
for(const h of m.histories){
 const a=pair('経歴',h.id);
 assert(a&&a.text===h.text&&a.title===h.title&&a.personId===h.personId,'②／⑥ mismatched history '+h.id);
 assert(!oldHists.has(h.id)&&h.masterAdoption==='採用候補'&&h.review==='B合格','unapproved/duplicate history '+h.id);
 const place=qualified.has(h.id);
 const result={historyId:h.id,personId:h.personId,kind:place?'place':'nonplace',
  title:a.title,yearText:h.yearText||a.year||'年次未詳',
  eventYear:/^\d{3,4}$/.test(String(h.startYear||''))?Number(h.startYear):null,
  eventYearEnd:/^\d{3,4}$/.test(String(h.endYear||''))?Number(h.endYear):null,
  text:a.text,sourceIds:unique(h.sourceIds),sourceUrls:urls(h.sourceIds),approval:approval(a)};
 if(h.displayOrder!==null&&h.displayOrder!==''&&Number.isFinite(Number(h.displayOrder)))
  result.displayOrder=Number(h.displayOrder);
 p.histories.push(result);
}
for(const s of m.sites){
 const a=pair('史跡',s.id);
 assert(a&&a.text===s.description&&a.title===s.name&&a.personId===s.personId,'③／⑥ mismatched site '+s.id);
 assert(!oldSites.has(s.id)&&!m.excludedIds.includes(s.id),'duplicate/retired site '+s.id);
 assert(s.siteReview==='地点確認済'&&s.masterDecision==='採用候補'&&
  s.license==='条件付き'&&['green','yellow','red'].includes(s.accessStatus)&&
  Number.isFinite(s.latitude)&&Number.isFinite(s.longitude)&&/^\d{5}$/.test(s.municipalityCode),
  'site B/GPS/rights failed '+s.id);
 assert(a.related===s.approvedPositionAndSafety&&
  (a.related.includes(String(s.latitude))&&a.related.includes(String(s.longitude))),
  '⑥ approved GPS/safety mismatch '+s.id);
 const pinReview={sourceSheetRow:s.sheetRow,decision:'可',locationKind:s.positionKind,
  accessStatus:s.accessStatus,restriction:s.approvedPositionAndSafety,checkedAt:'2026-11-20',
  municipality:s.municipality,officialInfoUrl:urls(s.sourceIds)[0]||null,
  positionEvidenceUrl:urls(s.sourceIds).at(-1)||null,positionSourceIds:unique(s.sourceIds),
  approvedE:s.approvedPositionAndSafety};
 p.sites.push({siteId:s.id,name:a.title,description:a.text,personIds:[s.personId],
  approvedPersonIds:[s.personId],pinPersonIds:[s.personId],
  municipalityCodes:[s.municipalityCode],municipalityCode:s.municipalityCode,
  locationReviewed:true,rightsReviewed:true,bStatus:'合格',
  publicPin:true,point:[s.longitude,s.latitude],locationAccuracy:s.masterLocationAccuracy,
  sourceIds:unique(s.sourceIds),sourceUrls:urls(s.sourceIds),
  approval:approval(a),pinApproval:approval(a),pinReview});
}
const sitesById=new Map(p.sites.map(s=>[s.siteId,s]));
for(const r of m.relations){
 const site=sitesById.get(r.siteId);
 assert(site,'④ site not in previously approved publication or this batch '+r.siteId);
 // Existing shared sites retain their original approved text owners, pin owners,
 // GPS, pin review and original ⑥ versions. New people join only B-qualified ④.
 if(oldSites.has(site.siteId)){
  if(!site.approvedPersonIds)site.approvedPersonIds=[...site.personIds];
  site.personIds=unique([...site.personIds,r.personId]);
 }
 p.relations.push({personId:r.personId,historyId:r.historyId,siteId:r.siteId,
  classification:r.classification,bStatus:r.bStatus,linkDecision:r.linkDecision,
  sourceIds:unique(r.sourceIds),sourceUrls:urls(r.sourceIds)});
}
for(const row of m.people){
 const person=p.people.find(p=>p.personId===row.personId);
 const hs=p.histories.filter(h=>h.personId===row.personId);
 assert(hs.length>0,'person missing published history '+row.name);
 person.story.unlock={requiredHistoryCount:hs.length,
  requiredPlaceHistoryCount:hs.filter(h=>h.kind==='place').length,
  historyIdsSHA256:sha(hs.map(h=>h.historyId).sort().join('\n'))};
}
p.notes={...p.notes,cRelease:{...p.notes.cRelease,new9:{
 batchId:m.batchId,baseCommit:m.baselineCommit,baseBlobSha:m.baselineBlobSha,
 approvedRows:m.approved.map(a=>a.row),approvedKinds:types,publishedSiteIds:m.sites.map(s=>s.id),
 qualifiedRelationRows:m.relations.map(r=>r.sheetRow),
 excludedUnapprovedLinks:12,excludedDuplicateSite:m.excludedIds[0],
 redInformationalPins:m.sites.filter(s=>s.accessStatus==='red').map(s=>s.id),
 safeAcquisition:'municipality-only; no 100m or prohibited-property entry'}}};
assert(p.people.length===74&&p.histories.length===1251&&p.sites.length===436&&
 p.sites.filter(s=>s.publicPin).length===419&&p.relations.length===base.relations.length+28,
 'output totals inconsistent with 80 approved rows');
assert(JSON.stringify(p.retiredHistories)===JSON.stringify(base.retiredHistories),'retired cards lost');
assert(JSON.stringify(p.municipalityAwards)===JSON.stringify(base.municipalityAwards),'previous municipality awards lost');
assert(base.people.every((x,i)=>JSON.stringify(x)===JSON.stringify(p.people[i])),'existing biography/card changed');
assert(base.histories.every((x,i)=>JSON.stringify(x)===JSON.stringify(p.histories[i])),'existing history changed');
for(let i=0;i<base.sites.length;i++){
 const old=base.sites[i],now=p.sites[i];assert(old.siteId===now.siteId,'old site ID changed');
 if(old.publicPin)assert(JSON.stringify(old.point)===JSON.stringify(now.point)&&
  JSON.stringify(old.pinApproval)===JSON.stringify(now.pinApproval)&&
  JSON.stringify(old.pinReview)===JSON.stringify(now.pinReview),'existing public pin changed '+old.siteId);
 if(JSON.stringify(old.personIds)===JSON.stringify(now.personIds))
  assert(JSON.stringify(old)===JSON.stringify(now),'unrelated site changed '+old.siteId);
}
assert(base.relations.every((x,i)=>JSON.stringify(x)===JSON.stringify(p.relations[i])),'prior ④ relations changed');
const codeRegistry=load('data/title-registry.json');
const knownCodes=new Set(codeRegistry.areas.map(x=>x.code));
const core=require(path.join(root,'sengoku-v2-core.js'));
const catalog=core.validate(p,knownCodes,sha);
assert(catalog.people.size===74&&catalog.sites.size===436,'core validation unexpected entity totals');
for(const r of m.relations){
 const site=sitesById.get(r.siteId);
 assert(catalog.codes.get(r.historyId).has(site.municipalityCode),'municipal award missing '+r.historyId);
 const prior={'legacy-retired-id':{at:'2024-01-01'}};
 const visited={[site.municipalityCode]:{first:'2026-11-20'}};
 const award=core.award(catalog,visited,prior,[],'2026-11-20T13:00:00Z');
 assert(award.added.includes(r.historyId),'municipality award not triggered '+r.historyId);
 assert(JSON.stringify(award.records['legacy-retired-id'])===JSON.stringify(prior['legacy-retired-id']),'prior award lost');
 const again=core.award(catalog,visited,award.records,[],'2026-11-20T13:10:00Z');
 assert(!again.added.includes(r.historyId),'double award '+r.historyId);
}
const blocked=m.sites.filter(s=>s.accessStatus==='red');
for(const s of blocked){assert(core.pinDetails(sitesById.get(s.id)).noRouting===true,'red pin accidentally routable '+s.id);}
const oldSiteNames=new Map(base.sites.map(s=>[s.siteId,s.name]));
assert(!p.sites.some(s=>s.siteId==='sg2site-new9-matsunaga-tamon-20261119'),'duplicate 多聞城 returned');
assert(oldSiteNames.get('sg2site-a-junkei-tamon-20261112')===sitesById.get('sg2site-a-junkei-tamon-20261112').name,'existing 多聞城 renamed');
const newSet=new Set(m.sites.map(s=>s.id)),newHist=new Set(m.histories.map(h=>h.id));
assert(p.histories.filter(h=>newHist.has(h.historyId)).length===43&&
 p.sites.filter(s=>newSet.has(s.siteId)).length===19,'out-of-batch release');
const audit={
 batch:m.batchId,release:p.version,baseCommit:m.baselineCommit,baseBlob:m.baselineBlobSha,
 frozenApprovedRows:m.approved.map(a=>({row:a.row,kind:a.kind,id:a.originalId||a.personId,version:a.version,bodySHA256:sha(a.text)})),
 before:{people:base.people.length,histories:base.histories.length,sites:base.sites.length,pins:base.sites.filter(s=>s.publicPin).length,relations:base.relations.length},
 after:{people:p.people.length,histories:p.histories.length,sites:p.sites.length,pins:p.sites.filter(s=>s.publicPin).length,relations:p.relations.length},
 released:{introductions:9,stories:9,histories:43,sites:19,relations:28,redPins:blocked.length,yellowPins:m.sites.filter(s=>s.accessStatus==='yellow').length,greenPins:m.sites.filter(s=>s.accessStatus==='green').length},
 pinPrefectureDelta:m.sites.reduce((acc,s)=>{const pref=s.municipality.replace(/^(東京都|北海道|大阪府|京都府|.{2,3}県).*$/,'$1');acc[pref]=(acc[pref]||0)+1;return acc},{}),
 holds:[],priorPublishedUnchanged:true,priorRetiredCardsPreserved:true,
 approvedBodyExact:true,approvedLocationExact:true,onlyBQualifiedLinks:true,
 excluded12UnapprovedRelations:true,excludedDuplicateTamon:true,
 redPinNoRouting:true,no100mRequirement:true,municipalityAcquisitionTested:true,
 unrelatedManagementWarnings:m.warnings};
save('sengoku/v2/approved-c-20261120-new9-80.json',p);
save('docs/c-release/20261120-new9-qa.json',audit);
const htmlFile=path.join(root,'index.html'),html=fs.readFileSync(htmlFile,'utf8');
const oldRef="fetch('./sengoku/v2/approved-c-20261119-57.json'";
const newRef="fetch('./sengoku/v2/approved-c-20261120-new9-80.json'";
assert(html.includes(oldRef)||html.includes(newRef),'app release pointer altered');
const oldCoreUrl='src="./sengoku-v2-core.js?v=c20261119-fixed57"';
const newCoreUrl='src="./sengoku-v2-core.js?v=c20261120-new9"';
let nextHtml=html.replace(oldRef,newRef).replace(oldCoreUrl,newCoreUrl);
assert(nextHtml.includes(newCoreUrl),'Safari must load updated C core using new cache key');
if(nextHtml!==html)fs.writeFileSync(htmlFile,nextHtml);
console.log('C_NEW9_BUILT',JSON.stringify({version:p.version,after:audit.after,release:audit.released,prefectures:audit.pinPrefectureDelta,relations:m.relations.length}));

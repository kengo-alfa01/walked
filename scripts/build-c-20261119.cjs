#!/usr/bin/env node
'use strict';
// C-20261119: deterministic, approval-scoped build; no research edits and no direct main writes.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.join(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const write=(p,v)=>{fs.mkdirSync(path.dirname(path.join(root,p)),{recursive:true});fs.writeFileSync(path.join(root,p),JSON.stringify(v,null,2)+'\n');};
const hash=s=>crypto.createHash('sha256').update(s,'utf8').digest('hex');
const unique=a=>[...new Set(a)];
const clone=x=>JSON.parse(JSON.stringify(x));
const fields=v=>unique(String(v??'').split(/[\n,]/).map(x=>x.trim()).filter(Boolean));
const base=read('sengoku/v2/approved-up-to-muneshige-pins-100.json');
const snap=read('docs/c-release/20261119-fixed-approved-snapshot.json');
const d=read('docs/c-release/20261119-approved-source-projection.json');
if(snap.id!=='C-20261119-A'||snap.fixed.length!==1230||snap.legacy.length!==31||snap.pinCandidates.length!==77)throw Error('Frozen C batch changed');
const sources=new Map(d.sources.map(x=>[x.sourceId,x]));
const sourceUrls=a=>unique(a.map(id=>sources.get(id)?.url).filter(u=>typeof u==='string'&&u.startsWith('https://')));
const rawPeople=new Map(d.people.map(x=>[x.personId,x])),rawHist=new Map(d.histories.map(x=>[x.id,x])),rawSites=new Map(d.sites.map(x=>[x.siteId,x]));
const knownPeople=new Set([...base.people.map(x=>x.personId),...d.people.map(x=>x.personId)]);
const approved=x=>({sheetRow:x.sheetRow,version:x.version,user:x.user,quality:x.quality,rights:x.rights,handoff:x.handoff,sourceMatch:x.sourceMatch,sha256:x.sha256,kind:x.type,personId:x.personIds.join('\n'),sourceId:['人物紹介','完成版ストーリー'].includes(x.type)?null:x.id});
function gate(x){if(x.user!=='公開OK'||x.quality!=='品質合格'||x.sourceMatch!=='一致'||x.handoff!=='C候補（別途公開承認）'||!x.sheetRow||!/^v[1-9]\d*$/.test(x.version)||x.sha256!==hash(x.text))throw Error('Unapproved or mismatched '+x.type+'|'+x.id);}
for(const x of snap.fixed)gate(x.approval);
const retiredIds=new Set(snap.legacy.map(x=>x.key.split('|')[1]));
const oldHist=new Map(base.histories.map(x=>[x.historyId,x])),oldSites=new Map(base.sites.map(x=>[x.siteId,x]));
if(retiredIds.size!==31||[...retiredIds].some(id=>!oldHist.has(id)))throw Error('Legacy retirement not based on published IDs');
const holdSiteIds=new Set(['sg2site-motonari-niitakayama']); // ⑥ title != ③ title; retain current release.
const futureSites=new Set([...oldSites.keys(),...snap.fixed.filter(x=>x.approval.type==='史跡'&&!holdSiteIds.has(x.approval.id)).map(x=>x.approval.id)]);
const qualified=d.relations.filter(x=>x.bStatus==='合格'&&x.linkDecision==='関係上対象'&&['本人直接','出来事直接（史料）','出来事直接（公的伝承）'].includes(x.classification)&&futureSites.has(x.siteId)&&!retiredIds.has(x.histId));
const linksByHistory=new Map(),usersBySite=new Map();
for(const r of qualified){if(!linksByHistory.has(r.histId))linksByHistory.set(r.histId,[]);linksByHistory.get(r.histId).push(r);
if(!usersBySite.has(r.siteId))usersBySite.set(r.siteId,new Set());usersBySite.get(r.siteId).add(r.personId)}
const people=new Map(base.people.map(x=>[x.personId,clone(x)]));
const histories=new Map(base.histories.filter(h=>!retiredIds.has(h.historyId)).map(x=>[x.historyId,clone(x)]));
const sites=new Map(base.sites.map(x=>[x.siteId,clone(x)]));
const holds={history:[],site:[],pin:[]},done={profile:[],history:[],site:[],legacy:snap.legacy.map(x=>x.key),pin:[]};
for(const {key,approval:a} of snap.fixed){if(!['人物紹介','完成版ストーリー'].includes(a.type))continue;
let src=rawPeople.get(a.id),p=people.get(a.id)||{personId:a.id,name:src?.name};if(!src||!knownPeople.has(a.id))throw Error('Missing person '+key);
const field=a.type==='人物紹介'?'introduction':'story';p.name=src.name;p[field]={...(p[field]||{}),text:a.text,yearText:a.yearText,approval:approved(a)};people.set(a.id,p);done.profile.push(key)}
const year=v=>/^\d{3,4}$/.test(String(v??''))?Number(v):null;
for(const {key,approval:a} of snap.fixed){if(a.type!=='経歴')continue;const src=rawHist.get(a.id),prev=histories.get(a.id);
if(!src||src.text!==a.text||src.title!==a.title||src.yearText!==a.yearText||src.personId!==a.personIds[0])throw Error('History source mismatch '+key);
const kind=a.rights==='位置不要・権利OK'?'nonplace':'place';
if(kind==='place'&&!linksByHistory.has(a.id)){holds.history.push({key,reason:'承認済み④の公開可能な取得先史跡が存在しない',oldPreserved:!!prev,missingSiteIds:d.relations.filter(x=>x.histId===a.id&&!futureSites.has(x.siteId)).map(x=>x.siteId)});continue;}
const ids=fields(src.sourceIds),h={historyId:a.id,personId:src.personId,kind,title:a.title,yearText:a.yearText,eventYear:year(src.startYear),eventYearEnd:year(src.endYear),text:a.text,sourceIds:ids,sourceUrls:sourceUrls(ids),approval:approved(a)};
if(String(src.displayOrder??'').trim()&&Number.isFinite(Number(src.displayOrder)))h.displayOrder=Number(src.displayOrder);
else if(prev?.displayOrder!==undefined)h.displayOrder=prev.displayOrder;
if(prev?.sourceOrder!==undefined)h.sourceOrder=prev.sourceOrder;
histories.set(a.id,h);done.history.push(key)}
for(const {key,approval:a} of snap.fixed){if(a.type!=='史跡')continue;const src=rawSites.get(a.id),prev=sites.get(a.id);
if(!src||src.text!==a.text)throw Error('Site source mismatch '+key);
if(src.name!==a.title){holds.site.push({key,reason:'⑥承認タイトルと③史跡名が異なる',approvedTitle:a.title,sourceTitle:src.name});continue;}
const codes=fields(src.multiMunicipality||src.municipalityCode);
if(!codes.length||codes.some(c=>!(/^\d{5}$/.test(c)))){holds.site.push({key,reason:'取得自治体コードの確定が必要',codes});continue;}
const ids=fields(src.sourceIds),site={siteId:a.id,name:a.title,description:a.text,personIds:[...a.personIds],municipalityCodes:codes,municipalityCode:src.municipalityCode,locationReviewed:true,rightsReviewed:true,bStatus:'合格',publicPin:false,point:null,locationAccuracy:src.accuracy,sourceIds:ids,sourceUrls:sourceUrls(ids),approval:approved(a)};
if(prev?.publicPin){site.publicPin=true;site.point=prev.point;site.pinApproval=prev.pinApproval;site.pinReview=prev.pinReview;if(prev.pinPersonIds)site.pinPersonIds=prev.pinPersonIds;
if(prev.description!==site.description)site.pinApprovalText=prev.description;}
sites.set(a.id,site);done.site.push(key)}
let sharedSites=0;
for(const [id,additional] of usersBySite){const site=sites.get(id);if(!site)continue;
const all=unique([...site.personIds,...additional]);if(all.length===site.personIds.length)continue;
site.approvedPersonIds=site.approvedPersonIds||[...site.personIds];site.personIds=all;sharedSites++;}
const doneHistIDs=new Set(done.history.map(x=>x.split('|')[1]));
const relations=new Map();
for(const r of base.relations){if(!histories.has(r.historyId)||!sites.has(r.siteId))continue;
if(doneHistIDs.has(r.historyId)&&linksByHistory.has(r.historyId))continue;
relations.set(r.historyId+'|'+r.siteId,r)}
for(const [id,links] of linksByHistory){if(!doneHistIDs.has(id)||histories.get(id)?.kind!=='place')continue;
for(const r of links){if(!histories.has(r.histId)||!sites.has(r.siteId)||!sites.get(r.siteId).personIds.includes(r.personId))throw Error('Unpublished or unapproved ④ reference '+r.histId+'|'+r.siteId);
const ids=fields(r.sourceIds);relations.set(r.histId+'|'+r.siteId,{personId:r.personId,historyId:r.histId,siteId:r.siteId,classification:r.classification,bStatus:'合格',linkDecision:'関係上対象',sourceIds:ids,sourceUrls:sourceUrls(ids)})}}
const linkHist=new Set([...relations.values()].map(x=>x.historyId));
for(const h of histories.values())if(h.kind==='place'&&!linkHist.has(h.historyId))throw Error('Unlinked place history '+h.historyId);
for(const p of people.values()){if(!p.story||!p.introduction)throw Error('Missing approved profile '+p.personId);
const hh=[...histories.values()].filter(h=>h.personId===p.personId);
if(!hh.length)throw Error('No published history for '+p.personId);
p.story.unlock={requiredHistoryCount:hh.length,requiredPlaceHistoryCount:hh.filter(h=>h.kind==='place').length,historyIdsSHA256:hash(hh.map(h=>h.historyId).sort().join('\n'))};}
const retiredHistories=snap.legacy.map(r=>({history:oldHist.get(r.key.split('|')[1]),type:r.category,successors:fields(r.targetIds),formerSiteIds:base.relations.filter(x=>x.historyId===r.key.split('|')[1]).map(x=>x.siteId)}));
for(const x of snap.pinCandidates)holds.pin.push({siteId:x.siteId,reason:/^\s*\d+(?:\.\d+)?,\s*\d+(?:\.\d+)?\s*$/.test(x.coordinateRaw||'')?'最新版の⑥位置承認とB見学色の一対一照合待ち':'公開する数値座標が③に未登録'});
const pkg={schemaVersion:base.schemaVersion,sourceSpreadsheetId:base.sourceSpreadsheetId,version:'v2-approved-c-20261119',people:[...people.values()],histories:[...histories.values()],sites:[...sites.values()],relations:[...relations.values()],retiredHistories,notes:{...base.notes,cRelease:{snapshotId:snap.id,baseBlob:'0b137f46487e5ff5bf85444d060e22a080867211',preserveHistoricalPinApproval:true,addedPinCount:0}}};
const counts={people:pkg.people.length,histories:pkg.histories.length,sites:pkg.sites.length,publicPins:pkg.sites.filter(x=>x.publicPin).length,relations:pkg.relations.length,legacy:retiredHistories.length,records:pkg.people.length*2+pkg.histories.length+pkg.sites.length};
const audit={releaseVersion:pkg.version,snapshotId:snap.id,baseVersion:base.version,counts,processed:done,holds,checks:{sharedSites,unexpectedHistoricLoss:base.histories.filter(x=>!histories.has(x.historyId)&&!retiredIds.has(x.historyId)).length,unexpectedSiteLoss:base.sites.filter(x=>!sites.has(x.siteId)).length,unapprovedNewPins:pkg.sites.filter(x=>x.publicPin&&!oldSites.get(x.siteId)?.publicPin).length,duplicates:{people:pkg.people.length-new Set(pkg.people.map(x=>x.personId)).size,histories:pkg.histories.length-new Set(pkg.histories.map(x=>x.historyId)).size,sites:pkg.sites.length-new Set(pkg.sites.map(x=>x.siteId)).size,relations:pkg.relations.length-new Set(pkg.relations.map(x=>x.historyId+'|'+x.siteId)).size}}};
if(audit.checks.unexpectedHistoricLoss||audit.checks.unexpectedSiteLoss||audit.checks.unapprovedNewPins||Object.values(audit.checks.duplicates).some(Boolean))throw Error('C release QA failed');
if(pkg.people.length!==65||retiredHistories.length!==31)throw Error('Unexpected frozen C scope output');
const release='sengoku/v2/approved-c-20261119.json';
write(release,pkg);write('docs/c-release/20261119-delta-qa.json',audit);
console.log('C staged package '+pkg.version,counts,'holds',Object.fromEntries(Object.entries(holds).map(([k,v])=>[k,v.length])));
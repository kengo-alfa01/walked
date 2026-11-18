#!/usr/bin/env node
"use strict";
/* Immutable 2026-11-19 C publication snapshot: approved delta only. */
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const root=path.join(__dirname,"..");
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),"utf8"));
const write=(p,data)=>{const file=path.join(root,p);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(data,null,2)+"\n","utf8");};
const sha=s=>crypto.createHash("sha256").update(s,"utf8").digest("hex");
const snapshot=read("docs/c-release/20261119-fixed-approved-snapshot.json");
const source=read("docs/c-release/20261119-approved-source-projection.json");
const baseline=read("sengoku/v2/approved-up-to-muneshige-pins-100.json");
if(snapshot.id!=="C-20261119-A"||snapshot.fixed.length!==1230||snapshot.legacy.length!==31||snapshot.pinCandidates.length!==77)throw Error("Frozen scope changed");
if(source.snapshotId!==snapshot.id)throw Error("Wrong source snapshot");
const copy=v=>JSON.parse(JSON.stringify(v)),pkg=copy(baseline);
const approved=new Map(snapshot.fixed.map(x=>[x.key,x.approval]));
const persons=new Map(source.people.map(x=>[x.personId,x]));
const histories=new Map(source.histories.map(x=>[x.id,x]));
const sites=new Map(source.sites.map(x=>[x.siteId,x]));
const sources=new Map(source.sources.filter(x=>/^https:\/\//.test(x.url??"")).map(x=>[x.sourceId,x.url]));
const uniq=a=>[...new Set(a)], split=x=>(Array.isArray(x)?x:String(x??"").split("\n")).filter(Boolean);
const urls=(ids,existing=[])=>uniq([...split(ids).map(id=>sources.get(id)).filter(Boolean),...existing]).filter(u=>/^https:\/\//.test(u));
const num=x=>x===null||x===undefined||x===""?null:Number.isFinite(Number(x))?Number(x):null;
const pmap=new Map(pkg.people.map(p=>[p.personId,p]));
const hmap=new Map(pkg.histories.map(h=>[h.historyId,h]));
const smap=new Map(pkg.sites.map(s=>[s.siteId,s]));
const baselineIds={people:new Set(pmap.keys()),histories:new Set(hmap.keys()),sites:new Set(smap.keys())};
const retiredIds=new Set(snapshot.legacy.filter(x=>x.key.startsWith("経歴|")).map(x=>x.key.slice(3)));
const retirement=new Map(snapshot.legacy.map(x=>[x.key,x]));
const held=new Map();
const stats={add:{people:0,histories:0,sites:0},updated:{introductions:0,stories:0,histories:0,sites:0},pinPublished:0,relationsSkippedForNonplace:0};
const wrap=a=>({sheetRow:a.sheetRow,version:a.version,user:a.user,quality:a.quality,rights:a.rights,handoff:a.handoff,sourceMatch:a.sourceMatch,sha256:a.sha256,kind:a.type,personId:a.personIds.join("\n"),sourceId:a.type==="人物紹介"||a.type==="完成版ストーリー"?null:a.id});
for(const item of snapshot.fixed){
 const a=item.approval;
 if(a.user!=="公開OK"||a.handoff!=="C候補（別途公開承認）"||a.sourceMatch!=="一致"||sha(a.text)!==a.sha256)throw Error("Unverified approval "+item.key);
 if(a.type==="人物紹介"||a.type==="完成版ストーリー"){
  const raw=persons.get(a.id);if(!raw){held.set(item.key,"①人物IDなし");continue}
  const had=pmap.has(a.id);const p=pmap.get(a.id)||{personId:a.id,name:raw.name,introduction:null,story:null};
  if(!had)stats.add.people++;
  else if(a.type==="人物紹介")stats.updated.introductions++;
  else stats.updated.stories++;
  p.name=raw.name;
  const article={text:a.text,yearText:a.yearText,approval:{...wrap(a),personId:a.id}};
  if(a.type==="人物紹介")p.introduction=article;
  else p.story={...article,unlock:p.story?.unlock??null};
  pmap.set(a.id,p);
  continue;
 }
 if(a.type!=="史跡")continue;
 const raw=sites.get(a.id);
 if(!raw){held.set(item.key,"③史跡IDなし");continue}
 if(raw.name!==a.title){held.set(item.key,"③現行名称と⑥承認名称が不一致: ③="+raw.name+" ／⑥="+a.title);continue}
 const codes=uniq(String(raw.multiMunicipality||raw.municipalityCode||"").split(",").map(x=>x.trim()).filter(x=>/^\d{5}$/.test(x)));
 if(!codes.length){held.set(item.key,"③自治体コード未設定");continue}
 const prev=smap.get(a.id),publicPin=prev?.publicPin===true;
 const next={siteId:a.id,name:a.title,description:a.text,personIds:a.personIds,
  municipalityCodes:codes,municipalityCode:String(raw.municipalityCode||""),
  locationReviewed:true,rightsReviewed:true,bStatus:"合格",
  publicPin,point:publicPin?prev.point:null,locationAccuracy:publicPin?prev.locationAccuracy:raw.accuracy,
  sourceIds:uniq(split(raw.sourceIds)),sourceUrls:urls(raw.sourceIds,prev?.sourceUrls||[]),
  approval:wrap(a)};
 if(publicPin){next.pinApproval=prev.pinApproval;next.pinReview=prev.pinReview;if(prev.pinPersonIds)next.pinPersonIds=prev.pinPersonIds;}
 smap.set(a.id,next);
 if(baselineIds.sites.has(a.id))stats.updated.sites++;else stats.add.sites++;
}
const byHistory=new Map();
for(const r of source.relations){const arr=byHistory.get(r.histId)||[];arr.push(r);byHistory.set(r.histId,arr);}
const fixedHistoryIds=new Set();
for(const item of snapshot.fixed){
 const a=item.approval;if(a.type!=="経歴")continue;
 fixedHistoryIds.add(a.id);
 const raw=histories.get(a.id);
 if(!raw){held.set(item.key,"②経歴IDなし");continue}
 const kind=a.rights==="位置不要・権利OK"?"nonplace":"place";
 const eligible=(byHistory.get(a.id)||[]).filter(r=>smap.has(r.siteId));
 if(kind==="place"&&!eligible.length){held.set(item.key,"④直接リンク先の承認史跡が未公開／未承認");continue}
 const prev=hmap.get(a.id);
 const next={historyId:a.id,personId:a.personIds[0],kind,title:a.title,
 yearText:a.yearText,eventYear:num(raw.startYear),eventYearEnd:num(raw.endYear),
 text:a.text,sourceIds:uniq(split(raw.sourceIds)),sourceUrls:urls(raw.sourceIds,prev?.sourceUrls||[]),
 approval:{...wrap(a),personId:a.personIds[0]}};
 if(raw.displayOrder!==""&&raw.displayOrder!==null&&raw.displayOrder!==undefined&&Number.isFinite(Number(raw.displayOrder)))next.displayOrder=Number(raw.displayOrder);
 else if(prev?.displayOrder!==undefined)next.displayOrder=prev.displayOrder;
 if(prev?.sourceOrder!==undefined)next.sourceOrder=prev.sourceOrder;
 hmap.set(a.id,next);
 if(baselineIds.histories.has(a.id))stats.updated.histories++;else stats.add.histories++;
}
const archived=[];
for(const [id,h] of [...hmap])if(retiredIds.has(id)){
 const m=retirement.get("経歴|"+id);
 archived.push({...h,retirement:{category:m.category,managementKey:m.key,mergeTargets:split(m.targetIds),oldApprovalGate:m.approvalGate,retainExistingAcquisition:true,awardable:false}});
 hmap.delete(id);
}
const links=new Map();
const addLink=r=>links.set(r.historyId+"|"+r.siteId,r);
for(const r of baseline.relations){
 if(!hmap.has(r.historyId)||!smap.has(r.siteId)||fixedHistoryIds.has(r.historyId))continue;
 addLink(r);
}
for(const r of source.relations){
 const h=hmap.get(r.histId);
 if(!h||!smap.has(r.siteId))continue;
 if(h.kind==="nonplace"){stats.relationsSkippedForNonplace++;continue}
 if(r.personId!==h.personId)throw Error("Relation person mismatch "+r.histId);
 addLink({personId:r.personId,historyId:r.histId,siteId:r.siteId,classification:r.classification,bStatus:r.bStatus,linkDecision:r.linkDecision,sourceIds:uniq(split(r.sourceIds)),sourceUrls:urls(r.sourceIds)});
}
const linkSet=new Set([...links.values()].map(x=>x.historyId));
for(const [id,h] of hmap)if(h.kind==="place"&&!linkSet.has(id))throw Error("Active place history missing approved B link "+id);
for(const [pid,p] of pmap){
 if(!p.introduction||!p.story)throw Error("Incomplete person "+pid);
 const hs=[...hmap.values()].filter(h=>h.personId===pid);
 if(!hs.length)throw Error("Person missing histories "+pid);
 p.story.unlock={requiredHistoryCount:hs.length,requiredPlaceHistoryCount:hs.filter(h=>h.kind==="place").length,historyIdsSHA256:sha(hs.map(h=>h.historyId).sort().join("\n"))};
}
for(const site of smap.values())for(const pid of site.personIds)if(!pmap.has(pid))throw Error("Unknown site person "+site.siteId+" "+pid);
pkg.people=[...pmap.values()];pkg.histories=[...hmap.values()];pkg.sites=[...smap.values()];pkg.relations=[...links.values()];
pkg.retiredHistories=archived;
pkg.version="v2-approved-c-20261119-a";
pkg.notes={...baseline.notes,mainPublication:false,sourceSheet:"⑥公開最終承認",releaseSnapshotId:snapshot.id,scope:"2026-11-19 C固定対象1230・旧公開処置31・ピン判定別",pinPolicy:"承認済みの既公開334ピンを維持。未公開77ピン候補は構造化された位置版・見学色の独立照合待ちで新規公開せず。",retiredHistoryCount:archived.length};
stats.pinPublished=pkg.sites.filter(x=>x.publicPin).length;
if(pkg.people.length!==65||pkg.sites.length!==417||stats.pinPublished!==334||archived.length!==31)throw Error("Unexpected staging population");
const ids=a=>new Set(a).size===a.length;
if(!ids(pkg.people.map(x=>x.personId))||!ids(pkg.histories.map(x=>x.historyId))||!ids(pkg.sites.map(x=>x.siteId)))throw Error("Duplicate IDs");
for(const r of pkg.relations)if(!hmap.has(r.historyId)||!smap.has(r.siteId)||r.personId!==hmap.get(r.historyId)?.personId)throw Error("Dangling relation");
const prior={people:baseline.people.length,histories:baseline.histories.length,sites:baseline.sites.length,relations:baseline.relations.length,pins:baseline.sites.filter(x=>x.publicPin).length};
const after={people:pkg.people.length,histories:pkg.histories.length,sites:pkg.sites.length,relations:pkg.relations.length,pins:stats.pinPublished};
const holdRows=[...held].map(([key,reason])=>({key,reason,next:"A/Bまたは管理：当該IDのみ確認。Cは既公開版を保持"}));
const report={snapshot:snapshot.id,baseCommit:snapshot.mainBaseSha,prior,after,stats,holdCount:holdRows.length,holds:holdRows,retired:archived.map(x=>x.historyId),pinHolds:snapshot.pinCandidates.map(p=>({id:p.siteId,reason:/^\d+(\.\d+)?,\s*\d+(\.\d+)?$/.test(p.coordinateRaw)?"位置版・見学信号色の独立公開承認情報が構造化されていない":"③数値座標なし。⑥本文公開とピン公開は別判定",next:"A/B/管理：ピン位置版の承認済み構造化証跡を整理"})),retention:{retiredAcquiredRecords:"read-only; no forced migration",unchangedLivePins:334,unapprovedNewPins:0}};
write("sengoku/v2/approved-c-20261119-a.json",pkg);
write("docs/c-release/20261119-stage-result.json",report);
console.log("STAGED "+JSON.stringify({prior,after,stats,holdCount:holdRows.length,pinHolds:report.pinHolds.length}));

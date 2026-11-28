/* C candidate verification; node tests/sengoku-candidate-20261128.test.cjs */
'use strict';
function run({base,delta,core,pub,builder,registry,manifest,audit,html}){
 const issues=[],check=(v,m)=>{checks++;if(!v)issues.push(m)},eq=(a,b,m)=>check(JSON.stringify(a)===JSON.stringify(b),m);let checks=0;
 const known=new Set(registry.areas.map(a=>a.code)),old=core.validate(base,known,pub.sha256),doc=builder.apply(base,delta,pub.sha256),raw=core.validate(doc,known,pub.sha256),idx=core.withRelatedSitePresentation(raw,builder.presentation(manifest));
 check(idx.people.size===94&&idx.histories.size===1682&&idx.sites.size===594&&[...idx.sites.values()].filter(s=>s.publicPin).length===556,'release counts');
 const ar=new Map(audit.records.map(x=>[x.row,x]));
 for(const x of audit.records){const q=x.kind==='史跡'?idx.sites.get(x.recordId):x.kind==='経歴'?idx.histories.get(x.recordId):idx.people.get(x.personId)?.[x.kind==='人物紹介'?'introduction':'story'];check(q?.approval?.sheetRow===x.row&&q.approval.version===x.approval.version&&(q.description||q.text)===x.body,'⑥ '+x.row);}
 for(const [id,s] of old.sites){const n=idx.sites.get(id);check(!!n,'old site '+id);eq(n.codes,s.codes,'old codes '+id);eq(n.point,s.point,'old point '+id);eq(n.pinApproval,s.pinApproval,'old pin approval '+id);eq(n.pinReview,s.pinReview,'old raw B pin '+id);}
 for(const [id,h] of old.histories)check(idx.histories.has(id),'old history '+id);
 const codes=[...new Set([...idx.sites.values()].flatMap(s=>s.codes).concat([...idx.codes.values()].flatMap(s=>[...s])))].sort();
 const visit=code=>({[code]:{first:'2026-11-28T00:00:00Z',last:'2026-11-28T00:00:00Z',source:'QA'}}),at='2026-11-28T00:00:00Z';
 for(const code of codes){const seen=core.acquiredSiteIds(idx,visit(code),{}),pins=core.acquiredPinSiteIds(idx,visit(code),{});for(const [id,s] of idx.sites){check(seen.has(id)===s.codes.includes(code),'site '+code+' '+id);check(pins.has(id)===(s.publicPin&&s.codes.includes(code)),'pin '+code+' '+id)}
  const result=core.award(idx,visit(code),{},[],at);for(const [id,h] of idx.histories){if(h.kind==='place')check(!!result.records[id]===idx.codes.get(id).has(code),'award '+code+' '+id)}
  eq(core.award(idx,visit(code),result.records,[],at).added,[],'idempotence '+code);
 }
 const all=Object.assign({},...codes.map(visit)),prior=core.award(old,all,{},[],at),next=core.award(idx,all,prior.records,[],at);
 check(Object.keys(next.records).length===1682,'all acquired');check(next.added.length===44,'new card count');
 for(const [id,v] of Object.entries(prior.records))eq(next.records[id],v,'legacy record '+id);
 for(const [id] of idx.people)check(core.canUnlockStory(idx,id,next.records,pub.sha256),'story '+id);
 const expectations={'sg2hist-nobu-1582-koshu':['22207'],'sg2hist-yoshitaka-1533-feud':['12226','12234'],'sg2hist-a-hideyoshi-yamazaki-castle1582-20261128':['26303'],'sg2hist-a-yoshihiro-mifune1567-20261125':['12225'],'sg2hist-a-yoshihiro-death1578-20261125':['12234']};
 for(const [id,cc] of Object.entries(expectations))eq([...idx.codes.get(id)].sort(),cc.sort(),'explicit new award '+id);
 const death='sg2hist-a-yoshihiro-death1578-20261125',grave='sg2site-satomi-enmeiji',dead=core.award(idx,visit('12234'),{},[],at).records;
 check(dead[death]?.siteId===grave&&core.acquiredSiteIds(idx,{}, {[death]:dead[death]}).has(grave),'grave old record restore');
 check(!idx.linkSites.has(death)&&idx.municipalityAwards.get(death).graveReviewSheetRow===103,'grave special not direct ④');
 for(const row of audit.relations.filter(x=>x.linkDecision!=='関係上対象'||x.bStatus!=='合格'))check(!idx.linkSites.get(row.historyId)?.has(row.siteId),'excluded ④ '+row.row);
 for(const x of audit.records.filter(x=>x.row>=4648&&x.row<=4653)){const s=idx.sites.get(x.recordId);check(s.relatedOnly===true&&core.relatedSites(idx,{},x.personId,{}).some(y=>y.siteId===s.siteId&&!y.acquired),'approved related '+x.row);}
 for(const s of idx.sites.values())if(s.publicPin===false)check(s.point===null&&!s.pinReview,'no pin '+s.siteId);
 for(const entry of manifest.excluded)check(idx.sites.get(entry.siteId).relatedOnly!==true,'excluded related '+entry.siteId);
 const start=html.indexOf('function refreshSengokuPins(){'),end=html.indexOf('// Only B-approved acquisition relationships',start);
 check(start>=0&&end>start,'person filter source');
 function pinRows(pid,visited){
  const rows=[],env={sengokuPinHalos:{clearLayers(){}},sengokuPins:{clearLayers(){}},sengokuV2Catalog:idx,activeCollectionMode:'sengoku',sitePinSheet:{close(){},isOpen(){return false}},selectedSengokuPersonId:pid,SengokuV2:core,state:{visited},sengokuFound:{},L:{circleMarker(point,opts){return {addTo(){if(opts.radius===7)rows.push(point);return this},bindPopup(){return this},off(){return this},on(){return this}}}},sengokuPinRenderer:{},sengokuPinPopup(){},SengokuPinDisplay:{statusFor:s=>s.pinReview.accessStatus},SengokuPinApprovedV2:{}};
  Function(...Object.keys(env),html.slice(start,end)+'\\nrefreshSengokuPins();'.replace('\\n','\n'))(...Object.values(env));
  return rows;
 }
 for(const ref of audit.references.filter(r=>r.kind==='史跡')){
  const s=idx.sites.get(ref.recordId);check(s.approval.sheetRow===ref.referenceApprovalRow,'shared approved '+ref.gateRow);
  const links=[...idx.linkSites].filter(([hid,ids])=>ids.has(s.siteId)&&idx.histories.get(hid)?.personId===ref.personId);
  const special=[...idx.municipalityAwards.values()].filter(a=>a.classification==='墓所特例'&&a.relatedSiteId===s.siteId&&a.personId===ref.personId);
  check(links.length+special.length>0,'shared relationship '+ref.gateRow);
  if(s.publicPin)check(pinRows(ref.personId,{}).some(([lat,lng])=>lat===s.point[1]&&lng===s.point[0]),'shared person pin '+ref.gateRow);
 }
 const frameStart=html.indexOf('function hasPublishedSengokuPin(history){'),frameEnd=html.indexOf('// Popup contents',frameStart);
 check(Function('sengokuV2Catalog','history',html.slice(frameStart,frameEnd)+'\nreturn hasPublishedSengokuPin(history);')(idx,idx.histories.get(death))===true,'grave card published pin frame');
 let tampered=JSON.parse(JSON.stringify(delta));tampered.histories[0].text+='改変';try{builder.apply(base,tampered,pub.sha256);check(false,'tamper rejected')}catch{check(true,'tamper rejected')}
 for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g))if(!/\bsrc=/.test(m[1])&&(!/\btype=/.test(m[1])||/javascript/.test(m[1])))Function(m[2]);
 check(html.includes('SengokuCandidateDelta.apply(base,delta,PublicationRuntime.sha256)')&&html.includes('c-20261128-approved-delta.json'),'candidate wired');
 return {checks,issues,people:idx.people.size,histories:idx.histories.size,sites:idx.sites.size,pins:[...idx.sites.values()].filter(s=>s.publicPin).length,related:[...idx.sites.values()].filter(s=>s.relatedOnly).length,municipalities:codes.length,approvedRows:ar.size,oldCardsPreserved:Object.keys(prior.records).length,newCards:next.added.length};
}
if(require.main===module){const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8'),result=run({base:JSON.parse(read('sengoku/v2/approved-c-20261126-new4.json')),delta:JSON.parse(read('sengoku/v2/c-20261128-approved-delta.json')),core:require('../sengoku-v2-core.js'),pub:require('../publication-runtime.js'),builder:require('../sengoku/v2/candidate-delta-20261128.js'),registry:JSON.parse(read('data/title-registry.json')),manifest:require('../sengoku/v2/related-site-presentation-cv3.js'),audit:JSON.parse(read('sengoku/v2/c-20261128-approved-input-audit.json')),html:read('index.html')});console.log(JSON.stringify(result,null,2));if(result.issues.length)process.exitCode=1;}
module.exports=run;

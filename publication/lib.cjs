'use strict';
const crypto=require('node:crypto');
const FILES=['sengoku/people.json','sengoku/sites.json','sengoku/links.json','sengoku/cards.json','history.json'];
const GATES=['adoptedPerson','historicalEvidence','siteIdentity','currentLocation','discovery','sourceLocator','rights','idIntegrity','uncertainty'];
const stable=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const hash=v=>crypto.createHash('sha256').update(typeof v==='string'?v:stable(v)).digest('hex');
const id=(type,parts)=>'pub-'+type+'-'+hash(parts).slice(0,24);
function fingerprint(c){return hash({personId:c.personId,historyRecordId:c.historyRecordId,relationId:c.relationId,site:c.site,claimKey:c.claimKey,publicText:c.publicText,eventYear:c.eventYear,sources:c.sources,rights:c.rights});}
function areaFromVisit(key,registry){
 const codes=new Set(registry.areas.map(x=>x.code));let code='';
 if(/^\d{5}$/.test(key))code=key;
 else if(/^m:13209\d+$/.test(key)||/^s:1415[123]\d+$/.test(key))code=key.slice(2,7);
 else {const m=key.match(/^n:(\d{5}):(\d+)$/);if(m&&m[2].startsWith(m[1]))code=m[1];}
 return codes.has(code)?code:null; // No designated-city parent, prefecture or unknown-code fallback.
}
function index(rows,label){const m=new Map();for(const r of rows){if(!r.id||m.has(r.id))throw Error('Duplicate/missing '+label+' ID');m.set(r.id,r);}return m;}
function applyDelta(base,delta){
 const out=structuredClone(base);
 for(const file of FILES){const current=file==='history.json'?out[file].entries:out[file],incoming=file==='history.json'?delta[file].entries:delta[file],map=index(current,file);
  if(file==='history.json'&&base[file].version!==delta[file].version)throw Error('Regional history schema mismatch');
  for(const row of incoming){if(map.has(row.id)){if(stable(map.get(row.id))!==stable(row))throw Error('Existing ID overwrite forbidden: '+row.id);}else{current.push(structuredClone(row));map.set(row.id,row);}}
 }
 return out;
}
function build(input,base,registry){
 if(input.schemaVersion!=='walked-publication-v1')throw Error('Unknown schema');
 const adopted=new Set(input.adoptedPersonIds);if(adopted.size!==624||input.adoptedPersonIds.length!==624)throw Error('Adopted set must be exactly 624 unique IDs');
 const rows=f=>f==='history.json'?base[f].entries:base[f];
 const by={};for(const file of FILES){if(!Array.isArray(rows(file)))throw Error('Missing baseline '+file);by[file]=index(rows(file),file);if(hash(base[file])!==input.baseline.contentHashes[file])throw Error('Baseline changed: '+file);}
 const delta=Object.fromEntries(FILES.map(f=>[f,[]])),catalog=structuredClone(base),records=[],rejected=[];const seen=new Set();
 function add(file,row){const existing=by[file].get(row.id);if(existing){if(stable(existing)!==stable(row))throw Error('Existing ID overwrite forbidden: '+row.id);return;}by[file].set(row.id,row);delta[file].push(row);catalog[file].push(row);}
 for(const c of [...input.candidates].sort((a,b)=>a.reviewId.localeCompare(b.reviewId))){
  if(seen.has(c.reviewId))throw Error('Duplicate review ID');seen.add(c.reviewId);
  if(!['調査中','公開審査待ち','公開可','公開済み'].includes(c.publicationState))throw Error('Invalid publication state');
  if(c.publicationState!=='公開可'){rejected.push({reviewId:c.reviewId,state:c.publicationState,missing:GATES.filter(g=>c.checks[g]?.ok!==true)});continue;}
  if(GATES.some(g=>c.checks[g]?.ok!==true||!c.checks[g]?.basis))throw Error('Approved record lacks all nine checks: '+c.reviewId);
  if(c.approvedFingerprint!==fingerprint(c))throw Error('Approval is stale: '+c.reviewId);
  if(!adopted.has(c.personId)||!input.people[c.personId]||c.personId!==input.people[c.personId].id)throw Error('Person not adopted');
  if(!['history','site','relation'].every(k=>c.entityStates[k]==='公開可'))throw Error('Entity state not approved');
  if(!registry.areas.some(a=>a.code===c.site.municipalityCode)||c.growthAreaId!==c.site.municipalityCode)throw Error('Invalid growth area');
  if(!Array.isArray(c.site.point)||c.site.point.length!==2||!c.site.point.every(Number.isFinite)||Math.abs(c.site.point[0])>180||Math.abs(c.site.point[1])>90)throw Error('Invalid point');
  if(!c.sources.length||c.sources.some(s=>!s.evidenceId||!s.url.startsWith('https://')||!s.locator||s.access!=='本文直接確認'))throw Error('Missing evidence locator');
  if(c.rights.text!=='独自作成・原文転載なし'||c.rights.images!=='使用なし'||c.rights.location!=='CC BY 4.0'||!c.rights.attribution)throw Error('Rights not cleared');
  if(c.legacyCardIds.length)throw Error('Legacy card rewrite needs separate reviewed migration');
  const person=by['sengoku/people.json'].get(c.personId)||input.people[c.personId];add('sengoku/people.json',person);
  const oldsite=by['sengoku/sites.json'].get(c.site.id);
  if(oldsite){if(stable(oldsite.point)!==stable(c.site.point)||oldsite.municipalityCode!==c.site.municipalityCode||oldsite.boundaryAudit==='unresolved_polygon_mismatch'||oldsite.catalogEligibility==='exclude_pending_evidence')throw Error('Legacy site conflict');}
  add('sengoku/sites.json',oldsite||{id:c.site.id,name:c.site.name,point:c.site.point,municipalityCode:c.site.municipalityCode,region:c.site.address,verification:'reviewed',coordinateSource:c.site.coordinateSource,historySource:c.sources[0].url,note:c.rights.attribution});
  const pairLink=[...by['sengoku/links.json'].values()].find(l=>l.personId===c.personId&&l.siteId===c.site.id);
  if(!pairLink)add('sengoku/links.json',{id:id('link',[c.personId,c.site.id]),personId:c.personId,siteId:c.site.id,relatedYear:c.eventYear,relatedYearEnd:null,yearEvidence:'publication_review',verification:'reviewed',source:c.sources[0].url});
  const cardId=id('card',[c.personId,c.historyRecordId,c.site.id,c.claimKey]);
  const card={id:cardId,personId:c.personId,siteId:c.site.id,title:c.publicText.title,summary:c.publicText.summary+'\n'+c.rights.attribution,source:c.sources[0].url,verification:'reviewed',unlockRule:'same_municipality',eventYear:c.eventYear,yearEvidence:'publication_review',historyRecordId:c.historyRecordId,relationId:c.relationId,publicationVersion:input.version};
  add('sengoku/cards.json',card);
  records.push({cardId,personId:c.personId,historyRecordId:c.historyRecordId,relationId:c.relationId,siteId:c.site.id,growthAreaId:c.growthAreaId,growthUnitKey:c.personId+'|'+c.growthAreaId,releaseVersion:input.version});
 }
 const p=by['sengoku/people.json'],s=by['sengoku/sites.json'];for(const file of ['sengoku/links.json','sengoku/cards.json'])for(const row of catalog[file])if(!p.has(row.personId)||!s.has(row.siteId))throw Error('Dangling catalog reference '+row.id);
 for(const file of FILES)for(const old of rows(file))if(stable(by[file].get(old.id))!==stable(old))throw Error('Legacy record changed');
 // Regional history has a distinct envelope and town-level unlock semantics. No Sengoku event is injected here.
 delta['history.json']={...structuredClone(base['history.json']),entries:[]};
 const manifest={schemaVersion:input.schemaVersion,version:input.version,masterSnapshot:input.masterSnapshot,baseline:input.baseline,approvedRecords:records.length,rejectedRecords:rejected.length,approvedSites:new Set(records.map(r=>r.siteId)).size,deltaCounts:Object.fromEntries(FILES.map(f=>[f,f==='history.json'?delta[f].entries.length:delta[f].length])),catalogCounts:Object.fromEntries(FILES.map(f=>[f,f==='history.json'?catalog[f].entries.length:catalog[f].length])),outputHashes:Object.fromEntries(FILES.map(f=>[f,hash(delta[f])])),published:false,requiresUserDeploymentApproval:true,growth:{unit:'personId + municipality/ward code',thresholds:[1,3,5,10],runtimeImplemented:false}};
 return {delta,catalog,records,rejected,manifest};
}
module.exports={FILES,GATES,hash,id,fingerprint,areaFromVisit,build,applyDelta};

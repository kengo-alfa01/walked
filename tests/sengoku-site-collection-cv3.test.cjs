// Reproducible branch-only regression; run from repo root:
// node tests/sengoku-site-collection-cv3.test.cjs
'use strict';
function run({before,after,pub,walk,doc,registry,html,manifest}){
  const known=new Set(registry.areas.map(a=>a.code)), old=before.validate(doc,known,pub.sha256), baseIdx=after.validate(doc,known,pub.sha256), idx=after.withRelatedSitePresentation(baseIdx,manifest);
  const at='2026-11-28T00:00:00.000Z', rec={first:at,last:at,source:'QA'}, issues=[], bySite=new Map();
  let checks=0,cardCases=0,storyCases=0,haloCases=0;
  function ok(value,label){checks++;if(!value)issues.push(label);}
  function eq(a,b,label){ok(JSON.stringify(a)===JSON.stringify(b),label);}
  const sites=[...idx.sites.values()], codes=[...new Set(sites.flatMap(s=>s.codes).concat([...idx.codes.values()].flatMap(s=>[...s])))].sort();
  const allVisits=Object.fromEntries(codes.map(code=>[code,rec]));
  const linked=new Set(doc.relations.map(r=>r.siteId)), pending=sites.filter(s=>!linked.has(s.siteId)&&s.relatedOnly!==true);
  ok(sites.length===579&&sites.filter(s=>s.publicPin).length===544,'fixed snapshot size');
  const basePending=[...baseIdx.sites.values()].filter(s=>!linked.has(s.siteId)&&s.relatedOnly!==true);
  ok(basePending.length===73&&basePending.filter(s=>s.publicPin).length===69,'fixed original classification queue');
  ok(pending.length===72&&pending.filter(s=>s.publicPin).length===68,'one reviewed presentation applied');
  ok(idx.histories===baseIdx.histories&&idx.linkSites===baseIdx.linkSites&&idx.codes===baseIdx.codes&&idx.municipalityAwards===baseIdx.municipalityAwards,'card rule maps unchanged');
  const target='sg2site-hideyoshi-birth-memorial', person='sg-f47391608dbb', birth='sg2hist-hideyoshi-birth-1536-1537', nakamura={'23105':rec};
  const baseSite=baseIdx.sites.get(target),projected=idx.sites.get(target);
  ok(baseSite.relatedOnly!==true&&projected.relatedOnly===true,'approved overlay is nonmutating');
  const reverted={...projected};delete reverted.relatedOnly;delete reverted.relatedPersonIds;
  eq(reverted,baseSite,'only related presentation changes');
  ok(baseSite.approval.sheetRow===2853&&baseSite.approval.version==='v3'&&baseSite.pinApproval.sheetRow===479&&baseSite.pinReview.accessStatus==='green','unchanged approval and B access');
  ok(!after.acquiredPinSiteIds(idx,{},{}).has(target)&&after.acquiredPinSiteIds(idx,nakamura,{}).has(target),'Hideyoshi memorial halo before/after');
  ok(idx.histories.get(birth).kind==='nonplace'&&!idx.codes.has(birth)&&!idx.linkSites.has(birth)&&!linked.has(target)&&!doc.municipalityAwards.some(a=>a.relatedSiteId===target),'birth stays nonplace and memorial has no card link');
  eq(after.award(idx,nakamura,{},[],at),before.award(old,nakamura,{},[],at),'Nakamura cards unchanged');
  const relatedBefore=after.relatedSites(idx,{},person,{}).find(x=>x.siteId===target);
  const relatedAfter=after.relatedSites(idx,nakamura,person,{}).find(x=>x.siteId===target);
  ok(relatedBefore?.acquired===false&&relatedAfter?.acquired===true,'memorial related before/after');
  ok([...idx.people.keys()].filter(pid=>pid!==person).every(pid=>!after.relatedSites(idx,nakamura,pid,{}).some(x=>x.siteId===target)),'no new person attribution');
  for(const change of [m=>{m.catalogVersion='old'},m=>{m.entries[0].personIds=['not-approved']},m=>{m.entries[0].approvalVersion='v2'},m=>{m.entries[0].municipalityCodes=['41201']},m=>{m.entries[0].relations[0].linkDecision='関係上対象'},m=>{m.entries.push(m.entries[0])}]){
    const bad=JSON.parse(JSON.stringify(manifest));change(bad);
    let rejected=false;try{after.withRelatedSitePresentation(baseIdx,bad)}catch(e){rejected=true}
    ok(rejected,'invalid or duplicate overlay rejected');
  }
  ok(after.acquiredSiteIds(idx,{},{}).size===0,'empty ownership');
  ok(after.acquiredSiteIds(idx,allVisits,{}).size===579,'all site IDs acquired once');
  ok(after.acquiredPinSiteIds(idx,allVisits,{}).size===544,'all pins acquired');
  for(const code of codes){
    const visits={['m:'+code]:rec};
    const got=after.acquiredSiteIds(idx,visits,{}), pins=after.acquiredPinSiteIds(idx,visits,{});
    for(const s of sites){
      const expected=s.codes.includes(code);
      if(got.has(s.siteId)!==expected||pins.has(s.siteId)!==(expected&&s.publicPin))bySite.set(s.siteId,(bySite.get(s.siteId)||0)+1);
      checks++;
    }
    eq(before.award(old,visits,{},[],at),after.award(idx,visits,{},[],at),'card regression '+code);cardCases++;
  }
  ok(bySite.size===0,'site ID discrepancy count');
  for(const s of sites)for(const code of s.codes){
    ok(after.acquiredSiteIds(idx,{[code]:rec},{}).has(s.siteId),'raw municipality '+s.siteId);
    ok(after.acquiredSiteIds(idx,{['n:'+code+':qa']:rec},{}).has(s.siteId),'town key '+s.siteId);
  }
  const ise='sg2site-a-audit-nabe-ise-shrine-20261114', saga={'41201':rec};
  ok(!after.acquiredPinSiteIds(idx,{},{}).has(ise),'Ise before visit');
  ok(after.acquiredPinSiteIds(idx,saga,{}).has(ise),'Ise after visit');
  ok(!linked.has(ise)&&!doc.municipalityAwards.some(a=>a.relatedSiteId===ise),'Ise creates no direct card route');
  const sagaCards=after.award(idx,saga,{},[],at);
  eq(sagaCards,before.award(old,saga,{},[],at),'Saga card regression');
  const full=after.award(idx,allVisits,{},[],at);
  eq(full,before.award(old,allVisits,{},[],at),'all municipality cards');
  ok(new Set(full.added).size===full.added.length,'no duplicate history cards');
  for(const pid of idx.people.keys()){
    for(const found of [{},sagaCards.records,full.records]){
      eq(after.canUnlockStory(idx,pid,found,pub.sha256),before.canUnlockStory(old,pid,found,pub.sha256),'story '+pid);storyCases++;
    }
    const related=after.relatedSites(idx,{},pid,{});
    eq(related.map(x=>x.siteId),sites.filter(s=>s.relatedOnly===true&&(s.relatedPersonIds||s.approvedPersonIds||s.personIds).includes(pid)).map(s=>s.siteId).sort(),'approved related membership '+pid);
    ok(related.every(x=>!x.acquired),'related before '+pid);
    ok(after.relatedSites(idx,allVisits,pid,{}).every(x=>x.acquired),'related after '+pid);
  }
  const shared=sites.filter(s=>s.personIds.length>1);
  ok(shared.length>0,'real shared-site coverage');
  for(const s of shared)ok([...after.acquiredSiteIds(idx,{[s.codes[0]]:rec},{})].filter(id=>id===s.siteId).length===1,'shared '+s.siteId);
  const noPins=sites.filter(s=>!s.publicPin);
  for(const s of noPins){const v={[s.codes[0]]:rec};ok(after.acquiredSiteIds(idx,v,{}).has(s.siteId)&&!after.acquiredPinSiteIds(idx,v,{}).has(s.siteId),'unpinned '+s.siteId);}
  for(const [hid,ids] of idx.linkSites)if(ids.size>1){
    const siteId=[...ids][0],got=after.acquiredSiteIds(idx,{}, {[hid]:{siteId,at,basis:'old'}});
    ok(got.size===1&&got.has(siteId),'legacy exact site '+hid);
    ok(after.acquiredSiteIds(idx,{}, {[hid]:{at,basis:'old'}}).size===0,'ambiguous old record '+hid);
  }
  const [hid,ids]=[...idx.linkSites].find(([h,s])=>s.size===1&&!idx.municipalityAwards.has(h));
  const siteId=[...ids][0],saved={[hid]:{siteId,at,basis:'legacy'}};
  ok(after.acquiredSiteIds(idx,{},saved).has(siteId),'explicit legacy ownership');
  ok(after.acquiredSiteIds(idx,{}, {[hid]:{at,basis:idx.version}}).has(siteId),'provable same-release single link');
  ok(!after.acquiredSiteIds(idx,{}, {[hid]:{at}}).has(siteId),'do not invent unknown historical route');
  ok(!after.acquiredSiteIds(idx,{}, {[hid]:{siteId:ise,at,basis:idx.version}}).has(ise),'reject unrelated site ID');
  const titles={awards:{},selected:null};
  const v4=walk.parseBackup(JSON.parse(JSON.stringify(walk.backupWithHomeBase(saga,saved,titles,null,at))));
  eq(v4.visited,saga,'v4 visit');eq(v4.cards,saved,'v4 card');
  ok(after.acquiredSiteIds(idx,v4.visited,v4.cards).has(ise)&&after.acquiredSiteIds(idx,v4.visited,v4.cards).has(siteId),'v4 ownership');
  const v3=walk.parseBackup(walk.backup(saga,saved,titles,at));eq(v3.cards,saved,'v3 card');
  const v2=walk.parseBackup({format:'walked-backup-v2',visited:saga});
  ok(after.acquiredSiteIds(idx,v2.visited,v2.cards).has(ise),'v2 ownership');
  const merged=walk.mergeBackup(walk.parseBackup(walk.backup({},saved,titles,at)),v2);
  eq(merged.cards,saved,'merge retains legacy card');
  ok(after.acquiredSiteIds(idx,merged.visited,merged.cards).has(ise),'merge retains visit');
  const snapshot=JSON.stringify({saga,saved});after.acquiredSiteIds(idx,saga,saved);eq(JSON.stringify({saga,saved}),snapshot,'no storage mutation');
  // Compile actual page scripts and exercise the real halo renderer with lightweight Leaflet stubs.
  for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g))if(!/\bsrc=/.test(m[1])&&(!/\btype=/.test(m[1])||/javascript/.test(m[1])))Function(m[2]);
  const start=html.indexOf('function refreshSengokuPins(){'),end=html.indexOf('// Only B-approved acquisition relationships',start);
  ok(start>=0&&end>start,'pin renderer present');
  function renderPins(visited){
    const halos=[],centers=[];
    const layer=target=>({target,clearLayers(){target.length=0;}});
    const L={circleMarker(point,options){return {bindPopup(){return this},off(){return this},on(){return this},addTo(group){group.target.push({point,options});return this}}},DomEvent:{}};
    const env={sengokuPinHalos:layer(halos),sengokuPins:layer(centers),sengokuV2Catalog:idx,activeCollectionMode:'sengoku',sitePinSheet:{isOpen:()=>false,close(){}},selectedSengokuPersonId:null,SengokuV2:after,state:{visited},sengokuFound:{},L,sengokuPinRenderer:{},SengokuPinDisplay:{statusFor:s=>s.pinReview.accessStatus},SengokuPinApprovedV2:{},sengokuPinPopup:()=>null};
    Function(...Object.keys(env),html.slice(start,end)+'\nrefreshSengokuPins();')(...Object.values(env));
    return {halos,centers};
  }
  const white=renderPins({}),black=renderPins(saga),fullPins=renderPins(allVisits),published=sites.filter(s=>s.publicPin);
  ok(white.halos.length===544&&black.halos.length===544&&fullPins.halos.length===544,'mock renderer count');
  for(let k=0;k<published.length;k++){
    const s=published[k],expected=s.codes.includes('41201')?'#151515':'#ffffff';
    ok(white.halos[k]?.options.fillColor==='#ffffff'&&black.halos[k]?.options.fillColor===expected&&fullPins.halos[k]?.options.fillColor==='#151515','rendered halo '+s.siteId);
    ok(white.centers[k]?.options.fillColor===before.pinPresentation(s.pinReview.accessStatus).fill&&white.centers[k]?.options.fillColor===black.centers[k]?.options.fillColor&&white.centers[k]?.options.fillColor===fullPins.centers[k]?.options.fillColor,'unchanged B center '+s.siteId);
    haloCases++;
  }
  // Execute the actual approved related-site UI block, not a rewritten imitation.
  const rs=html.indexOf(' const relatedSites=relatedSengokuSites(person.id);'),re=html.indexOf('\n detail.append(section);',rs);
  ok(rs>=0&&re>rs,'related UI present');
  function renderRelated(personId,visited){
    const element=tag=>({tag,children:[],dataset:{},className:'',textContent:'',append(...children){this.children.push(...children);}});
    const section=element('section'),env={section,person:{id:personId},document:{createElement:element},relatedSengokuSites:pid=>after.relatedSites(idx,visited,pid,{}),titleRegistry:registry,SengokuSourceLinks:{append(){}}};
    Function(...Object.keys(env),html.slice(rs,re))(...Object.values(env));
    return section.children.filter(x=>x.dataset.siteId);
  }
  for(const pid of idx.people.keys()){
    const a=renderRelated(pid,{}),b=renderRelated(pid,allVisits);
    eq(a.map(x=>x.dataset.siteId),b.map(x=>x.dataset.siteId),'related list remains stable '+pid);
    ok(a.every(x=>x.children.some(n=>n.textContent==='未獲得'))&&b.every(x=>x.children.some(n=>n.textContent==='史跡獲得済み')),'related UI labels '+pid);
  }
  const memorialIndex=published.findIndex(s=>s.siteId===target),nakaPins=renderPins(nakamura);
  ok(white.halos[memorialIndex]?.options.fillColor==='#ffffff'&&nakaPins.halos[memorialIndex]?.options.fillColor==='#151515'&&white.centers[memorialIndex]?.options.fillColor===nakaPins.centers[memorialIndex]?.options.fillColor,'Hideyoshi memorial actual halo renderer');
  const memorialBefore=renderRelated(person,{}).filter(x=>x.dataset.siteId===target),memorialAfter=renderRelated(person,nakamura).filter(x=>x.dataset.siteId===target);
  ok(memorialBefore.length===1&&memorialBefore[0].children.some(n=>n.textContent==='未獲得')&&memorialAfter.length===1&&memorialAfter[0].children.some(n=>n.textContent==='史跡獲得済み'),'Hideyoshi memorial actual related UI');
  return {checks,issues,siteInconsistencies:[...bySite],municipalityCases:codes.length,cardCases,storyCases,haloCases,relatedSites:sites.filter(s=>s.relatedOnly===true).length,sharedSites:shared.length,unpinnedSites:noPins.length,sagaCards:sagaCards.added.length,totalCards:full.added.length};
}
if(require.main===module){
 const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
 const root=path.resolve(__dirname,'..');
 const read=p=>fs.readFileSync(path.join(root,p),'utf8');
 const moduleFromSource=s=>{const m={exports:{}};Function('module','exports',s)(m,m.exports);return m.exports;};
 const old=cp.execFileSync('git',['show','fe6e16471508b6545e6d54f31e98cbb38b01941c:sengoku-v2-core.js'],{cwd:root,encoding:'utf8',maxBuffer:10*1024*1024});
 const result=run({before:moduleFromSource(old),after:require('../sengoku-v2-core.js'),pub:require('../publication-runtime.js'),walk:require('../walked-core.js'),doc:JSON.parse(read('sengoku/v2/approved-c-20261126-new4.json')),registry:JSON.parse(read('data/title-registry.json')),html:read('index.html'),manifest:require('../sengoku/v2/related-site-presentation-cv3.js')});
 console.log(JSON.stringify(result,null,2));
 if(result.issues.length||result.siteInconsistencies.length)process.exitCode=1;
}
module.exports=run;

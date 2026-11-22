'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),doc=JSON.parse(fs.readFileSync(path.join(root,'sengoku/v2/approved-c-20261120-new9-80.json'),'utf8'));
const V=require('../sengoku-v2-core.js'),P=require('../publication-runtime.js');
const registry=JSON.parse(fs.readFileSync(path.join(root,'data/title-registry.json'),'utf8'));
const idx=V.validate(doc,new Set(registry.areas.map(r=>r.code)),P.sha256);
const person=[...idx.people.values()].find(p=>p.name==='立花宗茂');
if(!person)throw Error('No Tachibana Muneshige!');
const h=[...idx.histories.values()].filter(x=>x.personId===person.personId);
const data=h.map(x=>{
 const code=[...(idx.codes.get(x.historyId)||[])];
 const siteIds=[...(idx.linkSites.get(x.historyId)||[])];
 const sites=siteIds.map(id=>{
  const s=idx.sites.get(id);
  return s?{name:s.name,location:s.pinReview?.municipality,codes:s.codes,public:s.publicPin,point:s.point}:null;
 }).filter(Boolean);
 return {id:x.historyId,kind:x.kind,title:x.title,year:x.year||x.yearText,eligible:code,
   prefectures:[...new Set(code.map(c=>c.slice(0,2)))],sites};
});
const relevant=new Set(['11','13','14','22','23','29']);
const places=data.filter(x=>x.kind==='place');
const inVisitedPref=places.filter(x=>x.prefectures.some(p=>relevant.has(p)));
const guesses=[];
for(const c of new Set(inVisitedPref.flatMap(x=>x.eligible.filter(k=>relevant.has(k.slice(0,2)))))){
 const grants=V.award(idx,{[c]:{first:'2026-01-01'}},{},[],'2026-11-22');
 const personal=grants.added.filter(id=>idx.histories.get(id)?.personId===person.personId);
 guesses.push({code:c,granted:personal.length,place:personal.filter(id=>idx.histories.get(id)?.kind==='place').length,
   nonplace:personal.filter(id=>idx.histories.get(id)?.kind!=='place').length,historyIds:personal});
}
const out={person:person.name,personId:person.personId,approvedTotal:h.length,placeCount:places.length,
 nonPlaceCount:data.filter(x=>x.kind==='nonplace').length,
 sitesPotentiallyMatchedInSixPrefectures:inVisitedPref,allPlaceHistory:data.filter(x=>x.kind==='place'),
 exampleAutomaticAwards:guesses,
 note:'This is a catalogue-only diagnostic; no user browser storage or exact visit records were accessed.'};
console.log('MUNESHIGE_DIAGNOSTIC '+JSON.stringify(out));


const tokyo=new Set(['13106','13120']);
const tokyoSites=[...idx.sites.values()].filter(s=>(s.codes||[]).some(code=>tokyo.has(code)));
const matchedSites=tokyoSites.map(site=>{
 const linkedHistories=[...idx.linkSites].filter(([h,sites])=>sites.has(site.siteId)).map(([id])=>{
  const h=idx.histories.get(id);
  return {historyId:id,personId:h?.personId,personName:idx.people.get(h?.personId)?.name,historyTitle:h?.title,kind:h?.kind,eligible:[...(idx.codes.get(id)||[])]};
 });
 const relevantPersonIds=[...(site.pinPersonIds||site.personIds||[])];
 return {siteId:site.siteId,name:site.name,siteDescription:(site.description||'').slice(0,250),
  municipality:site.pinReview?.municipality,municipalityCodes:site.codes,publicPin:site.publicPin,
  pinPersonIds:site.pinPersonIds||null,personIds:site.personIds||null,
  names:relevantPersonIds.map(id=>idx.people.get(id)?.name),
  associations:linkedHistories,mentionsTachibana:JSON.stringify(site).includes('宗茂')};
});
const personRelevantTokyos=matchedSites.filter(x=>x.names.includes('立花宗茂')||x.associations.some(h=>h.personId===person.personId)||x.mentionsTachibana);
const tokyoTachibanaHistory=[...idx.histories.values()].filter(h=>h.personId===person.personId&&[...(idx.codes.get(h.historyId)||[])].some(c=>tokyo.has(c)));
const visitAward=V.award(idx,{'13106':{first:'2026-11-22'},'13120':{first:'2026-11-22'}},{},[],'2026-11-22');
const visitMuneshige=visitAward.added.filter(id=>idx.histories.get(id)?.personId===person.personId);
const result={tokyoSiteCount:tokyoSites.length,personRelevantTokyos,allSites:matchedSites,
  muneshigeHistoryEligibleTaitoNerima:tokyoTachibanaHistory.map(x=>x.historyId),
  visitingOnlyTaitoNerimaAwardsMuneshige:visitMuneshige,
  sameVisitAwardsOtherPeople:visitAward.added.map(id=>({historyId:id,person:idx.people.get(idx.histories.get(id)?.personId)?.name})).slice(0,50)};
console.log('MUNESHIGE_TOKYO_SITE_CAUSE '+JSON.stringify(result));

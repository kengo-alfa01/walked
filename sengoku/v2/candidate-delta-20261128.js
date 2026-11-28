/* Exact, version-bound C branch release candidate. Never mutates the base or user storage. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SengokuCandidateDelta=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const BASE="v2-approved-c-20261126-new4-v12",VERSION="v2-approved-c-20261128-cv3-94",BASE_HASH="f5eca8af5f054d41c4a17c13cafe9eea310996845ea969dde31bd0333d888bfb",DELTA_HASH="17d8acc2c92da69e5dfa94dbca737a18dc01c4be9adbb0b33518090a94143064";
const check=(v,m)=>{if(!v)throw Error(m)};
function apply(base,delta,sha){
 check(typeof sha==='function'&&base?.version===BASE&&sha(JSON.stringify(base))===BASE_HASH,'C候補の基準版が一致しません');
 check(delta?.schema==='walked.sengoku.v2.candidate-delta.v1'&&delta.baseVersion===BASE&&delta.version===VERSION&&delta.baseSHA256===BASE_HASH&&sha(JSON.stringify(delta))===DELTA_HASH,'C候補の差分版が一致しません');
 const clone=x=>JSON.parse(JSON.stringify(x));
 const out=clone(base);
 for(const [field,key] of [['people','personId'],['histories','historyId'],['sites','siteId']]){
  const m=new Map(out[field].map(x=>[x[key],x]));
  for(const row of delta[field])m.set(row[key],clone(row));
  out[field]=[...m.values()];
 }
 const keys=new Set(out.relations.map(x=>x.historyId+'|'+x.siteId));
 for(const row of delta.relations){const k=row.historyId+'|'+row.siteId;check(!keys.has(k),'候補の④関係重複');keys.add(k);out.relations.push(clone(row));}
 const awards=new Set(out.municipalityAwards.map(x=>x.historyId));
 for(const row of delta.municipalityAwards){check(!awards.has(row.historyId),'候補の特例重複');awards.add(row.historyId);out.municipalityAwards.push(clone(row));}
 out.version=VERSION;
 return out;
}
function presentation(manifest){check(manifest?.catalogVersion===BASE,'関連史跡の基準版不一致');return {...manifest,catalogVersion:VERSION};}
return {apply,presentation,BASE,VERSION};
});

const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const script=html.split('<script>').at(-1).split('</script>')[0];
new vm.Script(script); // Syntax-check the entire application, not just the functions exercised below.
function source(name){
 const start=script.indexOf('function '+name+'(');assert.ok(start>=0,name);
 let at=script.indexOf('{',start),depth=1,i=at+1;
 for(;depth;i++){if(script[i]==='{')depth++;if(script[i]==='}')depth--;}
 return script.slice(start,i);
}
const state={visited:{},features:[],featureById:new Map(),machidaById:new Map(),sagamiharaById:new Map(),prefById:new Map(),nationById:new Map(),nationCache:new Map(),layers:new Map(),machida:[],sagamihara:[],mode:'municipal'};
const ctx={state,MACHIDA_CODE:'13209',MACHIDA_PREFIX:'m:',SAGAMIHARA_PREFIX:'s:',NATION_PREFIX:'n:',PREF_PREFIX:'p:',sengokuSites:[],sengokuCards:[],sengokuFound:{},sengokuStoreKey:'test',localStorage:{setItem(){}},writeStore(){},persist(){},renderSengoku(){},refreshSengokuPins(){},toastSengokuCards(){},coveredPrefCodes(){return new Set()}};
ctx.normHistory=s=>String(s||'').replace(/\s/g,'');vm.createContext(ctx);
for(const name of ['canonicalAreaKey','areaRecordKeys','areaMunicipalityCode','key','areaModeForFeature','keyForMode','isVisited','getFeature','mark','unmark','ringContains','geomContains','municipalCode','getMunicipalityForPoint','eligibleSengokuCard','matchedSengokuCardsAtPoint','acquireSengokuByAreaFeature','reconcileSengokuVisits','hasHistoryArea'])vm.runInContext(source(name),ctx);
for(const code of ['13209','14151','14152','14153']){
 const town=code+'00101',regional=(code==='13209'?'m:':'s:')+town,national='n:'+code+':'+town;
 const feature={id:town,properties:{KEY_CODE:town,WALKED_MUNICIPAL_CODE:code}};
 assert.equal(ctx.keyForMode(feature,'nationwideDetail'),regional);
 state.nationById.set(regional,feature);
 state.visited={[regional]:{first:'2020',last:'2020',source:'手動'}};
 assert.ok(ctx.isVisited(national));assert.ok(ctx.isVisited(regional));
 ctx.unmark(national);assert.ok(!ctx.isVisited(regional));
 state.visited={[national]:{first:'2020',last:'2020',source:'タイムライン'}};
 assert.ok(ctx.isVisited(regional));ctx.mark(regional,'タイムライン','2021');
 assert.equal(state.visited[national].first,'2020');assert.equal(state.visited[national].last,'2021');
 ctx.unmark(regional);assert.ok(!ctx.isVisited(national));
 state.visited={[code]:{}};assert.ok(!ctx.isVisited(regional),'city must not fill every town');
}
state.machida=[{id:'1320900101',properties:{KEY_CODE:'1320900101',S_NAME:'木曽東一丁目'}}];
state.visited={'n:13209:1320900101':{}};assert.ok(ctx.hasHistoryArea({city:'町田',area:'木曽東一丁目'}),'history accepts shared legacy key');
state.visited={'13209':{}};assert.ok(!ctx.hasHistoryArea({city:'町田',area:'木曽東一丁目'}),'municipal visit never fills every history town');
function polygon(id,x0,x1){return {id,properties:{},geometry:{type:'Polygon',coordinates:[[[x0,0],[x1,0],[x1,10],[x0,10],[x0,0]]]}}}
state.features=[polygon('13209',0,10),polygon('14151',10,20)];
ctx.sengokuSites=[{id:'site',municipalityCode:'13209',point:[1,1],verification:'reviewed'},{id:'blocked',municipalityCode:'13209',point:[1,1],verification:'reviewed',boundaryAudit:'unresolved_polygon_mismatch'},{id:'pending',municipalityCode:'13209',point:[1,1],verification:'pending'}];
ctx.sengokuCards=ctx.sengokuSites.map(s=>({id:s.id+'-card',siteId:s.id,verification:'reviewed'}));
assert.deepEqual(Array.from(ctx.matchedSengokuCardsAtPoint([9,9]).ids),['site-card'],'same city, different town, no town data');
assert.equal(ctx.matchedSengokuCardsAtPoint([19,9]).ids.length,0,'neighboring municipality excluded');
assert.equal(ctx.matchedSengokuCardsAtPoint([30,9]).ids.length,0,'outside all boundaries');
ctx.acquireSengokuByAreaFeature(state.features[0]);assert.deepEqual(Object.keys(ctx.sengokuFound),['site-card']);
ctx.sengokuFound={};state.visited={'m:1320900101':{}};ctx.reconcileSengokuVisits();assert.deepEqual(Object.keys(ctx.sengokuFound),['site-card'],'saved town visits qualify');
ctx.sengokuFound={};state.visited={'n:13209:1320900101':{}};ctx.reconcileSengokuVisits();assert.deepEqual(Object.keys(ctx.sengokuFound),['site-card'],'legacy national backup qualifies');
console.log('PASS: map key sharing, legacy backups, reversible unmark, city acquisition, exclusions and saved visits');

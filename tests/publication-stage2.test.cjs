const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom'),vm=require('node:vm');
const root=path.join(__dirname,'..'),assets=process.env.WALKED_BROWSER_ASSETS;
if(!assets)throw Error('Set WALKED_BROWSER_ASSETS to the pinned municipalities.topojson and topojson-client.min.js directory');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const topo=JSON.parse(fs.readFileSync(path.join(assets,'municipalities.topojson')));
const core=fs.readFileSync(path.join(root,'walked-core.js'),'utf8');
const read=w=>JSON.parse(w.eval('JSON.stringify(currentBackup())'));
async function app(initial={}){
 const dom=new JSDOM(html,{url:'https://walked-test.invalid/',runScripts:'outside-only'}),w=dom.window;w.eval=code=>new vm.Script(code).runInContext(dom.getInternalVMContext());
 for(const [k,v] of Object.entries(initial))w.localStorage.setItem(k,typeof v==='string'?v:JSON.stringify(v));
 const layer=()=>({addTo(){return this},on(){return this},bindTooltip(){return this},bindPopup(){return this},setStyle(){return this},clearLayers(){},getBounds(){return {}}});
 const map={...layer(),setView(){return this},fitBounds(){return this},removeLayer(){},getZoom(){return 12},getCenter(){return {lng:139.4,lat:35.5}},getBounds(){return {getWest:()=>139.3,getEast:()=>139.5,getNorth:()=>35.6,getSouth:()=>35.4}}};
 w.L={map:()=>map,control:{zoom:layer},tileLayer:layer,layerGroup:layer,circleMarker:layer,geoJSON(features,options){const layers=features.map(f=>{const l={...layer(),feature:f};options?.onEachFeature?.(f,l);return l});return {...layer(),eachLayer(fn){layers.forEach(fn)}}}};
 w.fetch=async url=>{let doc;if(String(url).includes('/municipalities.topojson'))doc=topo;else if(String(url).includes('/prefectures.topojson'))doc={type:'Topology',objects:{prefectures:{type:'GeometryCollection',geometries:[]}},arcs:[]};else doc=JSON.parse(fs.readFileSync(path.resolve(root,String(url)),'utf8'));return {ok:true,status:200,json:async()=>structuredClone(doc),text:async()=>JSON.stringify(doc)}};
 w.confirm=()=>true;w.eval(fs.readFileSync(path.join(assets,'topojson-client.min.js'),'utf8'));w.eval(core);w.eval(fs.readFileSync(path.join(root,'publication-runtime.js'),'utf8'));w.eval(fs.readFileSync(path.join(root,'map-coloring.js'),'utf8'));
 w.eval(html.split('<script>').at(-1).split('</script>')[0]);
 for(let i=0;i<30;i++){await new Promise(r=>setTimeout(r,10));if(w.eval('!!titleView&&state.features.length===1905&&sengokuCards.length>0&&state.machida.length>0&&state.sagamihara.length>0'))return w;}
 throw Error('App initialization failed: '+w.document.getElementById('status').textContent);
}
const keys=['walked_municipal_v2','walked_sengoku_cards_v1','walked_titles_v1'];
const raw=w=>keys.map(k=>w.localStorage.getItem(k));
async function restore(w,doc){await w.document.getElementById('restoreFile').onchange({target:{files:[{text:async()=>JSON.stringify(doc)}],value:'file'}});}

const cp=require('node:child_process'),{FILES,hash}=require('../scripts/import-publication.cjs');
const {apply,release}=require('../scripts/import-publication-stage2.cjs');
const base=Object.fromEntries(FILES.map(f=>[f,JSON.parse(cp.execFileSync('git',['show',release.baselineCommit+':'+f],{encoding:'utf8'}))]));
// Immutable stage2 catalog; integration tests below still execute the current application.
const current=Object.fromEntries(FILES.map(f=>[f,JSON.parse(cp.execFileSync('git',['show','3abcb77f7ee3c53c8837ce85bef4bf8b78ea58d4:'+f],{encoding:'utf8'}))]));
const profileDoc=release.profiles;
test('stage2 imports only two additions and two approved text updates, preserving every ID and protected field',()=>{
 assert.deepEqual(apply(base),current);assert.equal(current['sengoku/cards.json'].length,306);assert.equal(current['sengoku/people.json'].length,531);assert.equal(current['sengoku/links.json'].length,235);
 for(const f of FILES){for(const old of f==='history.json'?base[f].entries:base[f]){const now=(f==='history.json'?current[f].entries:current[f]).find(r=>r.id===old.id);const update=f==='sengoku/cards.json'&&release.updates.find(u=>u.cardId===old.id);assert.deepEqual(now,update?update.after:old);}}
 assert.deepEqual(current['sengoku/sites.json'],base['sengoku/sites.json']);assert.deepEqual(current['history.json'],base['history.json']);
 const cards=release.additions['sengoku/cards.json'];assert.equal(cards[0].eventYear,1554);assert.equal(cards[0].eventYearEnd,1561);assert.equal(cards[1].eventYear,null);assert.match(cards[1].summary,/本人の登城・居住は確認できていない/);
 assert.equal(new Set(require('../walked-core.js').catalog(require('../data/title-registry.json')).map(t=>t.id)).size,214);
});
test('replay and partial application stay identical; stale catalogs, target edits and package tampering are rejected',()=>{
 assert.deepEqual(apply(current),current);
 const partial=structuredClone(base);partial['sengoku/cards.json'][partial['sengoku/cards.json'].findIndex(c=>c.id===release.updates[0].cardId)]=release.updates[0].after;assert.deepEqual(apply(partial),current);
 const changed=structuredClone(base);changed['sengoku/cards.json'][0].summary+='unreviewed';assert.throws(()=>apply(changed),/Baseline/);
 const stale=structuredClone(base);stale['sengoku/cards.json'].find(c=>c.id===release.updates[0].cardId).title='edited';assert.throws(()=>apply(stale),/Stale/);
 const tampered=structuredClone(release);tampered.profiles.profiles[0].birthYear=1;assert.throws(()=>apply(base,tampered),/checksum/);
});
test('22 scoped profiles contain no raw master data, unapproved fallback, images or unresolved notes',()=>{
 assert.equal(profileDoc.profiles.length,22);assert.deepEqual(profileDoc,release.profiles);
 const allowed=new Set(['reviewId','version','personId','name','scope','birthYear','deathYear','datePrecision','calendar','summary','aliases','sourceUrls','sourceLocators','attribution','publicationStatus','approvalSHA256']);
 for(const p of profileDoc.profiles){for(const k of Object.keys(p))assert.ok(allowed.has(k));assert.equal(p.publicationStatus,'公開可');assert.ok(p.sourceUrls.every(u=>u.startsWith('https://')));assert.ok(p.summary);}
 assert.equal(profileDoc.profiles.find(p=>p.personId==='sg-master-0922').birthYear,null);
 assert.equal(profileDoc.profiles.find(p=>p.personId==='sg-e701cb97b4d9').deathYear,null);
});
test('Gifu and Yamagata saved visits unlock separate new cards; unvisited neighbors cannot unlock them',async()=>{
 const ids=release.additions['sengoku/cards.json'].map(c=>c.id),legacy={'sg-card-0276':{at:'2001-01-01',siteId:'sg-site-suwahara'},'retired-card':{at:'1999-02-03'}};
 const visits={'21201':{first:'2020-01-01',last:'2021-01-01'},'n:21215:212150001':{first:'2019-01-01'}};
 const w=await app({walked_municipal_v2:visits,walked_sengoku_cards_v1:legacy});const b=read(w);for(const id of ids)assert.ok(b.cards[id]);assert.deepEqual(b.visited,visits);for(const [id,r] of Object.entries(legacy))assert.deepEqual(b.cards[id],r);
 const found=Object.keys(b.cards),sameCity=w.eval("sengokuCards.filter(c=>sengokuSites.find(s=>s.id===c.siteId)?.municipalityCode==='21201'&&eligibleSengokuCard(c)).map(c=>c.id)");assert.ok(sameCity.length>1);for(const id of sameCity)assert.ok(found.includes(id));
 const w2=await app(Object.fromEntries(keys.map(k=>[k,w.localStorage.getItem(k)])));assert.deepEqual(read(w2).cards,b.cards);assert.ok(w2.document.getElementById('sengokuToast').hidden);
 const w3=await app();await restore(w3,b);for(const [id,r] of Object.entries(b.cards))assert.deepEqual(read(w3).cards[id],r);assert.deepEqual(read(w3).visited,visits);
 const neighbor=await app({walked_municipal_v2:{'21202':{}}});for(const id of ids)assert.ok(!read(neighbor).cards[id]);
 for(const x of [w,w2,w3,neighbor])x.close();
});
test('only acquired profile scope is displayed with source links; null years are never filled from legacy fields',async()=>{
 const w=await app({walked_municipal_v2:{'21201':{}}});
 w.eval("showSengokuPerson({...sengokuPeople.find(p=>p.id==='sg-master-0922'),birthYear:1529,summary:'UNREVIEWED'})");
 const detail=w.document.getElementById('sengokuDetail');assert.match(detail.textContent,/生年未確認/);assert.match(detail.textContent,/1561年没/);assert.ok(!detail.textContent.includes('1529'));assert.ok(!detail.textContent.includes('UNREVIEWED'));assert.match(detail.textContent,/1554〜1561年/);assert.ok(detail.querySelector('.sengoku-profile a'));
 w.eval("showSengokuPerson(sengokuPeople.find(p=>p.id==='sg-dc8c550d8769'))");assert.equal(detail.querySelector('.sengoku-profile'),null);w.close();
});
test('updated existing card shows CODH attribution and retains acquisition timestamp after restore',async()=>{
 const w=await app({walked_sengoku_cards_v1:{'sg-card-0241':{at:'2002-03-04',siteId:'sg-site-minowa'}}});w.eval("showSengokuPerson(sengokuPeople.find(p=>p.id==='sg-4c0c12460efa'))");
 const detail=w.document.getElementById('sengokuDetail');assert.match(detail.textContent,/武田信玄による箕輪城攻略/);assert.match(detail.querySelector('.publication-credit').textContent,/CODH.*10.20676\/00000456/);assert.ok(detail.querySelector('.publication-credit').parentElement.querySelector('a[href^="https://"]'));assert.equal(read(w).cards['sg-card-0241'].at,'2002-03-04');w.close();
});
test('GPS-point, manual-area and retroactive storage failures commit no in-memory awards or notifications; retry works',async()=>{
 for(const method of ['point','area','reconcile']){
  const w=await app();const before=raw(w),original=w.Storage.prototype.setItem;
  w.Storage.prototype.setItem=function(k,v){if(k==='walked_sengoku_cards_v1')throw Error('quota');return original.call(this,k,v)};
  const action=method==='point'?"acquireSengokuByPoint([136.782034,35.433927],'2020-02-03')":method==='area'?"acquireSengokuByAreaFeature(state.features.find(f=>municipalCode(f)==='21201'))":"reconcileSengokuVisits()";
  if(method==='reconcile')w.eval("state.visited={'21201':{first:'2020-01-01'}}");
  assert.throws(()=>w.eval(action),/quota/);assert.deepEqual(raw(w),before);assert.deepEqual(read(w).cards,{});assert.ok(w.document.getElementById('sengokuToast').hidden);
  w.Storage.prototype.setItem=original;w.eval(action);assert.ok(read(w).cards['pub-card-c45fcd74b14d1ad8998e9fd7']);if(method==='point')assert.equal(read(w).cards['pub-card-c45fcd74b14d1ad8998e9fd7'].at,'2020-02-03');w.close();
 }
});

test('GPS unavailable, denied and timeout paths leave visits, cards and titles untouched',async()=>{
 for(const mode of ['unavailable','denied','timeout']){
  for(const button of ['locate','centerMap']){
   const w=await app({walked_sengoku_cards_v1:{'retired-card':{at:'2000-01-01'}}}),before=raw(w);
   Object.defineProperty(w.navigator,'geolocation',{configurable:true,value:mode==='unavailable'?undefined:{getCurrentPosition(ok,fail){fail({code:mode==='denied'?1:3,message:mode==='denied'?'permission denied':'timeout'})}}});
   w.document.getElementById(button).click();assert.deepEqual(raw(w),before);
   assert.match(w.document.getElementById('status').textContent,mode==='unavailable'?/位置情報機能が使えません/:mode==='denied'?/permission denied/:/timeout/);w.close();
  }
 }
});
test('display-current-location centers the map without registering a visit or awarding cards',async()=>{
 const w=await app(),before=raw(w);Object.defineProperty(w.navigator,'geolocation',{configurable:true,value:{getCurrentPosition(ok){ok({coords:{latitude:35.433927,longitude:136.782034}})}}});
 w.document.getElementById('centerMap').click();assert.deepEqual(raw(w),before);assert.deepEqual(read(w).visited,{});assert.deepEqual(read(w).cards,{});assert.match(w.document.getElementById('status').textContent,/制覇登録はしていません/);w.close();
});
test('GPS position outside loaded Japanese municipality boundaries does not create false records',async()=>{
 const w=await app(),before=raw(w);Object.defineProperty(w.navigator,'geolocation',{configurable:true,value:{getCurrentPosition(ok){ok({coords:{latitude:0,longitude:0}})}}});
 w.document.getElementById('locate').click();assert.deepEqual(raw(w),before);assert.match(w.document.getElementById('status').textContent,/一致する市区町村が見つかりません/);w.close();
});

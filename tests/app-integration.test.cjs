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
 w.confirm=()=>true;w.eval(fs.readFileSync(path.join(assets,'topojson-client.min.js'),'utf8'));w.eval(core);
 w.eval(html.split('<script>').at(-1).split('</script>')[0]);
 for(let i=0;i<30;i++){await new Promise(r=>setTimeout(r,10));if(w.eval('!!titleView&&state.features.length===1905&&sengokuCards.length>0&&state.machida.length>0&&state.sagamihara.length>0'))return w;}
 throw Error('App initialization failed: '+w.document.getElementById('status').textContent);
}
const keys=['walked_municipal_v2','walked_sengoku_cards_v1','walked_titles_v1'];
const raw=w=>keys.map(k=>w.localStorage.getItem(k));
async function restore(w,doc){await w.document.getElementById('restoreFile').onchange({target:{files:[{text:async()=>JSON.stringify(doc)}],value:'file'}});}
const seeded={walked_municipal_v2:{'n:13209:1320900101':{first:'2020-01-01',last:'2020-01-01',source:'タイムライン'},'s:1415100101':{}},walked_sengoku_cards_v1:{'retired-card':{at:'2019-01-01',siteId:'retired-site'}}};
test('pinned map geometry IDs match the title registry and excluded IDs without omissions',()=>{
 const registry=require('../data/title-registry.json');const expected=[...registry.areas,...registry.excluded].map(a=>a.code).sort();assert.deepEqual(topo.objects.municipalities.geometries.map(g=>String(g.id)).sort(),expected);assert.equal(require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(assets,'municipalities.topojson'))).digest('hex'),registry.sourceSHA256);
});
test('full application boots, migrates titles, selects profile and preserves hidden card records on reload',async()=>{
 const w=await app(seeded);assert.equal(w.document.querySelector('header').textContent,'WALKED');w.document.getElementById('sengokuToggle').click();assert.equal(w.document.querySelectorAll('.sengoku-person').length,w.eval('sengokuPeople.filter(p=>countOwned(p.id)>0).length'));assert.equal(w.document.getElementById('sengokuFilter'),null);assert.match(w.document.getElementById('titleProgress').textContent,/全国 2 \/ 1892/);assert.ok(read(w).cards['retired-card']);assert.equal(w.document.getElementById('titleToast').hidden,false);
 w.document.getElementById('titleToggle').click();assert.equal(w.document.querySelectorAll('.title-card').length,1);w.eval("selectTitle('national-1')");assert.equal(w.document.getElementById('profileTitle').textContent,'足軽');
 const saved=Object.fromEntries(keys.map(k=>[k,w.localStorage.getItem(k)]));const w2=await app(saved);assert.equal(w2.document.getElementById('titleToast').hidden,true);assert.equal(w2.document.getElementById('profileTitle').textContent,'足軽');
 w2.document.getElementById('titleToggle').click();w2.document.getElementById('titleCategory').value='region';w2.eval('renderTitles()');assert.equal(w2.document.querySelectorAll('.title-card').length,0);
 w2.document.getElementById('titleCategory').value='prefecture';w2.eval('renderTitles()');assert.equal(w2.document.querySelectorAll('.title-card').length,0);
 w.close();w2.close();
});
test('v2 restore and v3 export/restore preserve every collection and store a pre-restore checkpoint',async()=>{
 const w=await app(seeded);w.eval("selectTitle('national-1')");const before=read(w);
 await restore(w,{format:'walked-backup-v2',visited:{'14152':{},'13209':{first:'2018-01-01',last:'2026-10-31',source:'手動'}}});
 const merged=read(w);assert.equal(Object.keys(merged.visited).length,4);assert.equal(w.eval('titleView.progress.count'),3);assert.ok(merged.cards['retired-card']);assert.equal(merged.titles.selected,'national-1');
 for(const field of ['visited','cards','titles'])assert.deepEqual(JSON.parse(w.localStorage.getItem('walked_before_restore_v1'))[field],before[field]);
 const w2=await app();await restore(w2,merged);assert.ok(read(w2).cards['retired-card']);assert.equal(read(w2).titles.selected,'national-1');assert.deepEqual(read(w2).visited,merged.visited);
 w.close();w2.close();
});
test('cancelled/invalid imports change no saved records',async()=>{
 const w=await app(seeded),before=raw(w);w.confirm=()=>false;await restore(w,{format:'walked-backup-v2',visited:{'13201':{}}});assert.deepEqual(raw(w),before);
 w.confirm=()=>true;await restore(w,{format:'walked-backup-v3',visited:{'13201':{}},cards:[],titles:{awards:{},selected:null}});assert.deepEqual(raw(w),before);assert.match(w.document.getElementById('status').textContent,/復元できません/);w.close();
});
test('quota failure during restore rolls back storage and never mutates active game',async()=>{
 const w=await app(seeded),before=raw(w),beforeGame=read(w),original=w.Storage.prototype.setItem;
 w.Storage.prototype.setItem=function(k,v){if(k==='walked_sengoku_cards_v1'&&v.includes('new-card'))throw Error('quota');return original.call(this,k,v)};
 await restore(w,{format:'walked-backup-v3',visited:{'13201':{}},cards:{'new-card':{}},titles:{awards:{},selected:null}});
 assert.deepEqual(raw(w),before);assert.deepEqual(read(w).visited,beforeGame.visited);assert.ok(!read(w).cards['new-card']);assert.equal(w.localStorage.getItem('walked_restore_journal_v1'),null);w.close();
});
test('clearing visits retains cards, acquired titles and profile, with a recoverable checkpoint',async()=>{
 const w=await app(seeded);w.eval("selectTitle('national-1')");const before=read(w);w.document.getElementById('clear').click();const after=read(w);assert.deepEqual(after.visited,{});assert.deepEqual(after.cards,before.cards);assert.deepEqual(after.titles,before.titles);for(const field of ['visited','cards','titles'])assert.deepEqual(JSON.parse(w.localStorage.getItem('walked_before_restore_v1'))[field],before[field]);w.close();
});
test('corrupt original data is never silently overwritten and raw rescue exports it',async()=>{
 const w=await app({walked_municipal_v2:'{broken'});assert.equal(w.localStorage.getItem('walked_municipal_v2'),'{broken');assert.equal(w.eval('lockedStorageKeys.has(DBKEY)'),true);assert.throws(()=>w.eval('currentBackup()'));
 w.eval('window.rescued=null;download=(name,obj)=>{window.rescued=obj}');w.document.getElementById('rescueStorage').click();assert.equal(w.rescued.raw.walked_municipal_v2,'{broken');w.close();
});
test('interrupted multi-key restore is recovered before startup reads the game',async()=>{
 const w=await app({walked_municipal_v2:{'13201':{}},walked_restore_journal_v1:JSON.stringify({walked_municipal_v2:JSON.stringify(seeded.walked_municipal_v2),walked_sengoku_cards_v1:JSON.stringify(seeded.walked_sengoku_cards_v1),walked_titles_v1:null})});assert.deepEqual(read(w).visited,seeded.walked_municipal_v2);assert.ok(read(w).cards['retired-card']);assert.equal(w.localStorage.getItem('walked_restore_journal_v1'),null);w.close();
});
test('timeline storage failure releases busy state and collection batching',async()=>{
 const w=await app(),original=w.Storage.prototype.setItem;w.Storage.prototype.setItem=function(k,v){if(k==='walked_municipal_v2')throw Error('quota');return original.call(this,k,v)};
 await assert.rejects(w.eval('processRecords([])'),/quota/);assert.equal(w.eval('state.busy'),false);assert.equal(w.eval('sengokuBulkImport'),false);w.close();
});

function preview(w){w.eval("document.head.insertAdjacentHTML('beforeend','<meta name=\"walked-preview\" content=\"test\">')");w.eval(fs.readFileSync(path.join(root,'preview/preview.js'),'utf8'));}
test('preview-only sample adds 31 areas, awards titles, and refuses to mix with existing records',async()=>{
 const w=await app();preview(w);w.document.getElementById('previewSample').click();assert.equal(w.eval('titleView.progress.count'),31);assert.equal(w.document.getElementById('profileTitle').textContent,'足軽大将');assert.equal(w.localStorage.getItem('walked_preview_sample_v1'),'true');
 const before=raw(w);w.document.getElementById('previewSample').click();assert.deepEqual(raw(w),before);assert.match(w.document.getElementById('status').textContent,/記録が空/);w.close();
});
test('preview helper is inert without preview marker and cannot overwrite corrupt stored records',async()=>{
 const w=await app();w.eval(fs.readFileSync(path.join(root,'preview/preview.js'),'utf8'));assert.equal(w.document.getElementById('previewSample'),null);w.close();
 const broken=await app({walked_municipal_v2:'{broken'});preview(broken);broken.document.getElementById('previewSample').click();assert.equal(broken.localStorage.getItem('walked_municipal_v2'),'{broken');broken.close();
});

const publishedIds=['pub-card-450a5da6b076b67bff0ea854','pub-card-99565c9c43c63128707e581e'];
test('approved history unlocks from saved municipality/legacy town visits, preserves old cards and credits, and survives backup/reload without duplicate notification',async()=>{
 for(const visited of [{'20203':{first:'2019-01-01',last:'2020-01-01'},'16208':{}},{'n:20203:202030001':{},'n:16208:162080001':{}}]){
  const w=await app({walked_municipal_v2:visited,walked_sengoku_cards_v1:{'retired-card':{at:'2018-01-01'},'sg-card-0266':{at:'2018-02-01',siteId:'sg-site-masuyama'}}});
  for(const site of ['sg-site-ueda','sg-site-masuyama'])assert.equal(w.eval(`municipalCode(getMunicipalityForPoint(sengokuSites.find(s=>s.id==='${site}').point))`),site==='sg-site-ueda'?'20203':'16208');
  const before=read(w);for(const id of publishedIds)assert.ok(before.cards[id]);assert.deepEqual(before.visited,visited);assert.equal(before.cards['sg-card-0266'].at,'2018-02-01');assert.equal(before.cards['retired-card'].at,'2018-01-01');
  w.eval('reconcileSengokuVisits()');for(const field of ['visited','cards','titles'])assert.deepEqual(read(w)[field],before[field]);
  w.eval("showSengokuPerson(sengokuPeople.find(p=>p.id==='sg-dc8c550d8769'))");const detail=w.document.getElementById('sengokuDetail');assert.match(detail.textContent,/1576年/);assert.match(detail.textContent,/CC BY 4.0/);assert.match(detail.textContent,/10.20676\/00000456/);assert.ok([...detail.querySelectorAll('a')].some(a=>a.href==='https://kunishitei.bunka.go.jp/heritage/detail/401/00003642'));
  const saved=Object.fromEntries(keys.map(k=>[k,w.localStorage.getItem(k)]));const w2=await app(saved);assert.deepEqual(read(w2).cards,before.cards);assert.equal(w2.document.getElementById('sengokuToast').hidden,true);
  await restore(w2,before);assert.deepEqual(read(w2).cards,before.cards);const fresh=await app();await restore(fresh,before);assert.deepEqual(read(fresh).cards,before.cards);fresh.close();w.close();w2.close();
 }
});
test('unvisited or neighboring municipalities do not unlock the new history',async()=>{
 for(const visited of [{},{'20204':{},'16209':{}}]){const w=await app({walked_municipal_v2:visited});for(const id of publishedIds)assert.ok(!read(w).cards[id]);w.close();}
});
test('storage failure during retroactive unlock leaves saved and active card histories intact, then retry succeeds',async()=>{
 const w=await app(),before=raw(w),oldCards=read(w).cards,original=w.Storage.prototype.setItem;
 w.eval("state.visited={'20203':{},'16208':{}};");w.Storage.prototype.setItem=function(k,v){if(k==='walked_sengoku_cards_v1')throw Error('quota');return original.call(this,k,v)};
 assert.throws(()=>w.eval('reconcileSengokuVisits()'),/quota/);assert.deepEqual(raw(w),before);assert.deepEqual(read(w).cards,oldCards);
 w.Storage.prototype.setItem=original;w.eval('reconcileSengokuVisits()');for(const id of publishedIds)assert.ok(read(w).cards[id]);w.close();
});

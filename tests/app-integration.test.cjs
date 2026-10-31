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
 const w=await app(seeded);assert.match(w.document.getElementById('titleProgress').textContent,/全国 2 \/ 1892/);assert.ok(read(w).cards['retired-card']);assert.equal(w.document.getElementById('titleToast').hidden,false);
 w.document.getElementById('titleToggle').click();assert.equal(w.document.querySelectorAll('.title-card').length,10);w.eval("selectTitle('national-1')");assert.equal(w.document.getElementById('profileTitle').textContent,'足軽');
 const saved=Object.fromEntries(keys.map(k=>[k,w.localStorage.getItem(k)]));const w2=await app(saved);assert.equal(w2.document.getElementById('titleToast').hidden,true);assert.equal(w2.document.getElementById('profileTitle').textContent,'足軽');
 w2.document.getElementById('titleToggle').click();w2.document.getElementById('titleCategory').value='region';w2.eval('renderTitles()');assert.equal(w2.document.querySelectorAll('.title-card').length,16);
 w2.document.getElementById('titleCategory').value='prefecture';w2.eval('renderTitles()');assert.equal(w2.document.querySelectorAll('.title-card').length,4);
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

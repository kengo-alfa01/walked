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
 w.confirm=()=>true;w.eval(fs.readFileSync(path.join(assets,'topojson-client.min.js'),'utf8'));w.eval(core);w.eval(fs.readFileSync(path.join(root,'regional-core.js'),'utf8'));w.eval(fs.readFileSync(path.join(root,'regional-ui.js'),'utf8'));
 w.eval(html.split('<script>').at(-1).split('</script>')[0]);
 for(let i=0;i<30;i++){await new Promise(r=>setTimeout(r,10));if(w.eval('!!titleView&&state.features.length===1905&&sengokuCards.length>0&&state.machida.length>0&&state.sagamihara.length>0'))return w;}
 throw Error('App initialization failed: '+w.document.getElementById('status').textContent);
}
const keys=['walked_municipal_v2','walked_sengoku_cards_v1','walked_titles_v1'];
const raw=w=>keys.map(k=>w.localStorage.getItem(k));
async function restore(w,doc){await w.document.getElementById('restoreFile').onchange({target:{files:[{text:async()=>JSON.stringify(doc)}],value:'file'}});}

test('real app starts regional module, restores v3 and reloads old town visits without changing cards or dates',async()=>{
 const w=await app();await new Promise(r=>setTimeout(r,20));w.document.querySelector('#regionalPanel button').click();assert.match(w.document.querySelector('#regionalPanel [data-status]').textContent,/0項目/);
 const doc={format:'walked-backup-v3',visited:{'n:14111:14111001':{first:'2000-01-01'}},cards:{retired:{at:'1999-01-01'}},titles:{awards:{},selected:null}};
 await restore(w,doc);assert.match(w.document.querySelector('#regionalPanel [data-status]').textContent,/1項目/);const b=read(w);assert.equal(b.cards.retired.at,'1999-01-01');assert.equal(b.visited['n:14111:14111001'].first,'2000-01-01');
 const next=await app(Object.fromEntries(keys.map(k=>[k,w.localStorage.getItem(k)])));await new Promise(r=>setTimeout(r,20));assert.match(next.document.querySelector('#regionalPanel [data-status]').textContent,/1項目/);assert.deepEqual(read(next).cards,b.cards);w.close();next.close();
});
test('unsaved in-memory visit and quota failure cannot reveal regional articles',async()=>{
 const w=await app();await new Promise(r=>setTimeout(r,20));w.eval("state.visited={'14212':{}};window.regionEncyclopedia.refresh()");assert.match(w.document.querySelector('#regionalPanel [data-status]').textContent,/0項目/);
 const original=w.Storage.prototype.setItem;w.Storage.prototype.setItem=function(k,v){if(k==='walked_municipal_v2')throw Error('quota');return original.call(this,k,v)};
 assert.throws(()=>w.eval('persist()'),/quota/);assert.match(w.document.querySelector('#regionalPanel [data-status]').textContent,/0項目/);w.close();
});

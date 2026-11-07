const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom'),vm=require('node:vm');
const root=path.join(__dirname,'../..'),assets=process.env.WALKED_BROWSER_ASSETS;
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
 w.confirm=()=>true;w.eval(fs.readFileSync(path.join(assets,'topojson-client.min.js'),'utf8'));w.eval(core);w.eval(fs.readFileSync(path.join(root,'publication-runtime.js'),'utf8'));w.eval(fs.readFileSync(path.join(root,'sengoku-v2-core.js'),'utf8'));w.eval(fs.readFileSync(path.join(root,'map-coloring.js'),'utf8'));w.eval(fs.readFileSync(path.join(root,'regional-core.js'),'utf8'));w.eval(fs.readFileSync(path.join(root,'regional-ui.js'),'utf8'));
 w.eval(html.split('<script>').at(-1).split('</script>')[0]);
 for(let i=0;i<30;i++){await new Promise(r=>setTimeout(r,10));if(w.eval('!!titleView&&state.features.length===1905&&!!sengokuV2Catalog&&state.machida.length>0&&state.sagamihara.length>0'))return w;}
 throw Error('App initialization failed: '+w.document.getElementById('status').textContent);
}

const ownedCount=visits=>require('../../regional-core.js').view(require('../../regional/catalog.json'),visits,require('../../data/title-registry.json')).items.length;
const keys=['walked_municipal_v2','walked_sengoku_cards_v1','walked_titles_v1'];
const raw=w=>keys.map(k=>w.localStorage.getItem(k));
async function restore(w,doc){await w.document.getElementById('restoreFile').onchange({target:{files:[{text:async()=>JSON.stringify(doc)}],value:'file'}});}


module.exports={app,read,restore,raw};

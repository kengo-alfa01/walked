'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),W=require('../migration/runtime.js');
const read=k=>JSON.parse(fs.readFileSync(path.join(root,'migration/generated',k+'.json'),'utf8'));
const data={people:read('people'),archive:read('people-archive'),sites:read('sites'),cards:read('cards'),links:read('links')};
test('runtime validates full 612-person dataset and archived card references',()=>assert.equal(W.validate(data),true));
test('runtime fails on missing archive, duplicate IDs and broken card link',()=>{
 assert.throws(()=>W.validate({...data,archive:[]}));assert.throws(()=>W.validate({...data,people:[...data.people,data.people[0]]}));assert.throws(()=>W.validate({...data,links:[]}));
});
test('alias, reading, fullwidth-space and case normalization search',()=>{
 const p=data.people.find(p=>p.name==='真田幸村');assert(W.matches(p,'真田 信繁'));assert(W.matches(p,p.reading));assert(W.matches({name:'ABC'},'ａｂｃ'));assert(!W.matches(p,'これは無関係'));
});
test('generic alias collisions remain search results, never ID merges',()=>{
 const ids=read('search-index')['三郎'];if(ids)assert(ids.length>1);const ps=data.people.filter(p=>W.matches(p,'三郎'));assert(ps.length>1);assert.equal(new Set(data.people.map(p=>p.id)).size,612);
});
test('legacy visited-only backup restores; full backup preserves unknown/future found records',()=>{
 const visited={'m:abc':{at:'2026-01-01'}},found={'sg-card-0001':{at:'2026-01-01',siteId:'sg-site-odawara'},'future-card':{at:'2026-01-01'}};
 assert.deepEqual(W.restore({format:'walked-backup-v2',visited}),{visited,found:{}});assert.deepEqual(W.restore(JSON.parse(JSON.stringify(W.backup(visited,found)))),{visited,found});assert.throws(()=>W.restore({format:'bad',visited}));
});
function harness(){
 const elements=new Map();function element(tag='div'){return {tag,children:[],value:'',checked:false,hidden:false,textContent:'',append(...xs){this.children.push(...xs)},replaceChildren(...xs){this.children=xs},add(x){this.children.push(x)},scrollIntoView(){}}}
 const $=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id)};
 const store=new Map([['walked_sengoku_cards_v1',JSON.stringify({'sg-card-0001':{at:'2026-01-01',siteId:'sg-site-odawara'}})]]);
 const ctx={console,WalkedMigration:W,document:{createElement:element},$,L:{layerGroup:()=>({addTo(){return this},clearLayers(){}}),circleMarker:()=>({bindPopup(){},addTo(){}})},map:{},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},Option:function(t,v){return {text:t,value:v}},state:{machida:[],sagamihara:[],nationCache:new Map()},geomContains:(point,geom)=>point[0]>=geom.west&&point[0]<=geom.east&&point[1]>=geom.south&&point[1]<=geom.north,fetch:async url=>{const name=url.match(/([^/]+)\.json$/)[1];return {ok:true,json:async()=>read(name)}},setTimeout,clearTimeout};
 vm.createContext(ctx);
 const html=fs.readFileSync(path.join(root,'migration/preview.html'),'utf8');let code=html.slice(html.indexOf('// Sengoku collection:'));code=code.slice(0,code.indexOf('</script>'));code=code.replace('loadSengoku();','');vm.runInContext(code,ctx);return {ctx,elements,store,$,run:s=>vm.runInContext(s,ctx)};
}
test('actual preview JS loads, renders 612, searches aliases and displays verification labels',async()=>{
 const h=harness();await h.run('loadSengoku()');h.run("sengokuOpen=true;renderSengoku()");assert.equal(h.$('sengokuList').children.length,612);
 h.$('sengokuSearch').value='真田信繁';h.run('renderSengoku()');assert.equal(h.$('sengokuList').children.length,1);h.$('sengokuList').children[0].onclick();assert(h.$('sengokuDetail').children.some(x=>x.textContent.includes('精査は継続中')));
});
test('actual preview acquisition is idempotent, respects boundaries and never writes live keys',async()=>{
 const h=harness();await h.run('loadSengoku()');h.ctx.testSite=data.sites.find(s=>s.id==='sg-site-odawara');h.run("state.nationCache.set(testSite.municipalityCode,[{geometry:{west:testSite.point[0]-.001,east:testSite.point[0]+.001,south:testSite.point[1]-.001,north:testSite.point[1]+.001}}])");
 const old=h.store.get('walked_sengoku_cards_v1');const n=h.run('acquireSengokuByPoint(testSite.point,"2026-10-26")');assert(n>0);assert.equal(h.run('acquireSengokuByPoint(testSite.point)'),0);assert.equal(h.run('acquireSengokuByPoint([0,0])'),0);assert.equal(h.store.get('walked_sengoku_cards_v1'),old);assert(h.store.has('walked_migration_preview_cards_v1'));
});
test('actual eligibility gate still excludes unreviewed and boundary-blocked cards',async()=>{
 const h=harness();await h.run('loadSengoku()');assert.equal(h.run("eligibleSengokuCard({...sengokuCards[0],verification:'needs_review'})"),false);h.run("sengokuSites.find(s=>s.id===sengokuCards[0].siteId).boundaryAudit='unresolved_polygon_mismatch'");assert.equal(h.run('eligibleSengokuCard(sengokuCards[0])'),false);
});
test('archived owned cards remain visible under found-only and do not enter active roster',async()=>{
 const h=harness();await h.run('loadSengoku()');const c=data.cards.find(c=>data.archive.some(p=>p.id===c.personId)&&c.verification==='reviewed'&&data.sites.some(s=>s.id===c.siteId&&s.verification==='reviewed'&&!s.catalogEligibility&&s.boundaryAudit!=='unresolved_polygon_mismatch'));assert(c);
 h.ctx.testCard=c;h.run("sengokuFound[testCard.id]={at:'2026-10-26'};sengokuOpen=true");h.$('sengokuFilter').value='found';h.run('renderSengoku()');assert(h.$('sengokuList').children.some(b=>b.children[0].textContent.includes('過去のカード')));assert.equal(h.run('sengokuPeople.length'),612);
});

test('same-name 島津家久 search returns two distinct people without merging IDs',()=>{
 const a=data.people.find(p=>p.selection.rosterId==='1046'),b=data.people.find(p=>p.selection.rosterId==='1053');assert.notEqual(a.id,b.id);assert(W.matches(a,'島津家久'));assert(W.matches(b,'島津家久'));
});

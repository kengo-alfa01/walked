const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../walked-core.js'),registry=require('../data/title-registry.json');
const blank=()=>({awards:{},selected:null});
const visits=n=>Object.fromEntries(registry.areas.slice(0,n).map(a=>[a.code,{first:'2020-01-01',last:'2020-01-01',source:'手動'}]));
const empty=()=>({visited:{},cards:{},titles:blank()});
test('frozen registry agrees with 47 prefectures, eight decided regions and 214 stable titles',()=>{
 assert.equal(registry.areas.length,1892);assert.equal(registry.excluded.length,13);assert.equal(new Set(registry.areas.map(a=>a.code)).size,1892);
 const all=C.catalog(registry);assert.equal(all.length,214);assert.equal(new Set(all.map(t=>t.id)).size,214);
 assert.deepEqual(all.filter(t=>t.kind==='national').map(t=>t.threshold),[1,25,50,100,200,350,500,750,1000,1892]);
 assert.deepEqual(registry.regions.find(r=>r.name==='東海道').prefectures,['22','23']);
 assert.deepEqual(registry.regions.find(r=>r.name==='四国').names,['南海道の覇者','四国統一']);
});
for(const t of C.catalog(registry).filter(t=>t.kind==='national'))test('national threshold '+t.name,()=>{
 assert.equal(C.qualifies(t,C.progress(visits(t.threshold-1),registry)),false);
 assert.equal(C.qualifies(t,C.progress(visits(t.threshold),registry)),true);
});
test('towns, old national keys, repeated municipality and separate wards count once',()=>{
 const v={'13209':{},'m:1320900101':{},'m:1320900102':{},'n:13209:1320900101':{},'s:1415100101':{},'14151':{},'14152':{},'p:13':{},'99999':{},'13000':{},'01695':{}};
 assert.equal(C.progress(v,registry).count,3);
});
test('all 47 prefectures use ceil for all four thresholds; 99 percent never earns 100',()=>{
 for(const t of C.catalog(registry).filter(t=>t.kind==='prefecture')){
  const areas=registry.areas.filter(a=>a.prefecture===t.prefecture),n=Math.ceil(areas.length*t.percent/100);
  const v=n=>Object.fromEntries(areas.slice(0,n).map(a=>[a.code,{}]));
  assert.equal(C.qualifies(t,C.progress(v(n-1),registry)),false,t.id);assert.equal(C.qualifies(t,C.progress(v(n),registry)),true,t.id);
 }
});
test('all regions require EACH constituent prefecture, not an average',()=>{
 for(const t of C.catalog(registry).filter(t=>t.kind==='region')){
  const v={};for(const code of t.prefectures){const a=registry.areas.filter(a=>a.prefecture===code),n=Math.ceil(a.length*t.percent/100);for(const x of a.slice(0,n))v[x.code]={};}
  assert.equal(C.qualifies(t,C.progress(v,registry)),true,t.id);
  delete v[registry.areas.find(a=>a.prefecture===t.prefectures[0]).code];assert.equal(C.qualifies(t,C.progress(v,registry)),false,t.id);
  const first=t.prefectures[0];for(const a of registry.areas.filter(a=>t.prefectures.slice(1).includes(a.prefecture)))v[a.code]={};
  assert.equal(C.qualifies(t,C.progress(v,registry)),false,t.id+' average shortcut');
 }
});
test('awards persist after unmark; reload and re-visit do not re-notify; selection retained',()=>{
 const first=C.evaluate(visits(100),registry,blank(),'2026-10-31T00:00:00Z');assert.ok(first.newIds.includes('national-4'));
 first.state.selected='national-1';const second=C.evaluate({},registry,first.state);assert.deepEqual(second.state,first.state);assert.deepEqual(second.newIds,[]);
 assert.deepEqual(C.evaluate(visits(100),registry,first.state).newIds,[]);
});
test('v3 roundtrip includes legacy/unpublished card IDs and unknown future title IDs',()=>{
 const data={visited:visits(2),cards:{'old-hidden-card':{at:'2020-01-01',siteId:'old-site',extra:'preserve'}},titles:{awards:{'future-title':{acquiredAt:'2020-01-02'}},selected:'future-title'}};
 const restored=C.parseBackup(JSON.parse(JSON.stringify(C.backup(data.visited,data.cards,data.titles))));
 for(const field of ['visited','cards','titles'])assert.deepEqual(restored[field],data[field]);
});
test('v2 additive restore canonicalizes aliases and preserves first/last timestamps and all cards',()=>{
 const current={visited:{'m:1320900101':{first:'2024-01-01',last:'2025-01-01',source:'手動'},'14151':{}},cards:{saved:{at:'2020-01-01'}},titles:{awards:{'national-1':{acquiredAt:'2024-01-01'}},selected:'national-1'}};
 const incoming=C.parseBackup({format:'walked-backup-v2',visited:{'n:13209:1320900101':{first:'2020-01-01',last:'2026-01-01',source:'タイムライン'},'99999':{}}});
 const merged=C.mergeBackup(current,incoming);assert.deepEqual(merged.cards,current.cards);assert.deepEqual(merged.titles,current.titles);
 assert.equal(merged.visited['m:1320900101'].first,'2020-01-01');assert.equal(merged.visited['m:1320900101'].last,'2026-01-01');assert.ok(merged.visited['99999']);assert.ok(merged.visited['14151']);assert.equal(Object.keys(merged.visited).length,3);
 assert.equal(current.visited['m:1320900101'].first,'2024-01-01','inputs never mutated');
});
test('v3 merge preserves both collections, earliest acquisition and current display choice',()=>{
 const a=empty(),b=empty();a.cards.a={at:'2025-01-01',siteId:'a'};b.cards.a={at:'2020-01-01',siteId:'a'};b.cards.b={};
 a.titles={awards:{'national-1':{acquiredAt:'2025-01-01'}},selected:'national-1'};b.titles={awards:{'national-1':{acquiredAt:'2020-01-01'},'national-2':{}},selected:'national-2'};
 const m=C.mergeBackup(a,b);assert.equal(m.cards.a.at,'2020-01-01');assert.ok(m.cards.b);assert.equal(m.titles.awards['national-1'].acquiredAt,'2020-01-01');assert.equal(m.titles.selected,'national-1');
});
test('invalid backups are rejected completely, including arrays, field types and prototype keys',()=>{
 for(const doc of [null,[],{format:'walked-backup-v4',visited:{}},{format:'walked-backup-v2',visited:[]},{format:'walked-backup-v2',visited:{x:null}},{format:'walked-backup-v2',visited:{x:{first:2}}},{format:'walked-backup-v3',visited:{},cards:[] ,titles:blank()},{format:'walked-backup-v3',visited:{},cards:{},titles:{awards:[],selected:null}},JSON.parse('{"format":"walked-backup-v2","visited":{"__proto__":{"polluted":true}}}')])assert.throws(()=>C.parseBackup(doc));
 assert.equal({}.polluted,undefined);
});
function storage(failAt=0){const m=new Map([['visits','old visits'],['cards','old cards'],['titles','old titles']]);let writes=0;return {m,getItem:k=>m.has(k)?m.get(k):null,setItem(k,v){if(++writes===failAt)throw Error('quota');m.set(k,v)},removeItem:k=>m.delete(k)};}
for(let failAt=1;failAt<=4;failAt++)test('restore rollback on quota failure at write '+failAt,()=>{
 const s=storage(failAt);assert.throws(()=>C.transaction(s,{visits:'new',cards:'new',titles:'new'},'journal'));assert.equal(s.getItem('visits'),'old visits');assert.equal(s.getItem('cards'),'old cards');assert.equal(s.getItem('titles'),'old titles');assert.equal(s.getItem('journal'),null);
});
test('restore commits all keys; interrupted restore recovers on next startup',()=>{
 const s=storage();C.transaction(s,{visits:'new',cards:'new',titles:'new'},'journal');assert.equal(s.getItem('cards'),'new');assert.equal(s.getItem('journal'),null);
 s.setItem('journal',JSON.stringify({visits:'previous',cards:null}));s.setItem('visits','partial');C.recover(s,'journal');assert.equal(s.getItem('visits'),'previous');assert.equal(s.getItem('cards'),null);assert.equal(s.getItem('journal'),null);
});

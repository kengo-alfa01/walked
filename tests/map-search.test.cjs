const {test}=require('node:test'),assert=require('node:assert/strict');
const {app,read,restore,raw}=require('./support/app.cjs');
const picker=w=>w.document.getElementById('mapSearchPref');
function pickPref(w,code){const el=picker(w);el.value=code;el.dispatchEvent(new w.Event('change'));return [...w.document.querySelectorAll('#results .item')];}
const choices=w=>[...w.document.querySelectorAll('#results .map-search-name')];
const choice=(w,name)=>choices(w).find(x=>x.textContent===name);
function mode(w,on){const el=w.document.getElementById('areaAddMode');el.checked=on;el.dispatchEvent(new w.Event('change'));}
const action=(w,name)=>choice(w,name)?.parentElement.querySelector('[data-area-action]')||null;

test('map area finder uses regional-style prefecture picker and municipal units only',async()=>{
 const w=await app();assert.equal(w.document.getElementById('historyPanel'),null);
 assert.ok(w.document.getElementById('regionalPanel'));assert.ok(w.document.getElementById('sengokuPanel'));
 assert.equal(require('../history.json').entries.length,20);
 assert.match(picker(w).parentElement.textContent,/地図で地域を探す/);
 assert.equal(w.document.getElementById('search'),null);
 assert.equal(picker(w).options.length,48);
 assert.match(w.document.getElementById('results').textContent,/都道府県を選んでください/);
 const tokyo=pickPref(w,'13');
 assert.ok(tokyo.length>20);assert.equal(choice(w,'町田市')?.textContent,'町田市');
 assert.equal(choices(w).filter(x=>x.textContent==='町田市').length,1);
 assert.equal(choices(w).some(x=>/丁目|大字|字/.test(x.textContent)),false);
 const kanagawa=pickPref(w,'14');assert.ok(kanagawa.length);assert.ok(choice(w,'鎌倉市'));
 const hokkaido=pickPref(w,'01');assert.ok(hokkaido.length);assert.ok(choice(w,'札幌市中央区'));
 assert.equal(choice(w,'札幌市'),undefined);
 assert.deepEqual(read(w).visited,{});w.close();
});

test('view-only municipality selection changes the map and never edits visit records',async()=>{
 const w=await app(),before=raw(w);w.mapMoves=[];w.eval('map.fitBounds=(...args)=>window.mapMoves.push(args)');
 pickPref(w,'13');assert.equal(action(w,'町田市'),null);
 choice(w,'町田市').click();
 assert.equal(w.eval('state.mode'),'municipal');
 assert.ok(w.mapMoves.length>=1);assert.deepEqual(raw(w),before);
 mode(w,true);const retained=action(w,'町田市').onclick;mode(w,false);
 assert.equal(action(w,'町田市'),null);
 retained();
 w.eval('toggleFeature(state.machida[0])');
 assert.deepEqual(raw(w),before);assert.deepEqual(read(w).visited,{});w.close();
});

test('ON registers and removes one municipality, preserving visits, cards and backup',async()=>{
 const w=await app();
 await restore(w,{format:'walked-backup-v3',visited:{'14212':{first:'2000-01-01',last:'2001-01-01',source:'手動'},'m:1320900101':{first:'2002-01-01',last:'2003-01-01',source:'タイムライン'}},cards:{retired:{at:'1999-01-01'}},titles:{awards:{},selected:null}});
 const before=read(w);pickPref(w,'13');mode(w,true);
 action(w,'町田市').click();
 const registered=read(w);
 assert.ok(registered.visited['13209'],'registration must use 5-digit municipal code');
 assert.deepEqual(registered.visited['14212'],before.visited['14212']);
 assert.deepEqual(registered.visited['m:1320900101'],before.visited['m:1320900101']);
 assert.deepEqual(registered.cards,before.cards);assert.equal(action(w,'町田市').textContent,'解除');
 const backup=JSON.parse(JSON.stringify(registered));await restore(w,backup);
 assert.deepEqual(read(w).visited,registered.visited);
 w.confirm=()=>false;action(w,'町田市').click();assert.deepEqual(read(w).visited,registered.visited);
 w.confirm=()=>{mode(w,false);return true};mode(w,true);
 action(w,'町田市').click();assert.deepEqual(read(w).visited,registered.visited);
 mode(w,true);w.confirm=()=>true;action(w,'町田市').click();
 const removed=read(w);assert.deepEqual(removed.visited,before.visited);
 assert.deepEqual(removed.cards,registered.cards);assert.deepEqual(removed.titles,registered.titles);
 const keys=['walked_municipal_v2','walked_sengoku_cards_v1','walked_titles_v1'];
 const next=await app(Object.fromEntries(keys.map(k=>[k,w.localStorage.getItem(k)])));
 assert.deepEqual(read(next).visited,removed.visited);w.close();next.close();
});

test('changing prefecture invalidates stale callbacks; map mode does not change finder choices',async()=>{
 const w=await app(),before=raw(w);pickPref(w,'13');mode(w,true);
 const stale=action(w,'町田市').onclick;
 pickPref(w,'14');assert.ok(choice(w,'鎌倉市'));
 stale();assert.deepEqual(raw(w),before);
 w.eval("changeMode('nationwideDetail')");assert.ok(choice(w,'鎌倉市'));
 assert.equal(choices(w).some(x=>/丁目/.test(x.textContent)),false);
 w.eval("changeMode('prefecture')");assert.ok(choice(w,'鎌倉市'));
 pickPref(w,'');assert.equal(choices(w).length,0);
 assert.match(w.document.getElementById('results').textContent,/都道府県を選んでください/);
 assert.deepEqual(raw(w),before);w.close();
});

const {test}=require('node:test'),assert=require('node:assert/strict');
const {app,read,restore,raw}=require('./support/app.cjs');
function search(w,q){const el=w.document.getElementById('search');el.value=q;el.dispatchEvent(new w.Event('input'));return [...w.document.querySelectorAll('#results .item')];}
function mode(w,on){const el=w.document.getElementById('areaAddMode');el.checked=on;el.dispatchEvent(new w.Event('change'));}
const action=w=>w.document.querySelector('#results [data-area-action]');

test('standalone history UI is closed without removing regional or Sengoku collections',async()=>{
 const w=await app();assert.equal(w.document.getElementById('historyPanel'),null);assert.equal(w.document.getElementById('historyDialog'),null);
 assert.equal(w.eval('typeof loadHistory'),'undefined');assert.ok(w.document.getElementById('regionalPanel'));assert.ok(w.document.getElementById('sengokuPanel'));
 assert.equal(require('../history.json').entries.length,20);assert.match(w.document.querySelector('#search').parentElement.textContent,/地図で地域を探す/);w.close();
});
test('OFF search moves the map only; retained callbacks and direct old handlers cannot change records',async()=>{
 const w=await app();const before=raw(w);w.mapMoves=[];w.eval('map.fitBounds=(...args)=>window.mapMoves.push(args)');
 assert.ok(search(w,'町田').length);assert.equal(action(w),null);w.document.querySelector('#results .map-search-name').click();assert.equal(w.mapMoves.length,1);assert.deepEqual(raw(w),before);
 mode(w,true);const retained=action(w).onclick;mode(w,false);assert.equal(action(w),null);
 for(let i=0;i<3;i++){retained();w.eval('toggleFeature(state.machida[0])');}
 assert.deepEqual(raw(w),before);assert.deepEqual(read(w).visited,{});w.close();
});
test('ON registers/removes with confirmation, preserves other visits/cards/dates and v3 reload',async()=>{
 const w=await app();await restore(w,{format:'walked-backup-v3',visited:{'14212':{first:'2000-01-01',last:'2001-01-01',source:'手動'}},cards:{retired:{at:'1999-01-01'}},titles:{awards:{},selected:null}});
 const before=read(w);search(w,'町田');mode(w,true);action(w).click();assert.equal(action(w).textContent,'解除');
 const registered=read(w);assert.equal(Object.keys(registered.visited).length,2);assert.deepEqual(registered.visited['14212'],before.visited['14212']);assert.deepEqual(registered.cards,before.cards);
 const backup=JSON.parse(JSON.stringify(registered));await restore(w,backup);assert.deepEqual(read(w).visited,registered.visited);
 w.confirm=()=>false;action(w).click();assert.deepEqual(read(w).visited,registered.visited);
 w.confirm=()=>{mode(w,false);return true};mode(w,true);action(w).click();assert.deepEqual(read(w).visited,registered.visited);assert.equal(action(w),null);
 mode(w,true);w.confirm=()=>true;action(w).click();const removed=read(w);assert.deepEqual(removed.visited,before.visited);assert.deepEqual(removed.cards,registered.cards);assert.deepEqual(removed.titles,registered.titles);
 const keys=['walked_municipal_v2','walked_sengoku_cards_v1','walked_titles_v1'];const next=await app(Object.fromEntries(keys.map(k=>[k,w.localStorage.getItem(k)])));assert.deepEqual(read(next).visited,removed.visited);assert.deepEqual(read(next).cards,removed.cards);w.close();next.close();
});
test('mode-specific candidates replace stale results and old edit callback cannot mutate a new mode',async()=>{
 const w=await app();search(w,'町田');mode(w,true);const stale=action(w).onclick;const before=raw(w);
 w.eval("changeMode('municipal')");assert.equal(w.document.querySelector('#results .map-search-name').textContent,'町田市');stale();assert.deepEqual(raw(w),before);
 search(w,'神奈川県');assert.ok(w.document.querySelectorAll('#results .item').length<=40);
 w.eval("state.prefFeatures=[{type:'Feature',id:'13',properties:{name:'東京都'},geometry:{type:'Polygon',coordinates:[]}}];changeMode('prefecture')");search(w,'東京都');assert.equal(action(w),null);assert.equal(w.document.querySelector('#results .map-search-name').textContent,'東京都');
 w.eval("state.nationById.set('n:13209:999',{type:'Feature',properties:{WALKED_MUNICIPAL_CODE:'13209',KEY_CODE:'999',S_NAME:'詳細テスト'},geometry:{type:'Polygon',coordinates:[]}});changeMode('nationwideDetail')");assert.equal(w.document.querySelectorAll('#results .item').length,0);search(w,'詳細テスト');assert.equal(w.document.querySelector('#results .map-search-name').textContent,'詳細テスト');
 w.eval("changeMode('nearby')");assert.equal(w.document.querySelectorAll('#results .item').length,0);search(w,'');assert.match(w.document.getElementById('results').textContent,/検索すると/);assert.deepEqual(raw(w),before);w.close();
});

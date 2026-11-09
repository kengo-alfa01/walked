const {test}=require('node:test'),assert=require('node:assert/strict');
const {app,read,restore,raw}=require('./support/app.cjs');
const keys=['walked_municipal_v2','walked_sengoku_cards_v1','walked_titles_v1'];
const ownedCount=visits=>require('../regional-core.js').view(require('../regional/catalog.json'),visits,require('../data/title-registry.json')).items.length;
test('real app starts regional module, restores v3 and reloads old town visits without changing cards or dates',async()=>{
 const w=await app();await new Promise(r=>setTimeout(r,20));w.document.querySelector('#regionalPanel button').click();assert.match(w.document.querySelector('#regionalPanel [data-status]').textContent,/0項目/);
 const doc={format:'walked-backup-v3',visited:{'n:14111:14111001':{first:'2000-01-01'}},cards:{retired:{at:'1999-01-01'}},titles:{awards:{},selected:null}};
 await restore(w,doc);assert.match(w.document.querySelector('#regionalPanel [data-status]').textContent,new RegExp(ownedCount(doc.visited)+'項目'));const b=read(w);assert.equal(b.cards.retired.at,'1999-01-01');assert.equal(b.visited['n:14111:14111001'].first,'2000-01-01');
 const next=await app(Object.fromEntries(keys.map(k=>[k,w.localStorage.getItem(k)])));await new Promise(r=>setTimeout(r,20));assert.match(next.document.querySelector('#regionalPanel [data-status]').textContent,new RegExp(ownedCount(doc.visited)+'項目'));assert.deepEqual(read(next).cards,b.cards);w.close();next.close();
});
test('unsaved in-memory visit and quota failure cannot reveal regional articles',async()=>{
 const w=await app();await new Promise(r=>setTimeout(r,20));w.eval("state.visited={'14212':{}};window.regionEncyclopedia.refresh()");assert.match(w.document.querySelector('#regionalPanel [data-status]').textContent,/0項目/);
 const original=w.Storage.prototype.setItem;w.Storage.prototype.setItem=function(k,v){if(k==='walked_municipal_v2')throw Error('quota');return original.call(this,k,v)};
 assert.throws(()=>w.eval('persist()'),/quota/);assert.match(w.document.querySelector('#regionalPanel [data-status]').textContent,/0項目/);w.close();
});

test('regional map tap opens an unlocked, source-linked popup; Sengoku tap never switches modes',async()=>{
 const w=await app({walked_municipal_v2:{'13209':{first:'2021-01-01',last:'2021-01-01',source:'検証'}}});
 try{
  const before=raw(w);
  assert.equal(w.eval("window.regionEncyclopedia.previewArea('13209').status"),'open');
  assert.equal(w.eval("window.regionEncyclopedia.previewArea('12221').status"),'locked');
  assert.equal(w.eval("window.regionEncyclopedia.previewArea('12221').items"),undefined,
   'unvisited regional content must not be exposed');
  w.eval("changeMode('municipal')");
  w.eval("handleMapAreaClick(state.features.find(f=>key(f)==='13209'),'municipal',{lat:35.55,lng:139.4})");
  const bubble=w.eval('map._activePopup.content');
  assert.match(bubble.textContent,/地域図鑑：町田市/);
  assert.match(bubble.textContent,/薬師池公園/);
  assert.match(bubble.textContent,/まちだシルクメロン/);
  assert.ok(bubble.querySelectorAll('article').length>=2);
  assert.equal(w.eval('activeCollectionMode'),'regional');
  assert.equal(w.document.getElementById('regionalPanel').hidden,false);
  w.eval("handleMapAreaClick(state.features.find(f=>key(f)==='12221'),'municipal',{lat:35.5,lng:139.2})");
  const locked=w.eval('map._activePopup.content');
  assert.match(locked.textContent,/未制覇/);
  assert.equal(locked.textContent.includes('八千代'),true);
  assert.equal(locked.textContent.includes('八千代市の名物'),false);
  assert.equal(locked.querySelectorAll('article').length,0);
  w.eval("selectCollectionMode('sengoku')");
  assert.equal(w.eval('map._activePopup'),null);
  w.eval("handleMapAreaClick(state.features.find(f=>key(f)==='13209'),'municipal',{lat:35.55,lng:139.4})");
  assert.equal(w.eval('activeCollectionMode'),'sengoku');
  assert.equal(w.document.getElementById('regionalPanel').hidden,true);
  assert.equal(w.eval('map._activePopup'),null,'Sengoku taps must not open a regional popup');
  assert.deepEqual(raw(w),before,'reading map popups must not alter visits, titles or cards');
 }finally{w.close()}
});

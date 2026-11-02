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

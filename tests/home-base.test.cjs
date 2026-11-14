const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../walked-core.js');
const registry=require('../data/title-registry.json');
const blank=()=>({awards:{},selected:null});

test('47 prefectures: one valid municipality counts as a conquered prefecture; duplicates stay one',()=>{
 const visited={'13209':{},'13101':{},'m:1320900101':{},'n:13209:1320900101':{},'14151':{},'p:13':{},'99999':{}};
 assert.deepEqual(C.dashboard('prefecture',visited,registry,null),{total:47,count:2});
 assert.deepEqual(C.dashboard('prefecture',{'13209':{},'n:13209:1320900101':{}},registry,null),{total:47,count:1});
 assert.deepEqual(C.dashboard('prefecture',{},registry,null),{total:47,count:0});
});

test('home prefecture municipality metric is based on the complete 1892-area registry, independent of map viewport',()=>{
 const visited={'13209':{},'13101':{},'14151':{},'n:13209:1320900101':{}};
 assert.deepEqual(C.dashboard('municipal',visited,registry,'13209'),{total:62,count:2});
 const kanagawa=registry.areas.filter(a=>a.prefecture==='14');
 assert.deepEqual(C.dashboard('municipal',visited,registry,'14151'),{total:kanagawa.length,count:1});
 assert.equal(C.dashboard('municipal',visited,registry,null),null);
 assert.equal(C.dashboard('municipal',visited,registry,'99999'),null);
 assert.equal(C.validHomeBase('13209',registry),true);
 assert.equal(C.validHomeBase('99999',registry),false);
});

test('nationwide detail uses all home-municipality town IDs, never the current on-screen subset',()=>{
 const full=['m:1320900101','m:1320900102','m:1320900103','m:1320900103','n:13209:1320900101'];
 const viewport=['m:1320900101'];
 const visited={'n:13209:1320900101':{},'m:1320900103':{},'13209':{},'14151':{}};
 assert.deepEqual(C.dashboard('nationwideDetail',visited,registry,'13209',full),{total:3,count:2});
 assert.deepEqual(C.dashboard('nationwideDetail',visited,registry,'13209',viewport),{total:1,count:1});
 assert.equal(C.dashboard('nationwideDetail',visited,registry,'13209',null),null,'pending full-boundary request is not zero');
 assert.throws(()=>C.dashboard('nationwideDetail',visited,registry,'13209',['n:14151:1415100101']),/境界/);
 assert.throws(()=>C.townStats(['n:13209:'],visited,['13209']),/境界/);
});

test('nearby totals combine Machida plus three Sagamihara wards without double counting aliased town IDs',()=>{
 const ids=['m:1320900101','s:1415100101','s:1415200101','s:1415300101','n:13209:1320900101'];
 const visited={'m:1320900101':{},'n:14151:1415100101':{},'14152':{}};
 assert.deepEqual(C.dashboard('nearby',visited,registry,null,null,ids),{total:4,count:2});
 assert.equal(C.dashboard('nearby',visited,registry,null,null,null),null);
});

test('v4 includes the preference without changing v3 records or v2 compatibility',()=>{
 const visited={'13209':{first:'2020-01-01'}},cards={'legacy-id':{at:'2020-02-01'}},titles=blank();
 const v4=C.backupWithHomeBase(visited,cards,titles,'13209','2026-11-14T00:00:00Z');
 assert.equal(v4.format,'walked-backup-v4');assert.equal(v4.homeBase,'13209');
 const decoded=C.parseBackup(JSON.parse(JSON.stringify(v4)));
 assert.equal(decoded.homeBase,'13209');assert.equal(decoded.hasHomeBase,true);
 for(const field of ['visited','cards','titles'])assert.deepEqual(decoded[field],v4[field]);
 assert.equal(C.backup(visited,cards,titles).format,'walked-backup-v3');
 const old=C.parseBackup(C.backup(visited,cards,titles));assert.equal(old.hasHomeBase,false);
 assert.equal(C.parseBackup({format:'walked-backup-v2',visited:{}}).hasHomeBase,false);
 assert.deepEqual(visited,{'13209':{first:'2020-01-01'}},'v4 export cannot mutate source');
});

test('invalid home-base values and incomplete or malformed v4 snapshots fail closed',()=>{
 for(const value of [13209,'13','999999','abcde',{},[],undefined]){
  assert.throws(()=>C.backupWithHomeBase({},{},blank(),value));
 }
 for(const doc of [
  {format:'walked-backup-v4',visited:{},cards:{},titles:blank()},
  {format:'walked-backup-v4',visited:{},cards:{},titles:blank(),homeBase:13209},
  {format:'walked-backup-v4',visited:{},cards:[],titles:blank(),homeBase:'13209'}
 ])assert.throws(()=>C.parseBackup(doc));
 assert.equal(C.parseBackup(C.backupWithHomeBase({},{},blank(),null)).homeBase,null);
});

test('four-key backup restore rolls back visits, cards, titles and home base on quota failure',()=>{
 for(let failAt=1;failAt<=5;failAt++){
  const map=new Map([['visits','old-visits'],['cards','old-cards'],['titles','old-titles'],['home','"13209"']]);
  let writes=0;
  const storage={getItem:k=>map.has(k)?map.get(k):null,setItem(k,v){if(++writes===failAt)throw Error('quota');map.set(k,v);},removeItem:k=>map.delete(k)};
  assert.throws(()=>C.transaction(storage,{visits:'new-visits',cards:'new-cards',titles:'new-titles',home:'"14151"'},'journal'));
  assert.equal(storage.getItem('visits'),'old-visits');
  assert.equal(storage.getItem('cards'),'old-cards');
  assert.equal(storage.getItem('titles'),'old-titles');
  assert.equal(storage.getItem('home'),'"13209"');
  assert.equal(storage.getItem('journal'),null);
 }
});

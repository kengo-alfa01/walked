const {test}=require('node:test'),assert=require('node:assert/strict');
const {app,read,restore,raw}=require('./support/app.cjs');
const registry=require('../data/title-registry.json');
const sleep=()=>new Promise(resolve=>setTimeout(resolve,15));
const homeKey='walked_home_base_v1';
const seed={walked_municipal_v2:{'13209':{first:'2020-01-01',last:'2020-01-01',source:'手動'},'n:13209:1320900101':{}},walked_sengoku_cards_v1:{'old-card':{at:'2019-01-01'}},walked_titles_v1:{awards:{'old-title':{acquiredAt:'2019-01-01'}},selected:null}};

test('home base picker persists alone, mode order matches spec, and mode changes leave all three game stores unchanged',async()=>{
 const w=await app(seed);
 try{
  const order=[...w.document.querySelectorAll('.filter')].map(x=>x.dataset.mode);
  assert.deepEqual(order,['prefecture','municipal','nationwideDetail','nearby']);
  const before=raw(w);
  assert.equal(w.document.getElementById('areaAddIndicator').hidden,true);
  w.document.getElementById('areaAddMode').click();
  assert.equal(w.document.getElementById('areaAddIndicator').hidden,false);
  w.document.getElementById('areaAddMode').click();
  assert.equal(w.document.getElementById('areaAddIndicator').hidden,true);
  const pref=w.document.getElementById('homePrefecture'),area=w.document.getElementById('homeMunicipality');
  pref.value='13';pref.onchange();area.value='13209';
  w.document.getElementById('saveHomeBase').click();
  assert.equal(w.localStorage.getItem(homeKey),'"13209"');
  assert.deepEqual(raw(w),before,'setting home base must not modify visits/cards/titles');
  w.eval("changeMode('municipal')");
  assert.equal(w.document.getElementById('cnt').textContent,'62');
  assert.equal(w.document.getElementById('pref').textContent,'1');
  w.eval("changeMode('prefecture')");
  assert.equal(w.document.getElementById('cnt').textContent,'47');
  assert.equal(w.document.getElementById('pref').textContent,'1');
  assert.deepEqual(raw(w),before);
 }finally{w.close();}
});

test('nationwide metric loads the entire home municipality, independent from viewport cache; near mode requires both cities',async()=>{
 const w=await app(seed);
 try{
  w.document.getElementById('homePrefecture').value='13';w.document.getElementById('homePrefecture').onchange();
  w.document.getElementById('homeMunicipality').value='13209';w.document.getElementById('saveHomeBase').click();
  w.eval("changeMode('nationwideDetail')");
  for(let i=0;i<40&&w.eval('homeTownSnapshot.status')!=='ready';i++)await sleep();
  assert.equal(w.eval('homeTownSnapshot.status'),'ready');
  const total=w.eval('homeTownSnapshot.ids.length');
  const unique=w.eval('new Set(homeTownSnapshot.ids).size');
  assert.ok(total>=unique);
  assert.equal(w.document.getElementById('cnt').textContent,String(unique),'full home boundary denominator');
  assert.equal(w.eval('homeTownSnapshot.ids.every(id=>WalkedCore.municipality(id)==="13209")'),true);
  w.eval("changeMode('nearby')");
  const expected=w.eval("new Set(regionalFeatures().map(f=>keyForMode(f,'nearby'))).size");
  assert.equal(w.document.getElementById('cnt').textContent,String(expected));
  assert.equal(w.document.getElementById('dashboardContext').textContent.includes('全区域'),true);
 }finally{w.close();}
});

test('old backups keep current home base; v4 offers explicit keep/replace, and clear-visits retains it',async()=>{
 const w=await app(seed);
 try{
  w.document.getElementById('homePrefecture').value='13';w.document.getElementById('homePrefecture').onchange();
  w.document.getElementById('homeMunicipality').value='13209';w.document.getElementById('saveHomeBase').click();
  const before=read(w),v3={format:'walked-backup-v3',visited:{},cards:{},titles:{awards:{},selected:null}};
  await restore(w,v3);assert.equal(w.localStorage.getItem(homeKey),'"13209"');
  const v4={...v3,format:'walked-backup-v4',homeBase:'14151'};
  let confirms=0;w.confirm=()=>++confirms===1;await restore(w,v4);
  assert.equal(w.localStorage.getItem(homeKey),'"13209"','Cancel in preference prompt means keep, not abort prior merge');
  w.confirm=()=>true;await restore(w,v4);
  assert.equal(w.localStorage.getItem(homeKey),'"14151"');
  assert.equal(w.eval('homeBaseCode'),'14151');
  for(const field of ['cards','titles'])assert.deepEqual(read(w)[field],before[field]);
  w.document.getElementById('clear').click();
  assert.equal(w.localStorage.getItem(homeKey),'"14151"','clear visits never clears preference');
  assert.deepEqual(read(w).visited,{});
 }finally{w.close();}
});

test('invalid home base in v4 and a partial storage failure leave records and preferences untouched',async()=>{
 const w=await app(seed);
 try{
  const base={format:'walked-backup-v4',visited:{'14151':{}},cards:{},titles:{awards:{},selected:null}};
  const before=raw(w);
  await restore(w,{...base,homeBase:'99999'});
  assert.deepEqual(raw(w),before);
  assert.equal(w.localStorage.getItem(homeKey),null);
  assert.match(w.document.getElementById('status').textContent,/復元できません/);
  const original=w.Storage.prototype.setItem;let failed=false;
  w.Storage.prototype.setItem=function(k,v){if(k===homeKey&&!failed){failed=true;throw Error('quota')}return original.call(this,k,v)};
  await restore(w,{...base,homeBase:'13209'});
  w.Storage.prototype.setItem=original;
  assert.deepEqual(raw(w),before);
  assert.equal(w.localStorage.getItem(homeKey),null);
  assert.equal(w.localStorage.getItem('walked_restore_journal_v1'),null);
  assert.ok(read(w).cards['old-card']);
 }finally{w.close();}
});

test('layout keeps actual operation controls between search and usage sections',async()=>{
 const w=await app();
 try{
  const main=w.document.querySelector('main'),html=main.innerHTML;
  const search=html.indexOf('地図で地域を探す'),record=html.indexOf('aria-label="記録操作"'),usage=html.indexOf('記録・使い方');
  assert.ok(search>=0&&record>search&&usage>record);
  for(const id of ['jsonFile','locate','save','restore','restoreFile'])assert.equal(w.document.querySelectorAll('#'+id).length,1);
  assert.ok(w.document.querySelector('#settings #homePrefecture'));
  assert.ok(w.document.querySelector('#settings #homeMunicipality'));
  assert.equal(w.document.getElementById('areaAddIndicator').hidden,true);
 }finally{w.close();}
});

test('historical card simulator is removed from settings without altering stored visits/cards/titles',async()=>{
 const w=await app(seed);
 try{
  const before=raw(w),settings=w.document.getElementById('settings');
  assert.equal(settings.querySelector('.test-panel'),null);
  for(const id of ['testSite','runSengokuTest','testSengokuResult'])assert.equal(w.document.getElementById(id),null,id);
  assert.equal(settings.textContent.includes('歴史カードの動作テスト'),false);
  for(const id of ['beforeRestore','rescueStorage','clear','homePrefecture','homeMunicipality'])assert.ok(w.document.getElementById(id),id+' must be retained');
  assert.deepEqual(raw(w),before);
 }finally{w.close();}
});

test('page pinch is blocked only outside the Leaflet map; map pinch remains available',async()=>{
 const w=await app(seed);
 try{
  const meta=w.document.querySelector('meta[name="viewport"]').content;
  assert.match(meta,/maximum-scale=1/);
  assert.match(meta,/user-scalable=no/);
  const outside=w.document.querySelector('.title-profile'),map=w.document.getElementById('map');
  const pinch=(target,type,withTouches=false)=>{
   const ev=new w.Event(type,{bubbles:true,cancelable:true});
   if(withTouches)Object.defineProperty(ev,'touches',{value:[{},{}]});
   target.dispatchEvent(ev);return ev.defaultPrevented;
  };
  assert.equal(pinch(outside,'gesturestart'),true);
  assert.equal(pinch(outside,'gesturechange'),true);
  assert.equal(pinch(outside,'touchmove',true),true);
  assert.equal(pinch(map,'gesturestart'),false);
  assert.equal(pinch(map,'gesturechange'),false);
  assert.equal(pinch(map,'touchmove',true),false);
  const oneFinger=new w.Event('touchmove',{bubbles:true,cancelable:true});
  Object.defineProperty(oneFinger,'touches',{value:[{}]});
  outside.dispatchEvent(oneFinger);
  assert.equal(oneFinger.defaultPrevented,false,'ordinary page scrolling remains enabled');
 }finally{w.close();}
});

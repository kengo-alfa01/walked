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

test('municipalities render as compact wrapping tiles with a bounded list',async()=>{
 const w=await app();
 const box=w.document.getElementById('results');
 assert.ok(box.classList.contains('map-search-tiles'));
 const towns=pickPref(w,'13');
 assert.ok(towns.length>20);
 assert.ok(towns.every(tile=>tile.classList.contains('map-search-tile')));
 assert.ok(towns.every(tile=>tile.querySelector('.map-search-name')));
 assert.ok(towns.every(tile=>tile.querySelector('[data-area-action]')===null),'view-only tiles must not offer edit');
 const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
 assert.match(html,/#results\.map-search-tiles\{display:flex;flex-wrap:wrap;/);
 assert.match(html,/#results\.map-search-tiles \.map-search-tile\{display:inline-flex;flex:0 1 auto;width:fit-content;max-width:100%;/);
 assert.match(html,/max-height:min\(42dvh,320px\);overflow-y:auto/);
 mode(w,true);
 const tile=choice(w,'町田市').parentElement;
 assert.ok(tile.classList.contains('map-search-tile'));
 assert.equal(tile.querySelector('[data-area-action]').textContent,'登録');
 assert.equal(tile.querySelectorAll('button').length,2);
 const before=raw(w);mode(w,false);
 assert.deepEqual(raw(w),before,'switching modes must not mutate visits or cards');
 w.close();
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



test('unvisited map areas use a single pale grey across all modes; visited retain colors',async()=>{
 const w=await app(),nearbyId=w.eval("keyForMode(state.machida[0],'nearby')");
 const style=(id,mode)=>w.eval(`styleFor(${JSON.stringify(id)},${JSON.stringify(mode)})`);
 const cases=[
  [nearbyId,'nearby'],['13209','municipal'],['p:13','prefecture'],
  ['n:13209:0000000000','nationwideDetail']
 ];
 for(const [id,mode] of cases){
  const unvisited=style(id,mode);
  assert.equal(unvisited.fillColor,'#e5e7eb',mode+' should not inherit a six-color tint');
  assert.equal(unvisited.fillOpacity,0.74);
 }
 w.eval(`mark(${JSON.stringify(nearbyId)})`);
 assert.notEqual(style(nearbyId,'nearby').fillColor,'#e5e7eb','visited town should show its municipality palette color');
 assert.notEqual(style('p:13','prefecture').fillColor,'#e5e7eb','visited town should color its prefecture');
 assert.equal(style('13209','municipal').fillColor,'#e5e7eb','town visit alone does not mark the municipality');
 w.eval("mark('13209')");
 assert.notEqual(style('13209','municipal').fillColor,'#e5e7eb','registered municipality should show its palette color');
 assert.equal(style('14151','municipal').fillColor,'#e5e7eb','another unvisited city stays grey');
 const selected=w.eval("selectedMapRegion={mode:'municipal',id:'14151'};styleFor('14151','municipal')");
 assert.equal(selected.fillColor,'#e5e7eb','selection must not recolor unvisited areas');
 assert.equal(selected.weight,3,'selected border remains visible');
 w.close();
});


test('municipal mode groups visited cities by prefecture while national detail retains municipal colors',async()=>{
 const w=await app();
 w.eval("prefecturePalette=MapColoring.assign(['13','14','19'],[[1,2],[0,2],[0,1]])");
 w.eval("state.visited['13209']={};state.visited['13101']={};state.visited['14151']={};state.visited['m:1320900101']={};state.visited['n:13101:1310100101']={}");
 const color=(id,mode)=>w.eval(`styleFor(${JSON.stringify(id)},${JSON.stringify(mode)}).fillColor`);
 const prefColor=p=>w.eval(`MapColoring.PALETTE[prefecturePalette.colors.get(${JSON.stringify(p)})].hex`);
 const municipalColor=m=>w.eval(`MapColoring.PALETTE[municipalPalette.colors.get(${JSON.stringify(m)})].hex`);
 assert.equal(color('13209','municipal'),prefColor('13'));
 assert.equal(color('13101','municipal'),prefColor('13'),'different Tokyo municipalities share one color');
 assert.equal(color('14151','municipal'),prefColor('14'));
 assert.notEqual(color('13209','municipal'),color('14151','municipal'),'neighboring prefectures differ');
 assert.equal(color('13210','municipal'),'#e5e7eb','unvisited areas remain grey even within a visited prefecture');
 assert.equal(color('p:13','prefecture'),prefColor('13'),'prefecture layer matches municipal grouping');
 assert.equal(color('n:13209:1320900101','nationwideDetail'),municipalColor('13209'));
 assert.equal(color('n:13101:1310100101','nationwideDetail'),municipalColor('13101'));
 assert.equal(color('m:1320900101','nearby'),municipalColor('13209'));
 assert.equal(w.eval("colorInfoFor('13209','municipal').kind"),'pref');
 assert.equal(w.eval("colorInfoFor('n:13209:1320900101','nationwideDetail').kind"),'municipal');
 w.close();
});

test('region colors, basemap selection, and manual override preserve saved game state',async()=>{
 const w=await app();
 w.eval("prefecturePalette=MapColoring.assign(['13','14','19'],[[1,2],[0,2],[0,1]]);state.prefById.set('p:13',{id:'13',properties:{name:'東京都'}})");
 const colorsOk=w.eval('municipalPalette.colors.size===1905&&[...municipalPalette.neighbors].every(([id,ns])=>[...ns].every(n=>municipalPalette.colors.get(n)!==municipalPalette.colors.get(id)))');
 assert.equal(colorsOk,true,'all adjacent municipalities receive different colors');
 assert.equal(w.document.getElementById('mapBaseMode').value,'pale');
 const before=raw(w);
 const background=w.document.getElementById('mapBaseMode');background.value='blank';
 background.dispatchEvent(new w.Event('change'));
 assert.equal(JSON.parse(w.localStorage.getItem('walked_map_display_v1')).base,'blank');
 assert.deepEqual(raw(w),before,'basemap switching may not touch visits or cards');
 pickPref(w,'13');choice(w,'町田市').click();
 assert.equal(w.eval('state.mode'),'municipal');
 const selected=w.eval('styleFor("13209")');
 assert.equal(selected.weight,3,'selected municipality must have a stronger border');
 const checkbox=w.document.getElementById('manualMapColors');
 checkbox.checked=true;checkbox.dispatchEvent(new w.Event('change'));
 const colorSelect=w.document.getElementById('mapRegionColor');
 assert.equal(colorSelect.disabled,false);
 assert.equal(w.document.getElementById('selectedMapRegion').textContent,'東京都（都道府県単位）');
 const options=[...colorSelect.options].filter(o=>o.value!=='auto'&&!o.disabled);
 assert.ok(options.length>0);
 colorSelect.value=options[0].value;colorSelect.dispatchEvent(new w.Event('change'));
 assert.equal(JSON.parse(w.localStorage.getItem('walked_map_display_v1')).overrides.pref['13'],Number(options[0].value));
 assert.equal(JSON.parse(w.localStorage.getItem('walked_map_display_v1')).overrides.municipal['13209'],undefined,'municipal mode no longer stores a city-level override');
 assert.deepEqual(raw(w),before,'color customization may not change game records');
 const config=w.localStorage.getItem('walked_map_display_v1');
 w.close();
 const next=await app({'walked_map_display_v1':config});
 assert.equal(next.document.getElementById('mapBaseMode').value,'blank');
 assert.equal(JSON.parse(next.localStorage.getItem('walked_map_display_v1')).overrides.pref['13'],Number(options[0].value));
 next.close();
});

test('tapping a municipality opens a locked or acquired map popup without switching panels',async()=>{
 const w=await app();
 await new Promise(r=>setTimeout(r,20));
 w.eval("handleMapAreaClick(state.featureById.get('13209'),'municipal',{lat:35.55,lng:139.4})");
 assert.match(w.eval('map._activePopup.content.textContent'),/未制覇/);
 assert.equal(w.document.querySelector('#regionalPanel [data-item-id]'),null,'unvisited users must not see regional content');
 w.eval("mark('13209');persist()");
 const before=raw(w);
 w.eval("handleMapAreaClick(state.featureById.get('13209'),'municipal',{lat:35.55,lng:139.4})");
 for(let n=0;n<50&&!w.eval("map._activePopup.content.querySelector('article')");n++){
  await new Promise(r=>setTimeout(r,25));
  w.eval("handleMapAreaClick(state.featureById.get('13209'),'municipal',{lat:35.55,lng:139.4})");
 }
 assert.match(w.eval('map._activePopup.content.textContent'),/薬師池公園/);
 assert.equal(w.document.getElementById('regionalPanel').hidden,false);
 assert.equal(w.document.querySelector('#regionalPanel [data-item-id]'),null,'map preview should not force full encyclopedia panel');
 assert.deepEqual(raw(w),before,'view-only map taps cannot alter saved collections');
 mode(w,true);
 // Switch to the clicked layer first. A stale municipality callback from nearby
 // mode does not represent a user-reachable editing path.
 w.eval("changeMode('municipal')");
 w.eval("handleMapAreaClick(state.featureById.get('14151'),'municipal')");
 assert.ok(read(w).visited['14151'],'edit mode retains the original map registration behavior');
 w.close();
});

test('regional and Sengoku modes show exactly one panel and do not change saved collection data',async()=>{
 const w=await app();
 await new Promise(r=>setTimeout(r,20));
 const buttons=[...w.document.querySelectorAll('[data-collection-mode]')];
 assert.equal(buttons.length,2);
 assert.equal(w.document.getElementById('regionalPanel').hidden,false);
 assert.equal(w.document.getElementById('sengokuPanel').hidden,true);
 assert.equal(buttons[0].getAttribute('aria-pressed'),'true');
 const before=raw(w);
 buttons[1].click();
 assert.equal(w.document.getElementById('regionalPanel').hidden,true);
 assert.equal(w.document.getElementById('sengokuPanel').hidden,false);
 assert.equal(w.document.getElementById('sengokuBody').hidden,false);
 assert.equal(buttons[1].getAttribute('aria-pressed'),'true');
 assert.equal(buttons[0].getAttribute('aria-pressed'),'false');
 buttons[0].click();
 assert.equal(w.document.getElementById('regionalPanel').hidden,false);
 assert.equal(w.document.getElementById('sengokuPanel').hidden,true);
 assert.equal(buttons[0].getAttribute('aria-pressed'),'true');
 assert.equal(w.document.querySelector('#regionalPanel [data-body]').hidden,false);
 assert.deepEqual(raw(w),before,'UI mode switches must never alter visits, cards or title history');
 w.close();
});

test('map-tapping a municipality in Sengoku mode keeps Sengoku open without regional popup',async()=>{
 const w=await app();
 await new Promise(r=>setTimeout(r,20));
 w.eval("mark('13209');persist()");
 const before=raw(w);
 w.document.querySelector('[data-collection-mode="sengoku"]').click();
 assert.equal(w.document.getElementById('regionalPanel').hidden,true);
 w.eval("handleMapAreaClick(state.featureById.get('13209'),'municipal',{lat:35.55,lng:139.4})");
 assert.equal(w.document.getElementById('regionalPanel').hidden,true);
 assert.equal(w.document.getElementById('sengokuPanel').hidden,false);
 assert.equal(w.eval('activeCollectionMode'),'sengoku');
 assert.equal(w.eval('map._activePopup'),null);
 assert.deepEqual(raw(w),before,'map inspection must not change any saved visit');
 w.close();
});


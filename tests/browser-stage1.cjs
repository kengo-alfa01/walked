// Run against a disposable local server, never the user's live saved game.
// WALKED_BROWSER_ASSETS points at cached Leaflet JS/CSS, topojson-client.min.js,
// and municipalities.topojson from the pinned source in data/title-registry.json.
const {chromium,webkit}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const assets=process.env.WALKED_BROWSER_ASSETS;if(!assets)throw Error('Set WALKED_BROWSER_ASSETS');
const base=process.env.WALKED_TEST_URL||'http://127.0.0.1:8765';
const registry=require('../data/title-registry.json');
const targetCodes=new Set(registry.areas.map(a=>a.code));
const topo=JSON.parse(fs.readFileSync(path.join(assets,'municipalities.topojson')));
assert.deepEqual(topo.objects.municipalities.geometries.map(g=>String(g.id)).filter(c=>targetCodes.has(c)).sort(),[...targetCodes].sort(),'title registry matches pinned map IDs');
const pref=structuredClone(topo),seen=new Set();pref.objects={prefectures:{type:'GeometryCollection',geometries:topo.objects.municipalities.geometries.filter(g=>{const c=g.id.slice(0,2);if(seen.has(c))return false;seen.add(c);return true}).map(g=>({...g,id:g.id.slice(0,2),properties:{name:g.properties.prefecture}}))}};
async function route(context){await context.route('**/*',async r=>{const u=r.request().url();if(u.startsWith(base))return r.continue();
 const file=u.includes('leaflet.js')?'leaflet.js':u.includes('leaflet.css')?'leaflet.css':u.includes('topojson-client')?'topojson-client.min.js':u.includes('municipalities.topojson')?'municipalities.topojson':null;
 if(file)return r.fulfill({path:path.join(assets,file),contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'application/json'});
 if(u.includes('prefectures.topojson'))return r.fulfill({json:pref});
 if(u.includes('/xyz/'))return r.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jrYQAAAAASUVORK5CYII=','base64')});
 return r.abort();});}
async function ready(page){await page.goto(base);await page.waitForFunction(()=>titleRegistry&&state.features.length===1905&&sengokuCards.length>0);await page.waitForFunction(()=>state.machida.length>100&&state.sagamihara.length>90);}
async function upload(page,doc){await page.locator('#restoreFile').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(doc))});}
(async()=>{
 for(const [engine,viewport,label] of [[chromium,{width:1280,height:900},'chromium-desktop'],[webkit,{width:390,height:844},'webkit-mobile']]){
  const browser=await engine.launch({headless:true,...(engine===chromium&&process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),args:engine===chromium?['--no-sandbox']:[]}),context=await browser.newContext({viewport});await route(context);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await ready(page);assert.equal(await page.locator('#profileTitle').textContent(),'称号なし');
  // Legacy regional/national records + existing hidden card survive startup and restore.
  await page.evaluate(()=>{localStorage.setItem('walked_municipal_v2',JSON.stringify({'n:13209:1320900101':{first:'2020-01-01',last:'2020-01-01',source:'タイムライン'},'s:1415100101':{}}));localStorage.setItem('walked_sengoku_cards_v1',JSON.stringify({'retired-card':{at:'2019-01-01',siteId:'retired-site'}}));});
  await ready(page);assert.match(await page.locator('#titleProgress').textContent(),/全国 2 \/ 1892/);assert.equal(await page.locator('#titleToast').isVisible(),true);
  await page.locator('#closeTitleToast').click();await page.locator('#titleToggle').click();await page.locator('#displayTitle').selectOption('national-1');assert.equal(await page.locator('#profileTitle').textContent(),'足軽');
  await ready(page);assert.equal(await page.locator('#profileTitle').textContent(),'足軽');assert.equal(await page.locator('#titleToast').isVisible(),false,'reload does not renotify');
  await page.locator('#titleToggle').click();await page.locator('#titleCategory').selectOption('prefecture');await page.locator('#titlePrefecture').selectOption('14');assert.equal(await page.locator('.title-card').count(),4);
  await page.locator('#titleCategory').selectOption('region');assert.equal(await page.locator('.title-card').count(),16);
  await page.screenshot({path:path.join(assets,label+'.png'),fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'no horizontal overflow');
  const before=await page.evaluate(()=>currentBackup());
  await upload(page,{format:'walked-backup-v2',visited:{'13209':{first:'2018-01-01',last:'2026-10-31',source:'手動'},'14152':{}}});
  await page.waitForFunction(()=>state.visited['14152']);
  let after=await page.evaluate(()=>currentBackup());assert.ok(after.cards['retired-card']);assert.equal(after.titles.selected,'national-1');assert.equal(Object.keys(after.visited).length,4);
  assert.equal(await page.evaluate(()=>WalkedCore.progress(state.visited,titleRegistry).count),3);
  const checkpoint=await page.evaluate(()=>JSON.parse(localStorage.getItem(restoreCheckpointKey)));for(const field of ['visited','cards','titles'])assert.deepEqual(checkpoint[field],before[field]);
  const exportEvent=page.waitForEvent('download');await page.locator('#save').click();const exported=await exportEvent;const exportPath=await exported.path();const exportedDoc=JSON.parse(fs.readFileSync(exportPath));assert.equal(exportedDoc.format,'walked-backup-v3');assert.ok(exportedDoc.cards['retired-card']);
  // Invalid restoration leaves all three stores byte-for-byte untouched.
  const raw=await page.evaluate(()=>[DBKEY,sengokuStoreKey,titleStoreKey].map(k=>localStorage.getItem(k)));
  await upload(page,{format:'walked-backup-v3',visited:{'13201':{}},cards:[],titles:{awards:{},selected:null}});await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('復元できません'));
  assert.deepEqual(await page.evaluate(()=>[DBKEY,sengokuStoreKey,titleStoreKey].map(k=>localStorage.getItem(k))),raw);
  // Storage-full during restoration: rollback and in-memory collections unchanged.
  await page.evaluate(()=>{window.originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='walked_sengoku_cards_v1'&&v.includes('new-card'))throw Error('simulated quota');return window.originalSetItem.call(this,k,v);};});
  await upload(page,{format:'walked-backup-v3',visited:{'13201':{}},cards:{'new-card':{at:'2026-10-31'}},titles:{awards:{},selected:null}});await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('simulated quota'));
  assert.deepEqual(await page.evaluate(()=>[DBKEY,sengokuStoreKey,titleStoreKey].map(k=>localStorage.getItem(k))),raw);assert.equal(await page.evaluate(()=>!!state.visited['13201']),false);
  await page.evaluate(()=>{Storage.prototype.setItem=window.originalSetItem;});
  // Remove visits while keeping previously earned titles and collected cards.
  await page.locator('#settings').evaluate(e=>e.open=true);await page.locator('#clear').click();assert.equal(await page.evaluate(()=>Object.keys(state.visited).length),0);assert.equal(await page.locator('#profileTitle').textContent(),'足軽');assert.ok(await page.evaluate(()=>sengokuFound['retired-card']));
  // New browser restores full v3, including records no longer present in catalogs.
  const fresh=await browser.newContext({viewport});await route(fresh);const p2=await fresh.newPage();p2.on('dialog',d=>d.accept());await ready(p2);await upload(p2,exportedDoc);await p2.waitForFunction(()=>sengokuFound['retired-card']);assert.equal(await p2.locator('#profileTitle').textContent(),'足軽');
  // Corrupt storage is not replaced by {} on startup; recovery export stays available.
  await p2.evaluate(()=>localStorage.setItem('walked_municipal_v2','{broken'));await ready(p2);assert.equal(await p2.evaluate(()=>localStorage.getItem('walked_municipal_v2')),'{broken');assert.equal(await p2.evaluate(()=>lockedStorageKeys.has(DBKEY)),true);
  assert.deepEqual(errors,[],label+' page errors');console.log('PASS '+label+': titles, selection/reload, v2/v3 restore, backup download, invalid/quota rollback, retention, fresh-device restore and corruption guard');
  await browser.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1;});

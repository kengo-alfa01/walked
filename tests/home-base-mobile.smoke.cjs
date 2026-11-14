const {test}=require('node:test'),assert=require('node:assert/strict');
const {webkit}=require('playwright'),path=require('node:path'),fs=require('node:fs');
const root=path.join(__dirname,'..');
const assets=process.env.WALKED_BROWSER_ASSETS||path.join(root,'.qa-assets');
const base=process.env.WALKED_BASE_URL||'http://127.0.0.1:8765';
const screenshotDir=path.join(root,'preview-artifacts');
const gameKeys=['walked_municipal_v2','walked_sengoku_cards_v1','walked_titles_v1'];
fs.mkdirSync(screenshotDir,{recursive:true});

test('iPhone WebKit: home base, dashboard, backup and touch layout (synthetic visits only)',{timeout:150000},async()=>{
 const browser=await webkit.launch({headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true,acceptDownloads:true});
 const page=await context.newPage();
 const errors=[];
 page.on('pageerror',err=>errors.push(err.message));
 context.on('dialog',d=>d.accept());
 await page.route('**/municipalities.topojson',r=>r.fulfill({path:path.join(assets,'municipalities.topojson'),contentType:'application/json'}));
 await page.route('**/topojson-client@3/dist/topojson-client.min.js',r=>r.fulfill({path:path.join(assets,'topojson-client.min.js'),contentType:'application/javascript'}));
 await page.route('**/leaflet@1.9.4/dist/leaflet.js',r=>r.fulfill({path:path.join(root,'node_modules/leaflet/dist/leaflet.js'),contentType:'application/javascript'}));
 await page.route('**/leaflet@1.9.4/dist/leaflet.css',r=>r.fulfill({path:path.join(root,'node_modules/leaflet/dist/leaflet.css'),contentType:'text/css'}));
 await page.route('**/prefectures.topojson',r=>r.abort());
 await page.addInitScript(()=>{
  if(sessionStorage.getItem('homebase-qa'))return;
  sessionStorage.setItem('homebase-qa','1');
  localStorage.setItem('walked_municipal_v2',JSON.stringify({'13209':{first:'2026-01-01',last:'2026-01-01',source:'検証'}}));
  localStorage.setItem('walked_sengoku_cards_v1',JSON.stringify({'kept-card':{at:'2020-01-01'}}));
 });
 try{
  await page.goto(base+'/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof titleRegistry!=='undefined'&&titleRegistry?.areas?.length===1892&&state.machida.length>100&&state.sagamihara.length>90,null,{timeout:65000});
  const before=await page.evaluate(keys=>keys.map(k=>localStorage.getItem(k)),gameKeys);
  const modes=await page.locator('.filters .filter').evaluateAll(nodes=>nodes.map(n=>n.dataset.mode));
  assert.deepEqual(modes,['prefecture','municipal','nationwideDetail','nearby']);
  assert.equal(await page.locator('#areaAddIndicator').isVisible(),false);
  assert.ok((await page.locator('#cnt').innerText()).match(/^\d/),'nearby complete when both local boundaries are ready');
  await page.locator('#settings').evaluate(el=>el.open=true);
  await page.locator('#homePrefecture').selectOption('13');
  await page.locator('#homeMunicipality').selectOption('13209');
  await page.locator('#saveHomeBase').click();
  assert.equal(await page.evaluate(()=>localStorage.getItem('walked_home_base_v1')),'"13209"');
  assert.deepEqual(await page.evaluate(keys=>keys.map(k=>localStorage.getItem(k)),gameKeys),before);
  await page.locator('#areaAddMode').check();
  assert.equal(await page.locator('#areaAddIndicator').isVisible(),true);
  await page.locator('#areaAddMode').uncheck();
  assert.equal(await page.locator('#areaAddIndicator').isVisible(),false);
  await page.locator('#settings').evaluate(el=>el.open=false);

  await page.locator('.filter[data-mode="municipal"]').click();
  await page.waitForFunction(()=>document.getElementById('cnt').textContent==='62',null,{timeout:10000});
  assert.equal(await page.locator('#pref').innerText(),'1');
  assert.match(await page.locator('#dashboardContext').innerText(),/東京都/);
  await page.screenshot({path:path.join(screenshotDir,'homebase-iphone-municipal.png')});
  await page.locator('.filter[data-mode="prefecture"]').click();
  assert.equal(await page.locator('#cnt').innerText(),'47');
  assert.equal(await page.locator('#pref').innerText(),'1');

  await page.locator('.filter[data-mode="nationwideDetail"]').click();
  await page.waitForFunction(()=>homeTownSnapshot.status==='ready',null,{timeout:35000});
  const detail=await page.evaluate(()=>({denominator:+document.getElementById('cnt').textContent.replaceAll(',',''),unique:new Set(homeTownSnapshot.ids).size}));
  assert.equal(detail.denominator,detail.unique);
  assert.ok(detail.denominator>100,'home town full boundary, not a viewport slice');
  assert.deepEqual(await page.evaluate(keys=>keys.map(k=>localStorage.getItem(k)),gameKeys),before);
  const overflow=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth}));
  assert.ok(overflow.document<=overflow.viewport+2,'iPhone horizontal overflow');
  await page.screenshot({path:path.join(screenshotDir,'homebase-iphone-detail.png')});
  await page.locator('#settings').evaluate(el=>el.open=true);
  await page.locator('#homePrefecture').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(screenshotDir,'homebase-iphone-settings.png')});
  await page.locator('#settings').evaluate(el=>el.open=false);
  await page.locator('#restore').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(screenshotDir,'homebase-iphone-record-controls.png')});

  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#save').click()]);
  const backup=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
  assert.equal(backup.format,'walked-backup-v4');
  assert.equal(backup.homeBase,'13209');
  assert.deepEqual(backup.visited,JSON.parse(before[0]));
  const legacy={format:'walked-backup-v3',visited:{},cards:{},titles:{awards:{},selected:null}};
  await page.locator('#restoreFile').setInputFiles({name:'legacy.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(legacy))});
  await page.waitForFunction(()=>document.getElementById('status').textContent.includes('統合しました'),null,{timeout:12000});
  assert.equal(await page.evaluate(()=>localStorage.getItem('walked_home_base_v1')),'"13209"');
  assert.equal(errors.length,0,'client script errors: '+errors.join(' / '));
 }finally{await context.close();await browser.close();}
});

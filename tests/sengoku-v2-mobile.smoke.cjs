const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {webkit,chromium}=require('playwright');

const root=path.join(__dirname,'..');
const assets=process.env.WALKED_BROWSER_ASSETS||path.join(root,'.qa-assets');
const base=process.env.WALKED_BASE_URL||'http://127.0.0.1:8765';
const oldId='sg-card-legacy-for-qa';
const old={at:'2000-01-01',siteId:'sg-site-odawara'};

test('iPhone-like WebKit viewport: approved v2 biography, privacy, and backup download/restore', {timeout:120000},async()=>{
 const browser=await webkit.launch({headless:true});
 let context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true,acceptDownloads:true});
 let page=await context.newPage();
 context.on('dialog',dialog=>dialog.accept());
 const asset=name=>path.join(assets,name);
 async function routes(page){
 await page.route('**/municipalities.topojson',route=>route.fulfill({path:asset('municipalities.topojson'),contentType:'application/json'}));
 await page.route('**/topojson-client@3/dist/topojson-client.min.js',route=>route.fulfill({path:asset('topojson-client.min.js'),contentType:'application/javascript'}));
 await page.route('**/leaflet@1.9.4/dist/leaflet.js',route=>route.fulfill({path:path.join(root,'node_modules/leaflet/dist/leaflet.js'),contentType:'application/javascript'}));
 await page.route('**/leaflet@1.9.4/dist/leaflet.css',route=>route.fulfill({path:path.join(root,'node_modules/leaflet/dist/leaflet.css'),contentType:'text/css'}));
 await page.route('**/prefectures.topojson',route=>route.abort());
 }
 await routes(page);
 await page.addInitScript(({oldId,old})=>{
   if(sessionStorage.getItem('qa-seeded')==='1')return;
   sessionStorage.setItem('qa-seeded','1');
   localStorage.setItem('walked_municipal_v2',JSON.stringify({'25201':{first:'2022-01-02',last:'2022-01-02',source:'検証'}}));
   localStorage.setItem('walked_sengoku_cards_v1',JSON.stringify({[oldId]:old}));
 },{oldId,old});
 try{
   const errors=[];
   page.on('pageerror',error=>errors.push('pageerror: '+error.message));
   page.on('requestfailed',request=>errors.push('requestfailed: '+request.url()+' '+request.failure()?.errorText));
   await page.goto(base+'/index.html',{waitUntil:'domcontentloaded'});
   try{
     await page.waitForFunction(()=>document.getElementById('sengokuQuality')?.textContent.includes('公開人物 3人／承認経歴 108件'),null,{timeout:20000});
   }catch(error){
     const diagnostic=await page.evaluate(()=>({
       location:location.href,ready:document.readyState,
       quality:document.getElementById('sengokuQuality')?.textContent,
       status:document.getElementById('status')?.textContent,
       root:!!window.SengokuV2,leaflet:!!window.L,topojson:!!window.topojson,
       inlineText:document.getElementById('sengokuCount')?.textContent
     }));
     console.error('FIRST STARTUP WEBKIT DIAGNOSTIC',JSON.stringify({diagnostic,errors:errors.slice(-15)}));
     throw error;
   }
   await page.locator('[data-collection-mode="sengoku"]').click();
   const pins=await page.evaluate(()=>sengokuPins.getLayers().map(marker=>({
     name:marker.getPopup().getContent().querySelector('h3')?.textContent,
     point:[marker.getLatLng().lat,marker.getLatLng().lng],
     color:marker.options.fillColor,popup:marker.getPopup().getContent().textContent
   })));
   assert.equal(pins.length,46,'all 46 site pins must be present even when histories are locked');
   const pane=await page.evaluate(()=>({z:getComputedStyle(map.getPane('sengoku-pins')).zIndex,overlay:getComputedStyle(map.getPane('overlayPane')).zIndex,renderer:sengokuPins.getLayers()[0]?.options.renderer?.options.pane}));
   assert.equal(pane.z,'625','historic pins must be in a high pane');
   assert.ok(Number(pane.z)>Number(pane.overlay),'pins must overlay administrative polygons');
   assert.equal(pane.renderer,'sengoku-pins','pins must not use administrative Canvas renderer');
   assert.equal(new Set(pins.map(p=>p.name)).size,46);
   assert.equal(pins.filter(p=>p.color==='#21864e').length,43);
   assert.deepEqual(pins.filter(p=>p.color==='#edb42d').map(p=>p.name).sort(),['岐阜城跡','安土城跡','姫路城跡'].sort());
   assert.ok(pins.every(p=>p.popup.includes('現地の案内に従ってください。')));
   assert.equal(await page.locator('#showUnknownPins').count(),0);
   await page.evaluate(()=>{
     const marker=sengokuPins.getLayers().find(m=>m.getPopup().getContent().textContent.includes('岐阜城跡'));
     marker.fire('click');
   });
   assert.match(await page.locator('.leaflet-popup-content').innerText(),/一部立入制限.*史跡現地/s);
   await page.locator('.sengoku-person').filter({hasText:'織田信長'}).click();
   const narrative=page.locator('.sengoku-v2-narrative');
   await narrative.waitFor();
   assert.match(await narrative.innerText(),/尾張から勢力を広げた戦国大名/);
   assert.match(await narrative.innerText(),/比叡山延暦寺/);
   assert.ok(!(await narrative.innerText()).includes('1534年、織田信長は尾張の武将・織田信秀の子として生まれた。'),'locked biography should not be prematurely visible');
   assert.equal(await page.locator('.sengoku-profile').count(),0);
   const size=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));
   assert.ok(size.scrollWidth<=size.width+2,'horizontal overflow '+size.scrollWidth+' > '+size.width);
   const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#save').click()]);
   const temp=await download.path();
   const snapshot=JSON.parse(fs.readFileSync(temp,'utf8'));
   assert.equal(snapshot.format,'walked-backup-v3');
   assert.ok(snapshot.cards['sg2hist-nobu-1571-enryakuji']);
   assert.deepEqual(snapshot.cards[oldId],old);
   assert.ok(snapshot.visited['25201']);
   // Restore into a new, genuinely empty WebKit browser context (not a reload
   // that might accidentally reuse in-memory app state or storage).
   await context.close();
   context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true,acceptDownloads:true});
   page=await context.newPage();context.on('dialog',dialog=>dialog.accept());
   await routes(page);
   await page.goto(base+'/index.html',{waitUntil:'domcontentloaded'});
   try {
     await page.waitForFunction(()=>document.getElementById('sengokuQuality')?.textContent.includes('公開人物 3人／承認経歴 108件'),null,{timeout:20000});
   }catch(error){
     const diagnostic=await page.evaluate(()=>({url:location.href,ready:document.readyState,quality:document.getElementById('sengokuQuality')?.textContent,status:document.getElementById('status')?.textContent,core:!!window.SengokuV2}));
     console.error('Empty-context reload diagnostics',diagnostic);throw error;
   }
   const resetCount=await page.evaluate(()=>Object.keys(JSON.parse(localStorage.getItem('walked_sengoku_cards_v1')||'{}')).length);
   assert.equal(resetCount,0,'test must restore from truly empty storage');
   await page.setInputFiles('#restoreFile',{name:'walked-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(snapshot))});
   await page.waitForFunction(id=>{
     const cards=JSON.parse(localStorage.getItem('walked_sengoku_cards_v1')||'{}');
     return Boolean(cards[id]&&cards['sg2hist-nobu-1571-enryakuji']);
   },oldId,{timeout:15000});
   const back=await page.evaluate(()=>({
     visited:JSON.parse(localStorage.getItem('walked_municipal_v2')||'{}'),
     cards:JSON.parse(localStorage.getItem('walked_sengoku_cards_v1')||'{}'),
     checkpoint:localStorage.getItem('walked_before_restore_v1')
   }));
   assert.deepEqual(back.cards[oldId],old);
   assert.ok(back.visited['25201']);assert.ok(back.checkpoint);
   console.log('PASS: WebKit mobile viewport, v2 unlock, privacy, backup UI and restore',JSON.stringify(size));
 }finally{
   await context.close();
   await browser.close();
 }
});

test('PC desktop Chromium viewport: 46 pins, access categories, deduplication and popup UI',{timeout:120000},async()=>{
 const browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:1366,height:850},deviceScaleFactor:1});
 const page=await context.newPage();
 async function routes(){
  await page.route('**/municipalities.topojson',route=>route.fulfill({path:path.join(assets,'municipalities.topojson'),contentType:'application/json'}));
  await page.route('**/topojson-client@3/dist/topojson-client.min.js',route=>route.fulfill({path:path.join(assets,'topojson-client.min.js'),contentType:'application/javascript'}));
  await page.route('**/leaflet@1.9.4/dist/leaflet.js',route=>route.fulfill({path:path.join(root,'node_modules/leaflet/dist/leaflet.js'),contentType:'application/javascript'}));
  await page.route('**/leaflet@1.9.4/dist/leaflet.css',route=>route.fulfill({path:path.join(root,'node_modules/leaflet/dist/leaflet.css'),contentType:'text/css'}));
  await page.route('**/prefectures.topojson',route=>route.abort());
 }
 try{
  await routes();await page.goto(base+'/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.getElementById('sengokuQuality')?.textContent.includes('公開人物 3人／承認経歴 108件'),null,{timeout:20000});
  await page.locator('[data-collection-mode="sengoku"]').click();
  const values=await page.evaluate(()=>sengokuPins.getLayers().map(m=>({
   site:m.getPopup().getContent().querySelector('h3')?.textContent,color:m.options.fillColor,
   point:[m.getLatLng().lat,m.getLatLng().lng],
   popup:m.getPopup().getContent().textContent
  })));
  assert.equal(values.length,46);assert.equal(new Set(values.map(v=>v.site)).size,46);
  assert.equal(values.filter(v=>v.color==='#21864e').length,43);
  assert.equal(values.filter(v=>v.color==='#edb42d').length,3);
  assert.ok(values.find(v=>v.site==='姫路城跡')?.popup.includes('保存修理'));
  assert.ok(values.find(v=>v.site==='安土城跡')?.popup.includes('三重塔'));
  assert.ok(values.find(v=>v.site==='岐阜城跡')?.popup.includes('一部立入制限'));
  await page.evaluate(()=>{sengokuPins.getLayers().find(m=>m.getPopup().getContent().textContent.includes('姫路城跡')).fire('click');});
  assert.match(await page.locator('.leaflet-popup-content').innerText(),/姫路城跡/);
  const size=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));
  assert.ok(size.scrollWidth<=size.width+2,'desktop horizontal overflow');
  assert.equal(await page.locator('#showUnknownPins').count(),0);
  console.log('PASS: Chromium desktop 46 unique public pins, yellow labels, safe popup',JSON.stringify(size));
 }finally{await context.close();await browser.close();}
});

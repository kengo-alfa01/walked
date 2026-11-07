const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {webkit}=require('playwright');

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
   await page.goto(base+'/index.html',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>document.getElementById('sengokuQuality')?.textContent.includes('戦国v2承認済み紹介・通史3人'),null,{timeout:30000});
   await page.locator('[data-collection-mode="sengoku"]').click();
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
     await page.waitForFunction(()=>document.getElementById('sengokuQuality')?.textContent.includes('戦国v2承認済み紹介・通史3人'),null,{timeout:20000});
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

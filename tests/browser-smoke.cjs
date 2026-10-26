/* Optional WebKit rendering test. Run against a local python http.server.
   PLAYWRIGHT_MODULE can point to the installed package. Vendor fixtures are
   exact copies of the three version-pinned URLs in index.html, fetched separately.
   Tiles and national boundaries are isolated to keep this test repeatable.
*/
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const {spawn}=require('node:child_process');
const server=spawn('python',['-m','http.server','8765','--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});
(async()=>{
 const launch={headless:true};
 if(process.env.WALKED_WEBKIT_EXECUTABLE){const w=path.dirname(path.dirname(process.env.WALKED_WEBKIT_EXECUTABLE));launch.executablePath=process.env.WALKED_WEBKIT_EXECUTABLE;launch.env={...process.env,LD_LIBRARY_PATH:(process.env.WALKED_BROWSER_LIBS||'')+':'+w+'/lib:'+w+'/sys/lib',WEBKIT_EXEC_PATH:w+'/bin',WEBKIT_INJECTED_BUNDLE_PATH:w+'/lib',WEBKIT_INSPECTOR_RESOURCES_PATH:w+'/share'};}
 for(let i=0;i<50;i++){try{await fetch('http://127.0.0.1:8765/');break}catch{await new Promise(r=>setTimeout(r,100))}}
 const browser=await webkit.launch(launch);const results=[];let failures=[];
 try{
 for(const [label,width,ua] of [['small',320,null],['iPhone-SE-width',375,null],['iPhone16-Safari-like',393,null],['iPhone16-Chrome-UA',393,'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.134 Mobile/15E148 Safari/604.1'],['large-phone',430,null]]){
  const context=await browser.newContext({viewport:{width,height:852},isMobile:true,hasTouch:true,deviceScaleFactor:1,...(ua?{userAgent:ua}:{})});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const u=route.request().url();if(u.startsWith('http://127.0.0.1:8765/'))return route.continue();
   const vendor=process.env.WALKED_VENDOR_DIR;
   if(vendor){const file=u.includes('leaflet.js')?'leaflet.js':u.includes('leaflet.css')?'leaflet.css':u.includes('topojson-client.min.js')?'topojson.js':null;if(file)return route.fulfill({path:path.join(vendor,file),contentType:file.endsWith('.css')?'text/css':'application/javascript'});}
   if(u.includes('municipalities.topojson')||u.includes('prefectures.topojson'))return route.fulfill({json:{type:'Topology',objects:{empty:{type:'GeometryCollection',geometries:[]}},arcs:[]}});
   if(/\.(png|gif|jpg)(\?|$)/.test(u))return route.fulfill({body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6rBkAAAAASUVORK5CYII=','base64'),contentType:'image/png'});
   return route.abort();
  });
  const liveVisited={'m:existing':{at:'2026-01-01',source:'existing'}},liveFound={'sg-card-0001':{at:'2026-01-01',siteId:'sg-site-odawara'}};
  await page.addInitScript(({v,f})=>{localStorage.setItem('walked_municipal_v2',JSON.stringify(v));localStorage.setItem('walked_sengoku_cards_v1',JSON.stringify(f))},{v:liveVisited,f:liveFound});
  await page.goto('http://127.0.0.1:8765/migration/preview.html',{waitUntil:'networkidle'});await page.waitForFunction(()=>document.getElementById('sengokuCount').textContent.includes('612'));
  await page.locator('#sengokuToggle').click();assert.equal(await page.locator('#sengokuList .sengoku-person').count(),612);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false);
  await page.locator('#sengokuSearch').fill('真田信繁');assert.equal(await page.locator('#sengokuList .sengoku-person').count(),1);await page.locator('#sengokuList .sengoku-person').click();assert((await page.locator('#sengokuDetail').textContent()).includes('未完了'));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  const acquisition=await page.evaluate(async()=>{
   await loadTownForCode('14206');const site=sengokuSites.find(s=>s.id==='sg-site-odawara');const matched=matchedSengokuCardsAtPoint(site.point);const before=localStorage.getItem('walked_sengoku_cards_v1');const added=acquireSengokuByPoint(site.point,'2026-10-26');const again=acquireSengokuByPoint(site.point,'2026-10-26');return {polygons:state.nationCache.get('14206')?.length||0,matched:matched.ids.length,added,again,liveCardsUnchanged:before===localStorage.getItem('walked_sengoku_cards_v1')};
  });assert(acquisition.polygons>0);assert(acquisition.matched>0);assert(acquisition.added>0);assert.equal(acquisition.again,0);assert(acquisition.liveCardsUnchanged);
  await page.evaluate(()=>{mark('m:preview-test','test','2026-10-26');persist()});
  assert.deepEqual(JSON.parse(await page.evaluate(()=>localStorage.getItem('walked_municipal_v2'))),liveVisited);
  assert.deepEqual(JSON.parse(await page.evaluate(()=>localStorage.getItem('walked_sengoku_cards_v1'))),liveFound);
  await page.locator('#sengokuSearch').fill('');await page.evaluate(()=>document.getElementById('sengokuToast').hidden=true);await page.locator('#sengokuPanel').scrollIntoViewIfNeeded();
  const screenshot='migration/reports/'+label+'.png';await page.screenshot({path:path.join(root,screenshot)});
  assert.deepEqual(errors,[]);results.push({label,width,engine:'Playwright WebKit Linux; not iOS',renderedPeople:612,horizontalOverflow:overflow,aliasSearch:'pass',acquisition,liveStorageUnchanged:true,pageErrors:errors,screenshot});await context.close();
 }
 }catch(e){failures.push(e.stack);throw e}finally{fs.writeFileSync(path.join(root,'migration/reports/browser-smoke.json'),JSON.stringify({results,failures,realDeviceTested:false,nationalBoundaryAndTiles:'isolated fixtures; bundled town polygons and all candidate JSONs real'},null,2)+'\n');await browser.close();server.kill()}
 console.log(JSON.stringify(results,null,2));
})().catch(e=>{server.kill();console.error(e);process.exit(1)});

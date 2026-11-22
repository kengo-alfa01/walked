'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {webkit,chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const base=process.env.WALKED_BASE_URL||'http://127.0.0.1:8765';
const before=process.env.WALKED_BEFORE_BASE_URL||'';
const assets=process.env.WALKED_BROWSER_ASSETS||path.join(root,'.qa-assets');
const shots=process.env.WALKED_SCREENSHOT_DIR||path.join(root,'.qa-screenshots');
fs.mkdirSync(shots,{recursive:true});
async function routes(page){
 await page.route('**/municipalities.topojson',r=>r.fulfill({path:path.join(assets,'municipalities.topojson'),contentType:'application/json'}));
 await page.route('**/topojson-client@3/dist/topojson-client.min.js',r=>r.fulfill({path:path.join(assets,'topojson-client.min.js'),contentType:'application/javascript'}));
 await page.route('**/leaflet@1.9.4/dist/leaflet.js',r=>r.fulfill({path:path.join(root,'node_modules/leaflet/dist/leaflet.js'),contentType:'application/javascript'}));
 await page.route('**/leaflet@1.9.4/dist/leaflet.css',r=>r.fulfill({path:path.join(root,'node_modules/leaflet/dist/leaflet.css'),contentType:'text/css'}));
 await page.route('**/prefectures.topojson',r=>r.abort());
}
async function prepare(page,url){
 await routes(page);
 await page.addInitScript(()=>{
  localStorage.setItem('walked_municipal_v2',JSON.stringify({'25201':{first:'2020-01-01',last:'2020-01-01'}}));
  localStorage.setItem('walked_sengoku_cards_v1',JSON.stringify({'sg2hist-nobuyuki-1620-komatsu':{at:'2020-01-02',basis:'saved'}}));
 });
 await page.goto(url+'/index.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>typeof sengokuV2Catalog!=='undefined'&&sengokuV2Catalog?.people?.size===74,null,{timeout:35000});
 await page.locator('[data-collection-mode="sengoku"]').click();
 await page.waitForFunction(()=>sengokuPins.getLayers().length===419,null,{timeout:12000});
}
async function focusPin(page,name){
 await page.evaluate(name=>{
  const s=[...sengokuV2Catalog.sites.values()].find(s=>s.publicPin&&s.name.includes(name));
  if(!s)throw Error('No published '+name);
  const m=sengokuPins.getLayers().find(m=>m.getPopup()?.getContent()?.querySelector('h3')?.textContent===s.name);
  if(!m)throw Error('No marker for '+name);
  map.setView(m.getLatLng(),13,{animate:false});
 },name);
 await page.locator('#map').scrollIntoViewIfNeeded();
 await page.waitForTimeout(380);
 await page.evaluate(name=>{
  map.invalidateSize();
  const m=sengokuPins.getLayers().find(m=>m.getPopup()?.getContent()?.querySelector('h3')?.textContent?.includes(name));
  map.setView(m.getLatLng(),13,{animate:false});
  document.querySelectorAll('[data-qa-focus-pin]').forEach(x=>x.removeAttribute('data-qa-focus-pin'));
  m.getElement()?.setAttribute('data-qa-focus-pin','yes');
 },name);
 await page.waitForFunction(name=>{
  const m=sengokuPins.getLayers().find(m=>m.getPopup()?.getContent()?.querySelector('h3')?.textContent?.includes(name));
  return !!m&&map.getBounds().contains(m.getLatLng())&&m.getElement()?.getAttribute('d')!=='M0 0';
 },name,{timeout:12000});
 const b=await page.locator('[data-qa-focus-pin="yes"]').boundingBox();
 assert.ok(b&&b.width>0&&b.height>0,'map SVG pin not visible: '+name);
 return {x:b.x+b.width/2,y:b.y+b.height/2};
}
async function tap(page,locator,hasTouch){
 const b=await locator.boundingBox();
 assert.ok(b,'target not visible');
 if(hasTouch)await page.touchscreen.tap(b.x+b.width/2,b.y+b.height/2);
 else await locator.click();
}
async function beforeScreenshot(context){
 if(!before)return;
 const page=await context.newPage();
 try{
  await prepare(page,before);
  const p=await focusPin(page,'堀越城跡');
  await page.touchscreen.tap(p.x,p.y);
  await page.waitForTimeout(200);
  const popup=await page.evaluate(()=>map._popup?.getContent()?.textContent||'');
  assert.match(popup,/堀越城跡/);
  await page.screenshot({path:path.join(shots,'before-iphone-horikoshi.png')});
 }finally{await page.close()}
}
function geometry(s){
 const vv=s.vv;
 assert.ok(s.sheet.width<=s.viewportWidth+2,'sheet exceeds viewport horizontally '+JSON.stringify(s));
 assert.ok(s.sheet.left>=-2&&s.sheet.right<=s.viewportWidth+2);
 assert.ok(s.sheet.top>=vv.offsetTop-3,'sheet clipped above visual viewport '+JSON.stringify(s));
 assert.ok(s.sheet.bottom<=vv.offsetTop+vv.height+3,'sheet clipped below visual viewport '+JSON.stringify(s));
 assert.ok(s.sheet.height<=vv.height*.75+4,'sheet taller than 75% visual viewport '+JSON.stringify(s));
 assert.ok(s.closeVisible&&s.titleVisible,'fixed sheet header not visible');
 assert.ok(s.scrollWidth<=s.scrollClientWidth+3,'sheet horizontal overflow');
}
async function sheetGeometry(page){
 return page.evaluate(()=>{
  const sheet=document.querySelector('#sengokuPinSheet .sps-panel'),scroll=document.querySelector('#sengokuPinSheet .sps-scroll');
  const close=document.querySelector('#sengokuPinSheet .sps-close'),title=document.querySelector('#sengokuPinSheet .sps-title');
  const r=sheet.getBoundingClientRect(),body=scroll.getBoundingClientRect(),vv=window.visualViewport;
  const closeRect=close.getBoundingClientRect(),titleRect=title.getBoundingClientRect();
  const rect=b=>({left:b.left,right:b.right,top:b.top,bottom:b.bottom,height:b.height,width:b.width});
  return {viewportWidth:innerWidth,vv:{height:vv?.height||innerHeight,offsetTop:vv?.offsetTop||0},
   sheet:rect(r),scroll:rect(body),scrollHeight:scroll.scrollHeight,scrollClientHeight:scroll.clientHeight,
   scrollWidth:scroll.scrollWidth,scrollClientWidth:scroll.clientWidth,
   closeVisible:closeRect.width>=44&&closeRect.height>=44&&closeRect.top>=r.top&&closeRect.bottom<=r.bottom+2,
   titleVisible:titleRect.top>=r.top-1&&titleRect.bottom<=r.bottom+2};
 });
}
async function currentMap(page){
 return page.evaluate(()=>({lat:map.getCenter().lat,lng:map.getCenter().lng,zoom:map.getZoom(),mode:activeCollectionMode,
  visits:JSON.stringify(state.visited),oldCard:sengokuFound['sg2hist-nobuyuki-1620-komatsu']?.at}));
}
function sameMap(a,b){
 assert.equal(a.zoom,b.zoom,'zoom must be preserved after closing');
 assert.equal(a.mode,b.mode,'display mode must be preserved after closing');
 assert.ok(Math.abs(a.lat-b.lat)<.00001&&Math.abs(a.lng-b.lng)<.00001,'map center must be preserved');
 assert.equal(a.visits,b.visits,'municipality visit records modified');
 assert.equal(a.oldCard,b.oldCard,'existing acquired card modified');
}
const devices=[
 ['iPhone Safari 390',webkit,{viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true},true],
 ['iPhone Chrome 390',chromium,{viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true},true],
 ['Small phone Safari 320',webkit,{viewport:{width:320,height:700},deviceScaleFactor:2,isMobile:true,hasTouch:true},true],
 ['iPhone landscape Safari',webkit,{viewport:{width:844,height:390},deviceScaleFactor:3,isMobile:true,hasTouch:true},true],
 ['Desktop Chromium',chromium,{viewport:{width:1366,height:900},deviceScaleFactor:1,isMobile:false,hasTouch:false},false]
];
for(const [name,type,opts,mobile] of devices){
 test('C bottom sheet: '+name,{timeout:160000},async()=>{
  const browser=await type.launch({headless:true});
  const context=await browser.newContext({...opts});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  try{
   if(name==='iPhone Safari 390')await beforeScreenshot(context);
   await prepare(page,base);
   const catalog=await page.evaluate(()=>({
    publicPins:sengokuPins.getLayers().length,
    halos:sengokuPinHalos.getLayers().length,
    people:sengokuV2Catalog.people.size,histories:sengokuV2Catalog.histories.size,
    site:sengokuV2Catalog.sites.size,
    mobile:mobilePinSheet.isMobile(),storage:sengokuFound['sg2hist-nobuyuki-1620-komatsu']?.at,
    regionalHidden:document.querySelector('#regionalPanel').hidden
   }));
   assert.equal(catalog.publicPins,419);
   assert.equal(catalog.halos,419);
   assert.equal(catalog.people,74);
   assert.equal(catalog.histories,1251);
   assert.equal(catalog.site,436);
   assert.equal(catalog.mobile,mobile);
   assert.equal(catalog.storage,'2020-01-02');
   assert.equal(catalog.regionalHidden,true);
   const initialMap=await currentMap(page);
   const coord=await focusPin(page,'堀越城跡');
   if(mobile)await page.touchscreen.tap(coord.x,coord.y);
   else await page.mouse.click(coord.x,coord.y);
   await page.waitForTimeout(230);
   if(mobile){
    assert.ok(await page.locator('#sengokuPinSheet').isVisible(),'mobile sheet did not open');
    assert.equal(await page.evaluate(()=>!!map._popup?.isOpen()),false,'Leaflet popup opened on mobile');
    const title=await page.locator('#sengokuPinSheetTitle').textContent();
    assert.match(title,/堀越城跡/);
    const content=await page.locator('#sengokuPinSheet .sps-scroll').textContent();
    assert.match(content,/立入制限/,'critical preapproved safety notes lost');
    const metrics=await sheetGeometry(page);geometry(metrics);
    assert.equal(await page.evaluate(()=>document.body.style.position),'fixed','background page must be scroll locked');
    if(name==='iPhone Safari 390')
     await page.screenshot({path:path.join(shots,'after-iphone-horikoshi.png')});
    // The approved Horikoshi text fits on some tall phones; append a test-only
    // long paragraph to verify scrolling without modifying published content.
    if(metrics.scrollHeight<=metrics.scrollClientHeight+30){
     await page.evaluate(()=>{
      const p=document.createElement('p');p.className='qa-only-long-description';
      p.textContent='城跡の長文表示と末尾の閲覧確認。'.repeat(100);
      document.querySelector('#sengokuPinSheet .sengoku-pin-popup').append(p);
     });
    }
    const longMetrics=await sheetGeometry(page);geometry(longMetrics);
    assert.ok(longMetrics.scrollHeight>longMetrics.scrollClientHeight+30,'extreme long detail must scroll internally');
    await page.locator('#sengokuPinSheet .sps-scroll').evaluate(el=>el.scrollTop=el.scrollHeight);
    await page.waitForTimeout(100);
    const bottom=await page.evaluate(()=>{
     const viewport=document.querySelector('#sengokuPinSheet .sps-scroll').getBoundingClientRect();
     const last=document.querySelector('#sengokuPinSheet .sps-scroll .sengoku-pin-popup').lastElementChild.getBoundingClientRect();
     return {scrolled:document.querySelector('#sengokuPinSheet .sps-scroll').scrollTop,
      lastBottom:last.bottom,visibleBottom:viewport.bottom,visibleTop:viewport.top};
    });
    assert.ok(bottom.scrolled>20,'internal scroll did not move');
    assert.ok(bottom.lastBottom<=bottom.visibleBottom+4&&bottom.lastBottom>bottom.visibleTop,'last line not reachable '+JSON.stringify(bottom));
    // Header persists during internal scrolling. Close button uses a real touch.
    const beforeClose=await currentMap(page);
    await tap(page,page.locator('#sengokuPinSheet .sps-close'),true);
    assert.ok(await page.locator('#sengokuPinSheet').isHidden(),'× did not close');
    sameMap(beforeClose,await currentMap(page));
    assert.equal(await page.evaluate(()=>document.body.style.position),'','body remained frozen');
    // Outside-map tap closes sheet without moving or zooming the map.
    await page.evaluate(()=>{
      const site=[...sengokuV2Catalog.sites.values()].find(s=>s.publicPin&&s.name.includes('堀越城跡'));
      mobilePinSheet.open(site);
    });
    const beforeOutside=await currentMap(page);
    const xy=await page.evaluate(()=>{
      const r=document.getElementById('map').getBoundingClientRect();
      const sr=document.querySelector('#sengokuPinSheet .sps-panel').getBoundingClientRect();
      return {x:r.left+20,y:Math.min(r.top+45,sr.top-24)};
    });
    assert.ok(xy.y>=0,'no map region available above sheet');
    await page.touchscreen.tap(xy.x,xy.y);
    await page.waitForTimeout(150);
    assert.ok(await page.locator('#sengokuPinSheet').isHidden(),'outside tap did not dismiss');
    sameMap(beforeOutside,await currentMap(page));
    // Opening a different pin replaces the detail without showing Leaflet popup.
    await page.evaluate(()=>{
      const site=[...sengokuV2Catalog.sites.values()].find(s=>s.publicPin&&s.name.includes('堀越城跡'));
      mobilePinSheet.open(site);
      const m=sengokuPins.getLayers().find(m=>m.getPopup()?.getContent()?.querySelector('h3')?.textContent?.includes('阿蘇神社'));
      if(!m)throw Error('Missing approved Aso marker');
      map.setView(m.getLatLng(),13,{animate:false});
      map.panBy([0,125],{animate:false});
      m.getElement()?.setAttribute('data-qa-next','aso');
    });
    await page.waitForTimeout(120);
    const next=page.locator('[data-qa-next="aso"]');
    const nextRect=await next.boundingBox(),panelRect=await page.locator('#sengokuPinSheet .sps-panel').boundingBox();
    const hit=await page.evaluate(()=>{
     const m=sengokuPins.getLayers().find(m=>m.getPopup()?.getContent()?.querySelector('h3')?.textContent?.includes('阿蘇神社'));
     const el=m.getElement(),r=el?.getBoundingClientRect(),pt=r&&{x:r.left+r.width/2,y:r.top+r.height/2};
     const at=pt&&document.elementFromPoint(pt.x,pt.y);
     return {path:el?.getAttribute('d'),hit:at?.outerHTML?.slice(0,180),same:at===el,
       marker:r&&{x:r.x,y:r.y,w:r.width,h:r.height},map:document.getElementById('map').getBoundingClientRect().toJSON?.(),
       sheet:document.querySelector('#sengokuPinSheet .sps-panel').getBoundingClientRect().toJSON?.()};
    });
    console.log('PIN_SWITCH_HIT_DEBUG',JSON.stringify({name,hit}));
    if(nextRect&&nextRect.y+nextRect.height/2<panelRect.y-5&&nextRect.y+nextRect.height/2>0&&hit.same)
      await page.touchscreen.tap(nextRect.x+nextRect.width/2,nextRect.y+nextRect.height/2);
    else await page.evaluate(()=>{
     const marker=sengokuPins.getLayers().find(m=>m.getPopup()?.getContent()?.querySelector('h3')?.textContent?.includes('阿蘇神社'));
     marker.fire('click');
    });
    assert.match(await page.locator('#sengokuPinSheetTitle').textContent(),/阿蘇神社/,'second pin did not replace active site: '+JSON.stringify(hit));
    const afterSwitch=await page.evaluate(()=>({site:mobilePinSheet.activeSiteId,popup:!!map._popup?.isOpen(),body:document.querySelector('#sengokuPinSheet .sps-scroll').textContent}));
    assert.ok(afterSwitch.site?.includes('aso-shrine')&&!afterSwitch.popup);
    assert.match(afterSwitch.body,/出典・ライセンス帰属/);
    // Real external link tap inside a scrollable sheet.
    const link=page.locator('#sengokuPinSheet .sps-scroll a').first();
    await link.scrollIntoViewIfNeeded();
    const pop=page.waitForEvent('popup',{timeout:12000});
    await tap(page,link,true);
    const opened=await pop;await opened.close();
    // Red, yellow and green use existing approved status and uncollapsed safety information.
    const colors=await page.evaluate(()=>{
      const result={};
      for(const status of ['red','yellow','green']){
       const s=[...sengokuV2Catalog.sites.values()].find(s=>s.publicPin&&SengokuPinDisplay.statusFor(s,SengokuPinApprovedV2)===status);
       mobilePinSheet.open(s);
       result[status]={header:document.getElementById('sengokuPinSheetTitle').textContent,
        note:document.querySelector('#sengokuPinSheet .sps-scroll').textContent,
        riskShown:!document.querySelector('#sengokuPinSheet .sps-risk').hidden};
      }
      return result;
    });
    for(const [status,v] of Object.entries(colors)){
     assert.ok(v.note.includes(status==='red'?'危険・立入制限あり':status==='yellow'?'注意あり':'通常見学可能'),'missing status label '+status);
    }
    assert.ok(colors.red.riskShown&&!colors.green.riskShown&&!colors.yellow.riskShown,'red warning must remain visible');
    const compact=await page.evaluate(()=>{
      const sites=[...sengokuV2Catalog.sites.values()].filter(s=>s.publicPin);
      const shortest=sites.reduce((a,b)=>sengokuPinPopup(a).textContent.length<sengokuPinPopup(b).textContent.length?a:b);
      mobilePinSheet.open(shortest);
      return {name:shortest.name,length:sengokuPinPopup(shortest).textContent.length};
    });
    const shortMetrics=await sheetGeometry(page);geometry(shortMetrics);
    if(shortMetrics.scrollHeight<shortMetrics.scrollClientHeight+2)
     assert.ok(shortMetrics.sheet.height<shortMetrics.vv.height*.75-10,'short content expands to full height');
    if(opts.viewport.width===390&&opts.viewport.height===844){
     await page.setViewportSize({width:844,height:390});
     await page.waitForTimeout(100);
     assert.ok(await page.locator('#sengokuPinSheet').isVisible(),'landscape transition hides sheet');
     geometry(await sheetGeometry(page));
     await page.setViewportSize({width:390,height:844});
     await page.waitForTimeout(100);
     geometry(await sheetGeometry(page));
    }
    // Switching modes dismisses the sheet and restores all pins when returning.
    await page.evaluate(()=>selectCollectionMode('regional'));
    assert.ok(await page.locator('#sengokuPinSheet').isHidden());
    await page.evaluate(()=>selectCollectionMode('sengoku'));
    assert.equal(await page.evaluate(()=>sengokuPins.getLayers().length),419);
    const after=await currentMap(page);
    assert.equal(after.oldCard,initialMap.oldCard);
    assert.equal(after.visits,initialMap.visits);
    console.log('SHEET_MOBILE_PASS',JSON.stringify({name,pins:catalog.publicPins,longScrollable:true,bottomVisible:true,outsideClose:true,
      realLinkTap:true,modeSwitch:true,colors:['red','yellow','green'],screen:opts.viewport,secondPin:afterSwitch.site,short:compact}));
   }else{
    assert.ok(await page.locator('#sengokuPinSheet').isHidden(),'PC sheet must stay hidden');
    assert.ok(await page.locator('.leaflet-popup-content .sengoku-pin-popup').isVisible(),'PC Leaflet popup absent');
    const title=await page.locator('.leaflet-popup-content .sengoku-pin-popup h3').textContent();
    assert.match(title,/堀越城跡/);
    await page.screenshot({path:path.join(shots,'pc-leaflet-horikoshi.png')});
    let metrics=await page.locator('.leaflet-popup-content .sengoku-pin-popup').evaluate(el=>({
      height:el.getBoundingClientRect().height,scrollHeight:el.scrollHeight,clientHeight:el.clientHeight, viewport:innerHeight}));
    assert.ok(metrics.height<=Math.min(metrics.viewport*.65,490)+5,'PC popup unbounded '+JSON.stringify(metrics));
    if(metrics.scrollHeight<=metrics.clientHeight+25){
     await page.locator('.leaflet-popup-content .sengoku-pin-popup').evaluate(el=>{
      const p=document.createElement('p');p.textContent='長いPC史跡表示の限界テスト。'.repeat(110);el.append(p);
     });
     metrics=await page.locator('.leaflet-popup-content .sengoku-pin-popup').evaluate(el=>({
      height:el.getBoundingClientRect().height,scrollHeight:el.scrollHeight,clientHeight:el.clientHeight,viewport:innerHeight}));
    }
    assert.ok(metrics.scrollHeight>metrics.clientHeight+25,'extreme long PC popup must scroll inside itself');
    console.log('SHEET_PC_PASS',JSON.stringify({name,pins:catalog.publicPins,existingLeaflet:true,scroll:metrics}));
   }
   assert.deepEqual(errors,[],'uncaught browser JS errors '+errors.join('; '));
  }finally{await browser.close()}
 });
}

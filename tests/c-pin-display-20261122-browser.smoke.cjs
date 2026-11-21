'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {webkit,chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),base=process.env.WALKED_BASE_URL||'http://127.0.0.1:8765';
const assets=process.env.WALKED_BROWSER_ASSETS||path.join(root,'.qa-assets');
async function routeAssets(page){
 await page.route('**/municipalities.topojson',route=>route.fulfill({path:path.join(assets,'municipalities.topojson'),contentType:'application/json'}));
 await page.route('**/topojson-client@3/dist/topojson-client.min.js',route=>route.fulfill({path:path.join(assets,'topojson-client.min.js'),contentType:'application/javascript'}));
 await page.route('**/leaflet@1.9.4/dist/leaflet.js',route=>route.fulfill({path:path.join(root,'node_modules/leaflet/dist/leaflet.js'),contentType:'application/javascript'}));
 await page.route('**/leaflet@1.9.4/dist/leaflet.css',route=>route.fulfill({path:path.join(root,'node_modules/leaflet/dist/leaflet.css'),contentType:'text/css'}));
 await page.route('**/prefectures.topojson',route=>route.abort());
}
for(const [name,browserType,options] of [
 ['WebKit iPhone touch',webkit,{viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true}],
 ['Chromium PC',chromium,{viewport:{width:1366,height:900},deviceScaleFactor:1,isMobile:false,hasTouch:false}]
]){
 test('C pin-display 20261122: '+name,{timeout:160000},async()=>{
  const browser=await browserType.launch({headless:true});
  const context=await browser.newContext({...options});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await routeAssets(page);
  await page.addInitScript(()=>{
   localStorage.setItem('walked_municipal_v2',JSON.stringify({'25201':{first:'2020-01-01',last:'2020-01-01'}}));
   localStorage.setItem('walked_sengoku_cards_v1',JSON.stringify({'sg2hist-nobu-1534-birth':{at:'2020-01-01',basis:'old-saved'},'sg2hist-nobuyuki-1620-komatsu':{at:'2020-01-02',basis:'old-version'}}));
  });
  try{
   await page.goto(base+'/index.html',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>typeof sengokuV2Catalog!=='undefined'&&sengokuV2Catalog?.people?.size===74&&
    sengokuV2Catalog?.histories?.size===1251,null,{timeout:35000});
   await page.locator('[data-collection-mode="sengoku"]').click();
   const all=await page.evaluate(()=>{
    const seen=sengokuPins.getLayers(),sites=sengokuV2Catalog.sites;
    const published=[...sites.values()].filter(x=>x.publicPin&&Array.isArray(x.point));
    let leaks=0,missing=0,badColors=0;
    for(const [i,marker] of seen.entries()){
     const popup=marker.getPopup()?.getContent(),t=popup?.textContent||'';
     const s=published[i];
     if(!s||!t.includes(s.description))missing++;
     if(t.includes('【③史跡!')||t.includes('【④経歴と史跡の関係】')||t.includes('【出典・利用】'))leaks++;
     if(s&&!t.includes(SengokuPinDisplay.POLICY_LABELS[s.pinReview.accessStatus]))badColors++;
    }
    const u=['https://example.org/1','https://example.org/2','https://example.org/3','https://example.org/4'];
    const links=[];
    for(const n of [0,1,2,4]){
     const el=document.createElement('div');
     const count=SengokuPinDisplay.appendSourceLinks(el,u.slice(0,n),document);
     const anchors=[...el.querySelectorAll('a')];
     const slash=[...el.querySelectorAll('span')].flatMap(x=>[...x.childNodes].filter(node=>node.nodeType===3).map(node=>node.textContent));
     links.push({n,count,hrefs:anchors.map(a=>a.href),slashes:slash,visible:el.textContent,
       tapTarget:anchors.every(a=>a.getAttribute('target')==='_blank')});
    }
    return{
     pins:seen.length,sites:sites.size,people:sengokuV2Catalog.people.size,histories:sengokuV2Catalog.histories.size,
     acquiredOld:sengokuFound['sg2hist-nobuyuki-1620-komatsu']?.at,
     leaked:leaks,missing,badColors,links,
     pageWidth:document.documentElement.scrollWidth,viewport:innerWidth
    };
   });
   assert.equal(all.pins,419);assert.equal(all.sites,436);assert.equal(all.people,74);assert.equal(all.histories,1251);
   assert.equal(all.acquiredOld,'2020-01-02');
   assert.equal(all.leaked,0);assert.equal(all.missing,0);assert.equal(all.badColors,0);
   assert.ok(all.pageWidth<=all.viewport+3,'mobile viewport overflow '+JSON.stringify(all));
   for(const r of all.links){
    assert.equal(r.count,r.n);
    assert.equal(r.slashes.length,Math.max(0,r.n-1));
    assert.ok(r.slashes.every(x=>x===' / '));
    assert.equal(r.visible,Array(r.n).fill('出典を読む').join(' / '));
    assert.ok(r.tapTarget);
   }
   await page.evaluate(()=>{
    const marker=sengokuPins.getLayers().find(x=>x.getPopup()?.getContent()?.textContent?.includes('阿蘇神社'));
    if(!marker)throw Error('阿蘇神社 pin not found');
    map.setView(marker.getLatLng(),13,{animate:false});
   });
   await page.locator('#map').scrollIntoViewIfNeeded();
   await page.waitForTimeout(430);
   // Municipality geometry can finish auto-centering after the catalog appears on desktop.
   // Center AFTER initial async map setup, then verify the SVG was projected onscreen.
   await page.evaluate(()=>{
    map.invalidateSize();
    const marker=sengokuPins.getLayers().find(x=>x.getPopup()?.getContent()?.textContent?.includes('阿蘇神社'));
    map.setView(marker.getLatLng(),13,{animate:false});
   });
   await page.waitForFunction(()=>{
    const m=sengokuPins.getLayers().find(x=>x.getPopup()?.getContent()?.textContent?.includes('阿蘇神社'));
    return map.getBounds().contains(m.getLatLng())&&m.getElement()?.getAttribute('d')!=='M0 0';
   },null,{timeout:6000});
   const center=await page.evaluate(()=>{
    map.invalidateSize();
    const marker=sengokuPins.getLayers().find(x=>x.getPopup()?.getContent()?.textContent?.includes('阿蘇神社'));
    const rect=marker.getElement()?.getBoundingClientRect();
    if(!rect)throw Error('pin SVG not visible');
    return {x:rect.left+rect.width/2,y:rect.top+rect.height/2};
   });

   if(options.hasTouch)await page.touchscreen.tap(center.x,center.y);
   else{
    await page.evaluate(()=>{
     const marker=sengokuPins.getLayers().find(x=>x.getPopup()?.getContent()?.textContent?.includes('阿蘇神社'));
     marker.getElement().setAttribute('data-qa-historic-pin','aso');
    });
    await page.locator('[data-qa-historic-pin="aso"]').click({timeout:7000});
   }
   await page.waitForTimeout(250);
   const popup=await page.evaluate(()=>map._popup?.getContent()?.textContent||'');
   assert.match(popup,/阿蘇神社/);
   assert.match(popup,/歴史/); // approved description
   assert.match(popup,/見学状況/);
   assert.ok(!popup.includes('【③史跡!'));
   assert.ok(!popup.includes('100m接近による獲得判定'));
   // Exercise the actual earned-history card, not only the separator helper.
   const card=await page.evaluate(()=>{
    const h=[...sengokuV2Catalog.histories.values()]
     .find(x=>(x.sourceUrls||[]).filter(SengokuPinDisplay.safeUrl).length>=3);
    if(!h)throw Error('No published 3+ link card was found');
    const expected=h.sourceUrls.filter(SengokuPinDisplay.safeUrl);
    sengokuFound[h.historyId]={at:'2026-11-22T00:00:00Z',basis:'qa-display-only'};
    const person=sengokuPeople.find(p=>p.id===h.personId);
    showSengokuPerson(person);
    const groups=[...document.querySelectorAll('#sengokuDetail .sengoku-source-links')];
    const match=groups.find(g=>{
     const urls=[...g.querySelectorAll('a')].map(a=>a.getAttribute('href'));
     return urls.length===expected.length&&urls.every((x,i)=>x===expected[i]);
    });
    if(!match)throw Error('Real earned-history card did not show the approved source URLs');
    match.setAttribute('data-qa-source-group','selected');
    return {historyId:h.historyId,expected,rendered:match.textContent,
      separators:[...match.childNodes].filter(x=>x.nodeType===3).map(x=>x.textContent)};
   });
   assert.equal(card.rendered,Array(card.expected.length).fill('出典を読む').join(' / '));
   assert.equal(card.separators.length,card.expected.length-1);
   assert.ok(card.separators.every(s=>s===' / '));
   const link=page.locator('[data-qa-source-group="selected"] a').first();
   await link.scrollIntoViewIfNeeded();
   const popEvent=page.waitForEvent('popup',{timeout:12000});
   if(options.hasTouch){
    const bounds=await link.boundingBox();
    if(!bounds)throw Error('iPhone source anchor not visible');
    await page.touchscreen.tap(bounds.x+bounds.width/2,bounds.y+bounds.height/2);
   }else await link.click({timeout:7000});
   const opened=await popEvent;
   await opened.close();
   assert.equal(errors.length,0,'browser errors '+errors.join('; '));
   console.log('PIN_DISPLAY_BROWSER_PASS',JSON.stringify({name,...all,popup:popup.slice(0,260),card:{historyId:card.historyId,links:card.expected.length,realLinkPopup:true}}));
  }finally{await browser.close()}
 });
}

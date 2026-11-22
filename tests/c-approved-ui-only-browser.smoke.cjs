'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {webkit,chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),base=process.env.WALKED_BASE_URL||'http://127.0.0.1:8765',assets=process.env.WALKED_BROWSER_ASSETS||path.join(root,'.qa-assets');
async function assetsRoute(page){
 await page.route('**/municipalities.topojson',route=>route.fulfill({path:path.join(assets,'municipalities.topojson'),contentType:'application/json'}));
 await page.route('**/topojson-client@3/dist/topojson-client.min.js',route=>route.fulfill({path:path.join(assets,'topojson-client.min.js'),contentType:'application/javascript'}));
 await page.route('**/leaflet@1.9.4/dist/leaflet.js',route=>route.fulfill({path:path.join(root,'node_modules/leaflet/dist/leaflet.js'),contentType:'application/javascript'}));
 await page.route('**/leaflet@1.9.4/dist/leaflet.css',route=>route.fulfill({path:path.join(root,'node_modules/leaflet/dist/leaflet.css'),contentType:'text/css'}));
 await page.route('**/prefectures.topojson',route=>route.abort());
}
for(const [name,type,options] of [
 ['WebKit iPhone',webkit,{viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true}],
 ['Chromium PC',chromium,{viewport:{width:1366,height:900},isMobile:false,hasTouch:false}]
]){
 test('C approved technical-only live UI: '+name,{timeout:140000},async()=>{
  const browser=await type.launch({headless:true});
  const context=await browser.newContext({...options});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await assetsRoute(page);
  await page.addInitScript(()=>{
   localStorage.setItem('walked_municipal_v2',JSON.stringify({'25201':{first:'2020-01-01',last:'2020-01-01'}}));
   localStorage.setItem('walked_sengoku_cards_v1',JSON.stringify({'sg2hist-nobuyuki-1620-komatsu':{at:'2020-01-02',basis:'old-version'}}));
  });
  try{
   await page.goto(base+'/index.html',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>typeof sengokuV2Catalog!=='undefined'&&sengokuV2Catalog?.people?.size===74,null,{timeout:35000});
   await page.locator('[data-collection-mode="sengoku"]').click();
   const state=await page.evaluate(()=>{
    const pins=[...sengokuV2Catalog.sites.values()].filter(s=>s.publicPin);
    const sample=pins.find(s=>s.pinReview.restriction&&s.pinReview.accessStatus==='red');
    const popup=sengokuPinPopup(sample).textContent;
    const h=[...sengokuV2Catalog.histories.values()].find(h=>(h.sourceUrls||[]).filter(SengokuSourceLinks.validSourceUrl).length>=3);
    if(!h)throw Error('No published 3-link card');
    sengokuFound[h.historyId]={at:'2026-11-22T00:00:00Z',basis:'qa-only'};
    const person=sengokuPeople.find(p=>p.id===h.personId);
    showSengokuPerson(person);
    const urls=h.sourceUrls.filter(SengokuSourceLinks.validSourceUrl);
    const group=[...document.querySelectorAll('#sengokuDetail .sengoku-source-links')]
      .find(x=>JSON.stringify([...x.querySelectorAll('a')].map(a=>a.getAttribute('href')))===JSON.stringify(urls));
    if(!group)throw Error('Real 3-link card not displayed');
    group.setAttribute('data-qa-approved-links','yes');
    const samples=[0,1,2,4].map(n=>{
     const el=document.createElement('div');
     SengokuSourceLinks.append(el,urls.slice(0,n).concat(Array.from({length:Math.max(0,n-urls.length)},(_,i)=>'https://example.org/'+i)),document);
     return {n,text:el.textContent,slashes:[...el.querySelectorAll('span')].flatMap(x=>[...x.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent))};
    });
    return {pins:pins.length,people:sengokuV2Catalog.people.size,histories:sengokuV2Catalog.histories.size,
      oldCard:sengokuFound['sg2hist-nobuyuki-1620-komatsu']?.at,popupKeepsSafety:popup.includes(sample.pinReview.restriction),
      green:SengokuV2.pinPresentation('green').label,yellow:SengokuV2.pinPresentation('yellow').label,red:SengokuV2.pinPresentation('red').label,
      sourceCount:urls.length,sourceUrls:urls,groupText:group.textContent,samples,
      fullWidth:document.documentElement.scrollWidth,viewport:innerWidth};
   });
   assert.equal(state.pins,419);
   assert.equal(state.people,74);assert.equal(state.histories,1251);
   assert.equal(state.oldCard,'2020-01-02');
   assert.equal(state.popupKeepsSafety,true);
   assert.equal(state.green,'通常見学可能');assert.equal(state.yellow,'注意あり');assert.equal(state.red,'危険・立入制限あり');
   assert.equal(state.groupText,Array(state.sourceCount).fill('出典を読む').join(' / '));
   assert.ok(state.fullWidth<=state.viewport+3);
   for(const s of state.samples){
    assert.equal(s.text,Array(s.n).fill('出典を読む').join(' / '));
    assert.deepEqual(s.slashes,Array(Math.max(0,s.n-1)).fill(' / '));
   }
   const link=page.locator('[data-qa-approved-links="yes"] a').first();
   await link.scrollIntoViewIfNeeded();
   const pop=page.waitForEvent('popup',{timeout:12000});
   if(options.hasTouch){const box=await link.boundingBox();assert.ok(box);await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);}
   else await link.click({timeout:7000});
   const opened=await pop;await opened.close();
   assert.deepEqual(errors,[],'no JS browser errors');
   console.log('SAFE_SOURCE_BROWSER_PASS',JSON.stringify({name,pins:state.pins,sourceCount:state.sourceCount,realLinkClick:true,oldCard:state.oldCard,securityNotesRetained:state.popupKeepsSafety}));
  }finally{await browser.close()}
 });
}

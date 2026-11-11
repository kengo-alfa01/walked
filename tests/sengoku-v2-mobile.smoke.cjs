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

// This creates a *browser-memory-only* preview; it never writes a release JSON or approval.
async function checkSyntheticChronologyScreen(page){
 const before=await page.evaluate(()=>['walked_municipal_v2','walked_sengoku_cards_v1','walked_titles_v1'].map(k=>localStorage.getItem(k)));
 const proof=await page.evaluate(()=>{
  const realView=sengokuChronology.get('sg-6eaf66c3d7c8');
  const person=sengokuPeople.find(p=>p.name==='織田信長');
  if(!person||!countOwned(person.id))throw Error('preview person not acquired');
  const legacy=SengokuChronology.present(approvedHistories(person.id),null);
  const i=legacy.findIndex((h,j)=>legacy[j+1]?.eventYear===h.eventYear);
  if(i<0)throw Error('no same-year preview candidate');
  const idA=legacy[i].historyId,idB=legacy[i+1].historyId;
  const ids=legacy.map(h=>h.historyId);
  [ids[i],ids[i+1]]=[ids[i+1],ids[i]];
  const group=person.id+'|'+legacy[i].eventYear+'|20';
  const previous=sengokuChronology.get(person.id);
  sengokuChronology.set(person.id,{orderIds:ids,tieById:new Map([
   [idB,{group,first:true,size:2}],[idA,{group,first:false,size:2}]
  ])});
  showSengokuPerson(person);
  const root=document.getElementById('sengokuDetail');
  const view={
   count:root.querySelectorAll('.sengoku-era').length,
   ties:root.querySelectorAll('.sengoku-chronology-tie').length,
   notes:root.querySelectorAll('.sengoku-chronology-note').length,
   noteText:root.querySelector('.sengoku-chronology-note')?.textContent,
   firstRowGroup:root.querySelectorAll('.sengoku-era')[i].dataset.tieGroup,
   viewportWidth:innerWidth,documentWidth:document.documentElement.scrollWidth
  };
  if(previous)sengokuChronology.set(person.id,previous);else sengokuChronology.delete(person.id);
  showSengokuPerson(person);
  view.reverted=root.querySelectorAll('.sengoku-chronology-note').length===0;
  return view;
 });
 assert.equal(proof.count,32);
 assert.equal(proof.ties,2);
 assert.equal(proof.notes,1);
 assert.match(proof.noteText,/前後関係は確定していません/);
 assert.match(proof.firstRowGroup,/sg-/);
 assert.equal(proof.reverted,true);
 assert.ok(proof.documentWidth<=proof.viewportWidth+2,'synthetic tied group horizontal overflow');
 const after=await page.evaluate(()=>['walked_municipal_v2','walked_sengoku_cards_v1','walked_titles_v1'].map(k=>localStorage.getItem(k)));
 assert.deepEqual(after,before,'chronology preview must not mutate stored records');
}



async function checkRealApprovedOrder(page){
 await page.waitForFunction(()=>typeof sengokuChronology!=='undefined'&&sengokuChronology.size===3,null,{timeout:20000});
 const orders=await page.evaluate(()=>{
  return [
   ['sg-6eaf66c3d7c8',1570],
   ['sg-f47391608dbb',1582],
   ['sg-a7bb09927601',1615]
  ].map(([id,year])=>
   sengokuChronology.get(id).orderIds.filter(h=>sengokuV2Catalog.histories.get(h).eventYear===year));
 });
 assert.deepEqual(orders[0],['sg2hist-nobu-1570-kanegasaki','sg2hist-nobu-1570-anegawa']);
 assert.deepEqual(orders[1],['sg2hist-hideyoshi-bitchu-siege-1582','sg2hist-hideyoshi-mori-peace-1582',
  'sg2hist-hideyoshi-yamazaki-1582','sg2hist-hideyoshi-taiko-kenchi']);
 assert.deepEqual(orders[2],['sg2hist-ieyasu-1615-summer','sg2hist-ieyasu-1615-buke-law','sg2hist-ieyasu-1615-kinchu-law']);
}

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
   const errors=[],coreScriptRequests=[];
   page.on('request',request=>{
     if(/\/sengoku-v2-core\.js(?:\?|$)/.test(request.url()))coreScriptRequests.push(request.url());
   });
   page.on('pageerror',error=>errors.push('pageerror: '+error.message));
   page.on('requestfailed',request=>errors.push('requestfailed: '+request.url()+' '+request.failure()?.errorText));
   await page.goto(base+'/index.html',{waitUntil:'domcontentloaded'});
   try{
     await page.waitForFunction(()=>document.getElementById('sengokuQuality')?.textContent.includes('公開人物 20人／承認経歴 515件'),null,{timeout:20000});
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
   assert.equal(coreScriptRequests.length,1,'exactly one versioned Sengoku core must be requested');
   assert.match(coreScriptRequests[0],/\/sengoku-v2-core\.js\?v=sengoku234-20261111$/,
     'unversioned cached core is incompatible with 62-pin Sengoku approved-site release data');
   await checkRealApprovedOrder(page);
   const ieyasuVisit=await page.evaluate(()=>{
     const awarded=SengokuV2.award(sengokuV2Catalog,{'13101':{first:'2026-11-10'}},{},[],'2026-11-10');
     const pin=sengokuV2Catalog.sites.get('sg2site-ieyasu-edo');
     return {publicPin:pin.publicPin,access:pin.pinReview.accessStatus,
       entry:!!awarded.records['sg2hist-ieyasu-1590-kanto'],
       rebuild:!!awarded.records['sg2hist-ieyasu-1606-edo-rebuild']};
   });
   assert.deepEqual(ieyasuVisit,{publicPin:true,access:'yellow',entry:true,rebuild:true},
     'visited Chiyoda ward unlocks two Ieyasu histories without requiring GPS pin arrival');
   const hideyoshi=await page.evaluate(()=>{
     const history=sengokuV2Catalog.histories.get('sg2hist-hideyoshi-kyushu-1587');
     const result=SengokuV2.award(sengokuV2Catalog,{'46215':{first:'2026-11-10'}},{},[],'2026-11-10');
     const pin=sengokuV2Catalog.sites.get('sg2site-hideyoshi-taiheiji');
     return {kind:history.kind,approvalRow:history.approval.sheetRow,awarded:!!result.records[history.historyId],
       siteId:result.records[history.historyId]?.siteId,green:pin.pinReview.accessStatus};
   });
   assert.deepEqual(hideyoshi,{kind:'place',approvalRow:1425,awarded:true,siteId:'sg2site-hideyoshi-taiheiji',green:'green'},
     'approved v3 Kyushu history must now be a Sakusen-dai city location card');
  await page.locator('[data-collection-mode="sengoku"]').click();
   const pins=await page.evaluate(()=>sengokuPins.getLayers().map(marker=>({
     name:marker.getPopup().getContent().querySelector('h3')?.textContent,
     point:[marker.getLatLng().lat,marker.getLatLng().lng],
     color:marker.options.fillColor,popup:marker.getPopup().getContent().textContent
   })));
   assert.equal(pins.length,234,'all 234 approved pins must be present even when histories are locked');
   const pane=await page.evaluate(()=>({z:getComputedStyle(map.getPane('sengoku-pins')).zIndex,overlay:getComputedStyle(map.getPane('overlayPane')).zIndex,renderer:sengokuPins.getLayers()[0]?.options.renderer?.options.pane}));
   assert.equal(pane.z,'625','historic pins must be in a high pane');
   assert.ok(Number(pane.z)>Number(pane.overlay),'pins must overlay administrative polygons');
   assert.equal(pane.renderer,'sengoku-pins','pins must not use administrative Canvas renderer');
   assert.equal(new Set(pins.map(p=>p.name)).size,234);
   assert.equal(pins.filter(p=>p.color==='#21864e').length,179);
   assert.equal(pins.filter(p=>p.color==='#edb42d').length,53);
   assert.equal(pins.filter(p=>p.color==='#ca3a3a').length,2);
   assert.ok(pins.some(p=>p.name==='泰平寺（秀吉・島津義久和睦の地）'&&p.color==='#21864e'));
   assert.ok(pins.some(p=>p.name==='比叡山延暦寺（焼き討ち関連）'&&p.color==='#edb42d'));
   assert.ok(pins.some(p=>p.name==='岐阜城跡'&&p.color==='#edb42d'));
   assert.ok(pins.filter(p=>p.color==='#ca3a3a').every(p=>p.popup.includes('立入禁止区域')));
   assert.ok(pins.every(p=>p.popup.includes('現地の案内に従ってください。')));
   assert.equal(await page.locator('#showUnknownPins').count(),0);

   // Real iPhone touch-event regression, not marker.fire('click') in test JavaScript.
   await page.evaluate(()=>{
     const marker=sengokuPins.getLayers().find(m=>
       m.getPopup().getContent().textContent.includes('江戸城跡（家康入府の本拠）'));
     window.__pinTapEvents=[];
     marker.on('click',()=>window.__pinTapEvents.push('marker-click'));
     map.on('click',()=>window.__pinTapEvents.push('map-click'));
     map.on('popupopen',()=>window.__pinTapEvents.push('popup-open'));
     map.on('popupclose',()=>window.__pinTapEvents.push('popup-close'));
     map.setView(marker.getLatLng(),13,{animate:false});
   });
   await page.locator('#map').scrollIntoViewIfNeeded();
   await page.waitForTimeout(300);
   const target=await page.evaluate(()=>{
     const marker=sengokuPins.getLayers().find(m=>
       m.getPopup().getContent().textContent.includes('江戸城跡（家康入府の本拠）'));
     map.invalidateSize();
     const path=marker.getElement(),r=path?.getBoundingClientRect();
     if(!r)throw Error('WebKit cannot get the marker SVG element');
     const x=r.x+r.width/2,y=r.y+r.height/2;
     const top=document.elementFromPoint(x,y);
     path.addEventListener('touchstart',()=>window.__pinTapEvents.push('path-touchstart'));
     path.addEventListener('click',()=>window.__pinTapEvents.push('path-click'));
     return {x,y,width:r.width,height:r.height,tag:top?.tagName,
       topClass:top?.getAttribute('class'),pathClass:path.getAttribute('class'),
       parentPointer:getComputedStyle(map.getPane('sengoku-pins')).pointerEvents,
       pathPointer:getComputedStyle(path).pointerEvents,
       isTopPin:top===path,viewport:[innerWidth,innerHeight]};
   });
   await page.touchscreen.tap(target.x,target.y);
   await page.waitForTimeout(300);
   const tapped=await page.evaluate(()=>({
     open:map._popup?.isOpen()||false,
     popup:map._popup?.getContent()?.textContent?.slice(0,200)||'',
     trace:window.__pinTapEvents,
     popupNodes:document.querySelectorAll('.leaflet-popup-content').length
   }));
   console.log('REAL_WEBKIT_EDO_PIN_TAP_DIAGNOSTIC',JSON.stringify({target,tapped}));
   assert.match(tapped.popup,/江戸城跡/, 'a real iPhone tap must open the Edo Castle popup');
   assert.equal(await page.locator('.map-display-controls').evaluate(e=>getComputedStyle(e).display),'none','mobile Sengoku popup hides map background selector');
   assert.equal(await page.locator('.map-center').evaluate(e=>getComputedStyle(e).display),'none','mobile Sengoku popup hides location button');
   assert.equal(await page.locator('.map-display-controls').evaluate(el=>getComputedStyle(el).display),'none',
     'Sengoku pin popup must hide background selector on iPhone');
   assert.equal(await page.locator('.map-center').evaluate(el=>getComputedStyle(el).display),'none',
     'Sengoku pin popup must hide current location on iPhone');
   assert.ok(target.width<=16,'the visual pin dot must remain small');
   await page.evaluate(()=>{map.closePopup();});
   assert.notEqual(await page.locator('.map-display-controls').evaluate(e=>getComputedStyle(e).display),'none','background selector restored when popup closes');
   assert.notEqual(await page.locator('.map-center').evaluate(e=>getComputedStyle(e).display),'none','location button restored when popup closes');
   await page.waitForTimeout(340);
   const near=await page.evaluate(()=>{
     const marker=sengokuPins.getLayers().find(m=>
       m.getPopup().getContent().textContent.includes('江戸城跡（家康入府の本拠）'));
     const path=marker.getElement(),r=path.getBoundingClientRect();
     const x=r.x+r.width/2+15,y=r.y+r.height/2;
     const hit=document.elementFromPoint(x,y),css=getComputedStyle(path);
     return {x,y,tag:hit?.tagName,isTarget:hit===path,
       mediaCoarse:matchMedia('(pointer:coarse)').matches,
       strokeWidth:css.strokeWidth,stroke:css.stroke,
       pointerEvents:css.pointerEvents,radius:marker.options.radius};
   });
   console.log('REAL_WEBKIT_PIN_15PX_OFFSET_HIT_TEST',JSON.stringify(near));
   assert.equal(near.mediaCoarse,true,'iPhone-like WebKit must be a coarse-pointer device');
   assert.equal(near.radius,7,'the visible dot retains its original size');
   assert.equal(near.isTarget,true,'15px outside tiny dot must hit its transparent touch target');
   await page.touchscreen.tap(near.x,near.y);
   await page.waitForTimeout(260);
   const offCenter=await page.evaluate(()=>({
     open:map._popup?.isOpen()||false,
     name:map._popup?.getContent()?.querySelector('h3')?.textContent||'',
     events:window.__pinTapEvents.slice(-8)
   }));
   console.log('REAL_WEBKIT_EDO_PIN_OFFSET_TAP_RESULT',JSON.stringify(offCenter));
   assert.equal(offCenter.open,true);
   assert.equal(offCenter.name,'江戸城跡（家康入府の本拠）',
     'off-center finger tap must open the correct pin popup');
   await page.evaluate(()=>{map.closePopup();});
   await page.waitForTimeout(350);
   assert.notEqual(await page.locator('.map-display-controls').evaluate(el=>getComputedStyle(el).display),'none',
     'Sengoku popup close must restore background selector');
   assert.notEqual(await page.locator('.map-center').evaluate(el=>getComputedStyle(el).display),'none',
     'Sengoku popup close must restore current location control');

   await page.evaluate(()=>{
     const marker=sengokuPins.getLayers().find(m=>m.getPopup().getContent().textContent.includes('岐阜城跡'));
     marker.fire('click');
   });
   assert.match(await page.locator('.leaflet-popup-content').filter({hasText:'岐阜城跡'}).last().innerText(),/一部立入制限.*史跡現地/s);
   await page.locator('.sengoku-person').filter({hasText:'織田信長'}).click();
   assert.equal(await page.locator('.sengoku-person.is-selected[aria-pressed="true"]').count(),1);
   assert.match(await page.locator('#sengokuSelectedName').innerText(),/織田信長/);
   const glow=await page.evaluate(()=>{
     const pane=map.getPane('sengoku-areas');
     const paths=[...pane.querySelectorAll('path.sengoku-area-pulse')];
     return {z:getComputedStyle(pane).zIndex,pins:getComputedStyle(map.getPane('sengoku-pins')).zIndex,
      count:paths.length,animation:paths[0]?getComputedStyle(paths[0]).animationDuration:null};
   });
   assert.equal(glow.z,'550');
   assert.ok(Number(glow.z)<Number(glow.pins),'area pulse must remain behind historic site pins');
   assert.ok(glow.count===0,'all approved places have pins; no regional placeholder pulse is needed');
   assert.equal(glow.animation,null,'no pulse should exist when all historic sites have approved pins');
   const narrative=page.locator('.sengoku-v2-narrative');
   await narrative.waitFor();
   assert.match(await narrative.innerText(),/尾張から勢力を広げた戦国大名/);
   assert.match(await narrative.innerText(),/比叡山延暦寺/);
   assert.ok(!(await narrative.innerText()).includes('1534年、織田信長は尾張の武将・織田信秀の子として生まれた。'),'locked biography should not be prematurely visible');
   assert.equal(await page.locator('.sengoku-profile').count(),0);
   const cardAppearance=await page.evaluate(()=>{
     const detail=document.getElementById('sengokuDetail');
     const earned=[...detail.querySelectorAll('.sengoku-era-owned')];
     const locked=[...detail.querySelectorAll('.sengoku-era:not(.sengoku-era-owned)')];
     const ownedStyle=earned[0]?getComputedStyle(earned[0]):null;
     const lockedStyle=locked[0]?getComputedStyle(locked[0]):null;
     return {
       earned:earned.length,locked:locked.length,
       status:earned[0]?.querySelector('.sengoku-card-status')?.textContent,
       title:earned[0]?.querySelector('.sengoku-card-title')?.textContent,
       born:locked.find(row=>row.textContent.includes('尾張の織田家に生まれる'))?.textContent,
       bornBadge:locked.find(row=>row.textContent.includes('尾張の織田家に生まれる'))?.querySelector('.sengoku-card-status')?.textContent,
       earnedRightBorder:ownedStyle?parseFloat(ownedStyle.borderRightWidth):0,
       lockedRightBorder:lockedStyle?parseFloat(lockedStyle.borderRightWidth):0
     };
   });
   assert.ok(cardAppearance.earned>0&&cardAppearance.locked>0,'earned and locked histories must both be visible');
   assert.equal(cardAppearance.status,'獲得済み');
   assert.ok(cardAppearance.title?.length>0,'earned card title must be readable');
   assert.ok(cardAppearance.earnedRightBorder>=1,'acquired place with an approved pin must have a full frame');
   assert.equal(cardAppearance.lockedRightBorder,0,'ordinary timeline entry must remain unframed');
   assert.ok(cardAppearance.born?.includes('尾張の織田家に生まれる'),'acquired non-place history must stay readable');
   assert.equal(cardAppearance.bornBadge,undefined,'acquired non-place history must not receive a card badge');
   await checkSyntheticChronologyScreen(page);
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
     await page.waitForFunction(()=>document.getElementById('sengokuQuality')?.textContent.includes('公開人物 20人／承認経歴 515件'),null,{timeout:20000});
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

test('PC desktop Chromium viewport: 234 pins, access categories, deduplication and popup UI',{timeout:120000},async()=>{
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
  await routes();await page.addInitScript(()=>localStorage.setItem('walked_municipal_v2',JSON.stringify({'25201':{first:'2022-01-02',last:'2022-01-02',source:'QA'}})));await page.goto(base+'/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.getElementById('sengokuQuality')?.textContent.includes('公開人物 20人／承認経歴 515件'),null,{timeout:20000});
  await page.locator('[data-collection-mode="sengoku"]').click();
  const values=await page.evaluate(()=>sengokuPins.getLayers().map(m=>({
   site:m.getPopup().getContent().querySelector('h3')?.textContent,color:m.options.fillColor,
   point:[m.getLatLng().lat,m.getLatLng().lng],
   popup:m.getPopup().getContent().textContent
  })));
  assert.equal(values.length,234);assert.equal(new Set(values.map(v=>v.site)).size,234);
  assert.equal(values.filter(v=>v.color==='#21864e').length,179);
  assert.equal(values.filter(v=>v.color==='#edb42d').length,53);
  assert.equal(values.filter(v=>v.color==='#ca3a3a').length,2);
  assert.ok(values.find(v=>v.site==='姫路城跡')?.popup.includes('保存修理'));
  assert.ok(values.find(v=>v.site==='安土城跡')?.popup.includes('三重塔'));
  assert.ok(values.find(v=>v.site==='岐阜城跡')?.popup.includes('一部立入制限'));
  await page.evaluate(()=>{sengokuPins.getLayers().find(m=>m.getPopup().getContent().textContent.includes('姫路城跡')).fire('click');});
  assert.match(await page.locator('.leaflet-popup-content').innerText(),/姫路城跡/);
  assert.equal(await page.locator('.map-display-controls').evaluate(e=>getComputedStyle(e).display),'none');
  assert.equal(await page.locator('.map-center').evaluate(e=>getComputedStyle(e).display),'none');
  await page.evaluate(()=>{map.closePopup();});
  assert.notEqual(await page.locator('.map-display-controls').evaluate(e=>getComputedStyle(e).display),'none');
  assert.notEqual(await page.locator('.map-center').evaluate(e=>getComputedStyle(e).display),'none');

  const size=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));
  assert.ok(size.scrollWidth<=size.width+2,'desktop horizontal overflow');
  assert.equal(await page.locator('#showUnknownPins').count(),0);
  await checkSyntheticChronologyScreen(page);
  console.log('PASS: Chromium desktop 234 unique public pins, yellow labels, safe popup',JSON.stringify(size));
 }finally{await context.close();await browser.close();}
});

test('iPhone WebKit: regional map popup shows unlocked content and Sengoku area taps remain in Sengoku',{timeout:120000},async()=>{
 const browser=await webkit.launch({headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});
 const page=await context.newPage();
 try{
  await page.route('**/municipalities.topojson',route=>route.fulfill({path:path.join(assets,'municipalities.topojson'),contentType:'application/json'}));
  await page.route('**/topojson-client@3/dist/topojson-client.min.js',route=>route.fulfill({path:path.join(assets,'topojson-client.min.js'),contentType:'application/javascript'}));
  await page.route('**/leaflet@1.9.4/dist/leaflet.js',route=>route.fulfill({path:path.join(root,'node_modules/leaflet/dist/leaflet.js'),contentType:'application/javascript'}));
  await page.route('**/leaflet@1.9.4/dist/leaflet.css',route=>route.fulfill({path:path.join(root,'node_modules/leaflet/dist/leaflet.css'),contentType:'text/css'}));
  await page.route('**/prefectures.topojson',route=>route.abort());
  await page.addInitScript(()=>{
   localStorage.setItem('walked_municipal_v2',JSON.stringify({'13209':{first:'2020-01-01',last:'2020-01-01',source:'QA'}}));
  });
  await page.goto(base+'/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.regionEncyclopedia?.previewArea?.('13209')?.status==='open',null,{timeout:20000});
  const before=await page.evaluate(()=>localStorage.getItem('walked_municipal_v2'));
  await page.evaluate(()=>{
   changeMode('municipal');
   const f=state.features.find(f=>key(f)==='13209');
   handleMapAreaClick(f,'municipal',L.latLng(35.55,139.4));
  });
  assert.match(await page.locator('.leaflet-popup-content').innerText(),/地域図鑑：町田市/);
  assert.match(await page.locator('.leaflet-popup-content').innerText(),/薬師池公園/);
  assert.equal(await page.locator('.map-display-controls').evaluate(el=>getComputedStyle(el).display),'none','hide map background selector while regional popup is open');
  assert.equal(await page.locator('.map-center').evaluate(el=>getComputedStyle(el).display),'none','hide current-location control while regional popup is open');
  await page.locator('.leaflet-popup-close-button').dispatchEvent('click'); // stable WebKit popup close without scrolling offscreen
  await page.locator('.leaflet-popup-content .regional-map-popup').waitFor({state:'detached',timeout:2500});
  assert.notEqual(await page.locator('.map-display-controls').evaluate(el=>getComputedStyle(el).display),'none','restore background selector when regional popup closes');
  assert.notEqual(await page.locator('.map-center').evaluate(el=>getComputedStyle(el).display),'none','restore current-location control when regional popup closes');
  await page.evaluate(()=>{
   handleMapAreaClick(state.features.find(f=>key(f)==='13209'),'municipal',L.latLng(35.55,139.4));
  });
  assert.equal(await page.locator('.map-center').evaluate(el=>getComputedStyle(el).display),'none');
  await page.locator('.regional-map-popup .regional-map-detail').first().click();
  assert.equal(await page.locator('#regionalDialog').evaluate(el=>el.open),true);
  await page.locator('#regionalDialog button').first().click();
  await page.locator('[data-collection-mode="sengoku"]').click();
  await page.evaluate(()=>{
   handleMapAreaClick(state.features.find(f=>key(f)==='13209'),'municipal',L.latLng(35.55,139.4));
  });
  assert.equal(await page.evaluate(()=>activeCollectionMode),'sengoku');
  await page.locator('.leaflet-popup-content .regional-map-popup').waitFor({state:'detached',timeout:2500});
  assert.equal(await page.evaluate(()=>map._popup?.isOpen()||false),false,'Sengoku mode must close the regional map popup');
  assert.equal(await page.evaluate(()=>localStorage.getItem('walked_municipal_v2')),before);
  const widths=await page.evaluate(()=>({screen:innerWidth,page:document.documentElement.scrollWidth}));
  assert.ok(widths.page<=widths.screen+2,'regional popup must not cause horizontal overflow');
 }finally{await context.close();await browser.close()}
});

'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {webkit,chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),audit=require('../sengoku/v2/c-20261128-approved-input-audit.json'),delta=require('../sengoku/v2/c-20261128-approved-delta.json');
const candidate='approved-c-20261128-cv3-94.json';
for(const [label,engine,opts] of [
 ['Desktop Chromium',chromium,{viewport:{width:1332,height:717}}],
 ['iPhone WebKit',webkit,{viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:3}]
])test('C v13 actual branch-only browser: '+label,{timeout:180000},async()=>{
 const browser=await engine.launch({headless:true}),ctx=await browser.newContext(opts),page=await ctx.newPage(),errors=[],responses=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.url().includes('/sengoku/v2/approved-c-')||r.url().includes('/sengoku/v2/c-20261128-approved-delta.json'))responses.push({url:r.url(),status:r.status()});});
 await page.route('**/municipalities.topojson',r=>r.fulfill({path:path.join(root,'.qa-assets/municipalities.topojson'),contentType:'application/json'}));
 await page.route('**/topojson-client@3/dist/topojson-client.min.js',r=>r.fulfill({path:path.join(root,'.qa-assets/topojson-client.min.js'),contentType:'application/javascript'}));
 await page.route('**/leaflet@1.9.4/dist/leaflet.js',r=>r.fulfill({path:path.join(root,'node_modules/leaflet/dist/leaflet.js'),contentType:'application/javascript'}));
 await page.route('**/leaflet@1.9.4/dist/leaflet.css',r=>r.fulfill({path:path.join(root,'node_modules/leaflet/dist/leaflet.css'),contentType:'text/css'}));
 await page.route('**/prefectures.topojson',r=>r.abort());
 const oldId='sg2hist-katsuyori-1562-takato',oldRecord={at:'2020-01-01',basis:'approved'};
 await page.addInitScript(({oldId,oldRecord})=>{
  localStorage.setItem('walked_municipal_v2','{}');
  localStorage.setItem('walked_sengoku_cards_v1',JSON.stringify({[oldId]:oldRecord,'sg2hist-hanbei-nagashino-1575':{at:'2020-01-02',basis:'retired'}}));
 },{oldId,oldRecord});
 try{
  await page.goto('http://127.0.0.1:8765/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof sengokuV2Catalog!=='undefined'&&sengokuV2Catalog?.version==='v2-approved-c-20261128-cv3-94',{timeout:60000});
  await page.locator('[data-collection-mode="sengoku"]').click();
  await page.waitForFunction(()=>sengokuPins.getLayers().length===556,{timeout:30000});
  const base=await page.evaluate(({oldId})=>({version:sengokuV2Catalog.version,counts:[sengokuV2Catalog.people.size,sengokuV2Catalog.histories.size,sengokuV2Catalog.sites.size,sengokuPins.getLayers().length,sengokuPinHalos.getLayers().length],old:sengokuFound[oldId],retired:!!sengokuFound['sg2hist-hanbei-nagashino-1575'],related:[...sengokuV2Catalog.sites.values()].filter(s=>s.relatedOnly).length,overflow:document.documentElement.scrollWidth>window.innerWidth+4,quality:document.querySelector('#sengokuQuality').textContent}),{oldId});
  assert.deepEqual(base.counts,[94,1682,594,556,556]);assert.deepEqual(base.old,oldRecord);assert.equal(base.retired,false);assert.equal(base.related,98);assert.equal(base.overflow,false);assert(!base.quality.includes('保留'));
  assert.equal(responses.length,1);assert(responses[0].url.endsWith(candidate));assert.equal(responses[0].status,200);
  const pins=await page.evaluate(ids=>{
   const at=(layer,s)=>Math.abs(layer.getLatLng().lat-s.point[1])<1e-9&&Math.abs(layer.getLatLng().lng-s.point[0])<1e-9;
   return ids.map(id=>{
    const s=sengokuV2Catalog.sites.get(id);
    if(!s.publicPin)return {id,ok:s.point===null&&!s.pinReview&&!s.pinApproval};
    const marker=sengokuPins.getLayers().find(l=>at(l,s)),halo=sengokuPinHalos.getLayers().find(l=>at(l,s));
    return {id,ok:!!marker&&!!halo&&marker.options.fillColor===SengokuV2.pinPresentation(SengokuPinDisplay.statusFor(s,SengokuPinApprovedV2)).fill};
   });
  },delta.sites.map(s=>s.siteId));assert(pins.every(x=>x.ok),JSON.stringify(pins.filter(x=>!x.ok)));
  const shared=await page.evaluate(refs=>{
   const results=[];
   for(const r of refs){selectedSengokuPersonId=r.personId;refreshSengokuPins();const s=sengokuV2Catalog.sites.get(r.recordId);results.push({id:s.siteId,ok:s.approval.sheetRow===r.referenceApprovalRow&&(!s.publicPin||sengokuPins.getLayers().some(l=>Math.abs(l.getLatLng().lat-s.point[1])<1e-9&&Math.abs(l.getLatLng().lng-s.point[0])<1e-9))});}
   selectedSengokuPersonId=null;refreshSengokuPins();return results;
  },audit.references.filter(x=>x.kind==='史跡'));assert.equal(shared.length,10);assert(shared.every(x=>x.ok),JSON.stringify(shared.filter(x=>!x.ok)));
  const grave=await page.evaluate(()=>{
   const id='sg2hist-a-yoshihiro-death1578-20261125',sid='sg2site-satomi-enmeiji',person='sg-17496a5d9dfa';
   const s=sengokuV2Catalog.sites.get(sid),before=!!sengokuFound[id];
   state.visited['12234']={first:'2020-01-01',last:'2020-01-01',source:'QA'};reconcileSengokuVisits();
   const saved=JSON.stringify(sengokuFound[id]);reconcileSengokuVisits();showSengokuPerson({id:person,name:'里見義弘'});
   const frames=[...document.querySelectorAll('#sengokuDetail .sengoku-era-owned')].filter(r=>r.querySelector('.sengoku-card-title')?.textContent===sengokuV2Catalog.histories.get(id).title);
   const halo=sengokuPinHalos.getLayers().find(l=>Math.abs(l.getLatLng().lat-s.point[1])<1e-9&&Math.abs(l.getLatLng().lng-s.point[0])<1e-9);
   return {before,after:!!sengokuFound[id],same:saved===JSON.stringify(sengokuFound[id]),site:sengokuFound[id]?.siteId,frames:frames.length,halo:halo?.options.fillColor,codes:[...sengokuV2Catalog.codes.get(id)]};
  });assert.deepEqual(grave,{before:false,after:true,same:true,site:'sg2site-satomi-enmeiji',frames:1,halo:'#151515',codes:['12234']});
  const target=await page.evaluate(()=>{
   const code='38201',pid='sg-added-kono-michinobu-20261126',birth='sg2hist-a-kono-birth-20261126';
   state.visited[code]={first:'2020-01-01',last:'2020-01-01',source:'QA'};reconcileSengokuVisits();showSengokuPerson({id:pid,name:'河野通宣'});
   const first=document.querySelector('#sengokuDetail .sengoku-era');
   const birthFirst=first?.textContent.includes(sengokuV2Catalog.histories.get(birth).title);
   return {birthFirst,owned:!!sengokuFound[birth],storyLocked:document.querySelector('#sengokuDetail').textContent.includes('全経歴カードを集めると解放されます。')};
  });assert(target.birthFirst&&target.owned&&target.storyLocked,JSON.stringify(target));
  const related=await page.evaluate(rows=>{
   const results=[];
   for(const x of rows){const s=sengokuV2Catalog.sites.get(x.recordId);const code=s.codes[0];state.visited[code]={first:'2020-01-01',last:'2020-01-01',source:'QA'};reconcileSengokuVisits();showSengokuPerson({id:x.personId,name:x.personName});const el=[...document.querySelectorAll('#sengokuDetail [data-site-id]')].filter(e=>e.dataset.siteId===s.siteId);results.push({id:s.siteId,ok:el.length===1&&el[0].textContent.includes('史跡獲得済み')});}
   return results;
  },audit.records.filter(x=>x.row>=4648&&x.row<=4653));assert.equal(related.length,6);assert(related.every(x=>x.ok),JSON.stringify(related.filter(x=>!x.ok)));
  const sheet=await page.evaluate(()=>{
   selectedSengokuPersonId=null;refreshSengokuPins();const s=sengokuV2Catalog.sites.get('sg2site-a-arima-urakami-20261127');const marker=sengokuPins.getLayers().find(l=>Math.abs(l.getLatLng().lat-s.point[1])<1e-9&&Math.abs(l.getLatLng().lng-s.point[0])<1e-9);marker.fire('click');return {text:document.querySelector('#sengokuPinSheet').textContent,overflow:document.documentElement.scrollWidth>window.innerWidth+4,old:sengokuFound['sg2hist-katsuyori-1562-takato']};
  });assert.match(sheet.text,/旧浦上村/);assert.match(sheet.text,/100m接近は不要/);assert.match(sheet.text,/黄/);assert.match(sheet.text,/CODH|歴史地名大系/);assert.equal(sheet.overflow,false);assert.deepEqual(sheet.old,oldRecord);assert.deepEqual(errors,[]);
  console.log('C_V13_BROWSER_PASS',label,JSON.stringify({counts:base.counts,sourceRequests:responses,pinChecks:pins.length,sharedChecks:shared.length,relatedChecks:related.length,grave,target}));
 }finally{await browser.close();}
});

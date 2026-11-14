const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');
const preview=process.env.HOMEBASE_VERCEL_PREVIEW_URL;
if(!preview)throw Error('HOMEBASE_VERCEL_PREVIEW_URL missing');
const errors=[];
async function check(browserType,name){
 const browser=await browserType.launch({headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const page=await context.newPage();
 const requestErrors=[];
 page.on('pageerror',e=>errors.push(name+': '+e.message));
 page.on('requestfailed',r=>requestErrors.push(r.url()+' '+r.failure()?.errorText));
 try{
  const response=await page.goto(preview,{waitUntil:'domcontentloaded',timeout:45000});
  assert.equal(response.status(),200,'HTML must be served');
  await page.waitForFunction(()=>typeof titleRegistry!=='undefined'&&titleRegistry?.areas?.length===1892&&state.features.length>1800&&state.machida.length>100&&state.sagamihara.length>90,null,{timeout:90000});
  assert.equal(await page.locator('title').textContent(),'日本見風録・本拠地検証版');
  assert.deepEqual(await page.locator('.filters button').evaluateAll(a=>a.map(x=>x.dataset.mode)),['prefecture','municipal','nationwideDetail','nearby']);
  await page.locator('#settings').evaluate(el=>el.open=true);
  await page.locator('#homePrefecture').selectOption('13');
  await page.locator('#homeMunicipality').selectOption('13209');
  await page.locator('#saveHomeBase').click();
  assert.equal(await page.evaluate(()=>localStorage.getItem('walked_home_base_v1')),'"13209"');
  await page.locator('#settings').evaluate(el=>el.open=false);
  await page.locator('[data-mode=municipal]').click();
  assert.equal(await page.locator('#cnt').innerText(),'62');
  await page.locator('[data-mode=prefecture]').click();
  assert.equal(await page.locator('#cnt').innerText(),'47');
  await page.locator('[data-mode=nationwideDetail]').click();
  await page.waitForFunction(()=>homeTownSnapshot.status==='ready',null,{timeout:90000});
  assert.equal(await page.evaluate(()=>new Set(homeTownSnapshot.ids).size>100),true);
  const bad=requestErrors.filter(x=>/title-registry|municipalities|machida-boundaries|sagamihara-1415/.test(x));
  assert.deepEqual(bad,[],'Essential map assets must load without error');
  assert.deepEqual(errors,[],'No browser script errors');
  console.log(name+': PAGE_OK=200 MASTER=1892 PREF=47 TOKYO=62 HOME_TOWNS='+await page.evaluate(()=>new Set(homeTownSnapshot.ids).size));
 }catch(e){
  console.error(name+' DEBUG',await page.evaluate(()=>({title:document.title,status:document.getElementById('status')?.textContent,progress:document.getElementById('titleProgress')?.textContent,loadedScripts:[...document.scripts].map(s=>s.src).filter(Boolean).slice(-12)})).catch(()=>({})));
  console.error(name+' NETWORK',requestErrors.slice(-20));
  console.error(name+' ERRORS',errors.slice(-12));
  throw e;
 }finally{await context.close();await browser.close();}
}
test('Vercel public preview boots full game on iPhone Chromium',{timeout:180000},()=>check(chromium,'chromium'));
test('Vercel public preview boots full game on iPhone WebKit',{timeout:180000},()=>check(webkit,'webkit'));

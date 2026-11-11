const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {app,read,restore,raw}=require('./support/app.cjs');
const root=path.join(__dirname,'..');
const approved=JSON.parse(fs.readFileSync(path.join(root,'sengoku/v2/approved-up-to-ujimasa.json'),'utf8'));
const personIds=approved.people.map(p=>p.personId);
const approvedIds=approved.histories.map(h=>h.historyId);
const placeCodes=[...new Set(approved.sites.filter(s=>approved.relations.some(r=>r.siteId===s.siteId)).flatMap(s=>s.municipalityCodes))];
async function mount(initial={}){
 const w=await app(initial);
 for(let i=0;i<100;i++){
  if(w.document.getElementById('sengokuQuality').textContent.includes('公開人物 20人／承認経歴 515件')&&w.eval('sengokuChronology.size===3'))return w;
  await new Promise(r=>setTimeout(r,20));
 }
 const message=w.document.getElementById('sengokuQuality').textContent;
 w.close();throw Error('v2 browser boot failed: '+message);
}
function countV2(w){const cards=read(w).cards;return approvedIds.filter(id=>cards[id]).length;}
function visit(codes){return Object.fromEntries(codes.map(code=>[code,{first:'2021-03-04',last:'2021-03-04',source:'テスト'}]));}
function openSengoku(w,personId){
 w.document.querySelector('[data-collection-mode="sengoku"]').click();
 w.eval('showSengokuPerson(sengokuPeople.find(p=>p.id==='+JSON.stringify(personId)+'))');
 return w.document.getElementById('sengokuDetail');
}
test('v2 JS bridge boots in actual DOM, with no visit awards and no premature 1000字 story',async()=>{
 const w=await mount();try{
  assert.equal(countV2(w),0);
  assert.ok(read(w).cards&&Object.keys(read(w).cards).length===0);
  assert.equal(w.document.getElementById('sengokuPanel').hidden,true);
  assert.equal(w.eval('countOwned('+JSON.stringify(personIds[0])+')'),0);
  assert.ok(w.document.getElementById('sengokuQuality').textContent.includes('承認経歴 515件'));
  assert.match(w.document.getElementById('sengokuQuality').textContent,/史跡 236件／公開ピン 62件（ピン未公開 174件）/);
 }finally{w.close();}
});
test('past Enryakuji 26103 town visit retroactively awards Nobunaga card and nonplace, keeps retired old ID',async()=>{
 const prior={'sg-card-legacy':{at:'2000-01-01',siteId:'old-site'},retired:{at:'1998-01-01'}};
 const w=await mount({walked_municipal_v2:visit(['26103']),walked_sengoku_cards_v1:prior});
 try{
  const b=read(w);
  assert.ok(b.cards['sg2hist-nobu-1571-enryakuji']);
  assert.ok(b.cards['sg2hist-nobu-1534-birth']);
  assert.deepEqual(b.cards['sg-card-legacy'],prior['sg-card-legacy']);
  assert.deepEqual(b.cards.retired,prior.retired);
  const detail=openSengoku(w,personIds[0]);
  assert.ok(detail.querySelector('.sengoku-v2-narrative'));
  assert.ok(detail.textContent.includes('尾張から勢力を広げた戦国大名'));
  assert.ok(detail.textContent.includes('比叡山延暦寺'));
  assert.ok(!detail.textContent.includes(approved.people[0].story.text),'locked biography must not be visible');
  assert.equal(detail.querySelectorAll('.sengoku-v2-narrative .sengoku-era').length,32);
  assert.equal(detail.querySelector('.sengoku-profile'),null,'unapproved old profile must be absent');
 }finally{w.close();}
});
test('all eligible municipalities award 108 v2 histories, 3 complete biographies; hide old text, suppress duplicate notification',async()=>{
 const w=await mount({walked_municipal_v2:visit(placeCodes)});
 try{
  const b=read(w);assert.equal(countV2(w),515);assert.ok(placeCodes.length>=42);
  assert.equal(Object.keys(b.visited).length,placeCodes.length);
  for(const person of approved.people){
   const detail=openSengoku(w,person.personId);
   assert.ok(detail.textContent.includes(person.story.text),person.name+' story remains locked');
   if(person.introduction)assert.ok(detail.textContent.includes(person.introduction.text));
    else assert.ok(detail.textContent.includes('人物紹介は公開最終承認待ちです。'));
   assert.equal(detail.querySelectorAll('.sengoku-era').length,approved.histories.filter(h=>h.personId===person.personId).length);
   assert.equal(detail.querySelector('.sengoku-profile'),null,'legacy profile should not be duplicated');
  }
  const before=raw(w);w.eval('reconcileSengokuVisits()');
  assert.deepEqual(raw(w),before);assert.equal(countV2(w),515);
 }finally{w.close();}
});
test('existing backup-v3 restore UI merges v2 card records and preserves dates, titles, and old cards',async()=>{
 const original={'old-card':{at:'2001-01-01',siteId:'old-site'}};
 const w=await mount({walked_municipal_v2:visit(['25201']),walked_sengoku_cards_v1:original});
 const exportDoc=read(w);assert.ok(exportDoc.cards['sg2hist-nobu-1571-enryakuji']);w.close();
 const recovered=await mount();
 try{
  await restore(recovered,exportDoc);
  const after=read(recovered);
  assert.deepEqual(after.visited,exportDoc.visited);
  assert.deepEqual(after.cards,exportDoc.cards);
  assert.deepEqual(after.cards['old-card'],original['old-card']);
  assert.equal(after.cards['sg2hist-nobu-1571-enryakuji'].at,exportDoc.cards['sg2hist-nobu-1571-enryakuji'].at);
  assert.ok(recovered.localStorage.getItem('walked_before_restore_v1'));
 }finally{recovered.close();}
});
test('legacy location acquisition and regional UI continue to operate under v2 bridge without modifying stored records',async()=>{
 const visits=visit(['25201']);
 const w=await mount({walked_municipal_v2:visits});
 try{
  const before=read(w);
  const regional=w.document.querySelector('[data-collection-mode="regional"]');
  regional.click();assert.equal(w.document.getElementById('regionalPanel').hidden,false);
  assert.deepEqual(read(w).visited,before.visited);
  w.document.querySelector('[data-collection-mode="sengoku"]').click();
  assert.equal(w.document.getElementById('sengokuPanel').hidden,false);
  assert.deepEqual(read(w).visited,before.visited);
 }finally{w.close();}
});
function capturePins(w){
 w.eval(`window.qaV2Markers=[];
 sengokuPins.clearLayers=()=>{window.qaV2Markers.length=0};
 L.circleMarker=(xy,opts)=>{
  const marker={xy:Array.from(xy),opts,popup:null,bindPopup(v){this.popup=v;return this},addTo(){return this}};
  window.qaV2Markers.push(marker);return marker;
 };`);
}
test('62 approved pins are visible without visits and with old unknown-pin setting off or on',async()=>{
 for(const pref of ['false','true']){
  const w=await mount({walked_show_unknown_pins_v1:pref});
  try{
   capturePins(w);
   w.document.querySelector('[data-collection-mode="sengoku"]').click();
   const pins=w.qaV2Markers;
   assert.equal(pins.length,62,'public pins should not depend on acquisition or legacy preference');
   assert.equal(w.eval('sengokuPinPane.style.zIndex'),'625','site markers must be above administrative area fills');
   assert.ok(pins.every(p=>p.opts.renderer?.options?.pane==='sengoku-pins'),'site pins need their own SVG pane');
   assert.equal(new Set(pins.map(p=>p.popup.querySelector('h3').textContent)).size,62);
   assert.equal(read(w).cards&&Object.keys(read(w).cards).length,0);
   assert.equal(w.document.getElementById('showUnknownPins'),null);
   assert.equal(w.localStorage.getItem('walked_show_unknown_pins_v1'),pref,'old preference left untouched');
   const colors=pins.reduce((a,p)=>(a[p.opts.fillColor]=(a[p.opts.fillColor]||0)+1,a),{});
   assert.equal(colors['#21864e'],51);assert.equal(colors['#edb42d'],11);
   assert.equal(Object.keys(colors).length,2);
   const yellow=pins.filter(p=>p.opts.fillColor==='#edb42d').map(p=>p.popup.querySelector('h3').textContent).sort();
   assert.deepEqual(Array.from(yellow),['安土城跡','姫路城跡','岐阜城跡','江戸城跡（家康入府の本拠）',
 '姉川古戦場','比叡山延暦寺（焼き討ち関連）','長島城跡（旧城郭範囲）',
 '賤ヶ岳古戦場','楽田城跡（秀吉の陣）','伏見指月城跡','伏見木幡山城跡'].sort());
   const gifu=pins.find(p=>p.popup.textContent.includes('岐阜城跡'));
   assert.ok(gifu.popup.textContent.includes('一部立入制限'));
   assert.ok(gifu.popup.textContent.includes('立入状況は変わる場合があります。現地の案内に従ってください。'));
   assert.ok(gifu.popup.textContent.includes('改修休館中'));
   assert.ok(gifu.popup.querySelector('a[href^="https://"]'));
   assert.equal(gifu.popup.querySelector('a').getAttribute('target'),'_blank');
  }finally{w.close();}
 }
});

test('selected commander remains visible when all approved sites have pins and no area pulse is needed',async()=>{
 const w=await mount({walked_municipal_v2:visit(['23229','25201','26103','23219','26109'])});
 try{
  const before=raw(w);
  const detail=openSengoku(w,personIds[0]);
  const selected=w.document.querySelector('.sengoku-person.is-selected');
  assert.ok(selected,'selected commander must have a distinct style');
  assert.equal(selected.getAttribute('aria-pressed'),'true');
  assert.match(w.document.getElementById('sengokuSelectedName').textContent,/選択中：織田信長/);
  const codes=JSON.parse(w.eval('JSON.stringify([...unpinnedMunicipalityCodes(selectedSengokuPersonId)].sort())'));
  assert.deepEqual(codes,[],'no city-wide pulse is needed when all 62 sites have a published pin');
  assert.equal(w.eval('sengokuAreaPane.style.zIndex'),'550');
  assert.equal(w.eval('sengokuAreaRenderer.options.pane'),'sengoku-areas');
  assert.doesNotMatch(detail.textContent,/ピンのない史跡の地域を地図で見る/);
  const goto=[...detail.querySelectorAll('button')].find(x=>x.textContent.includes('地図で見る'));
  assert.equal(goto,undefined,'no invisible/pending pin destination is advertised');
  assert.deepEqual(raw(w),before,'person selection and area focus must not modify stored visits or cards');
  const reset=[...detail.querySelectorAll('button')].find(x=>x.textContent.includes('選択を解除'));
  assert.ok(reset);reset.click();
  assert.equal(w.document.querySelector('.sengoku-person.is-selected'),null);
  assert.match(w.document.getElementById('sengokuSelectedName').textContent,/選択中：なし/);
  assert.equal(w.eval('selectedSengokuPersonId'),null);
 }finally{w.close()}
});

test('selected person pins include undiscovered links, one pin per site ID, independent of card history',async()=>{
 const w=await mount({walked_municipal_v2:visit(['23229','25203','23219'])});
 try{
  capturePins(w);
  w.document.querySelector('[data-collection-mode="sengoku"]').click();
  assert.equal(w.qaV2Markers.length,62);
  for(const personId of personIds.slice(0,3)){
   openSengoku(w,personId);
   const expected=approved.sites.filter(s=>s.publicPin&&s.personIds.includes(personId));
   assert.equal(w.qaV2Markers.length,expected.length,'selected character should show every public site even if unearned');
   assert.equal(new Set(w.qaV2Markers.map(m=>m.popup.querySelector('h3').textContent)).size,expected.length);
   for(const s of expected){
    const m=w.qaV2Markers.find(m=>m.popup.querySelector('h3').textContent===s.name);
    assert.ok(m,'missing site for character '+personId+': '+s.name);
    assert.deepEqual(Array.from(m.xy),[s.point[1],s.point[0]],'Leaflet pin uses [latitude,longitude]');
   }
  }
  assert.ok(approved.sites.some(s=>s.publicPin&&s.personIds.length>1),'shared site test fixture absent');
  assert.deepEqual(Object.keys(read(w).visited).sort(),['23219','23229','25203']);
 }finally{w.close()}
});
test('retired cards remain intact while Hōjō Ujimasa joins the approved catalogue',async()=>{
 const initial={
  walked_municipal_v2:visit(['14206','13120']),
  walked_sengoku_cards_v1:{
   'sg-card-0004':{at:'2020-01-02',siteId:'sg-site-odawara'},
   'sg-card-0063':{at:'2020-01-03',siteId:'sg-site-shakujii'}
  }
 };
 const w=await mount(initial);
 try{
  const saved=read(w);
  assert.deepEqual(saved.cards['sg-card-0004'],initial.walked_sengoku_cards_v1['sg-card-0004']);
  assert.deepEqual(saved.cards['sg-card-0063'],initial.walked_sengoku_cards_v1['sg-card-0063']);
  assert.equal(JSON.parse(w.eval('JSON.stringify(sengokuPeople.map(p=>p.name))')).length,20);
  w.document.querySelector('[data-collection-mode="sengoku"]').click();
  assert.ok(JSON.parse(w.eval('JSON.stringify(sengokuPeople.map(p=>p.name))')).includes('北条氏政'));
  assert.ok(!w.document.getElementById('sengokuPanel').textContent.includes('太田道灌'));
  const before=raw(w);
  w.eval('reconcileSengokuVisits()');
  assert.deepEqual(raw(w),before,'revisiting a town must not rewrite retired card records');
 }finally{w.close()}
});

test('deleted legacy research and publication files are absent from shipping repository',()=>{
 for(const p of [
  'history.json','people-review.csv',
  'sengoku/people.json','sengoku/cards.json','sengoku/sites.json','sengoku/links.json',
  'sengoku/non-place-history.json','sengoku/provisional-history.json',
  'sengoku/approved-profiles.json','sengoku/chronology-hints.json',
  'sengoku/publication-credits.json','sengoku/priority100.json',
  'publication-import/releases/20261102-line-c/package.json',
  'scripts/merge_sengoku_batch.py','sengoku-v2-integration.js'
 ])assert.equal(fs.existsSync(path.join(root,p)),false,'obsolete published file retained: '+p);
 assert.ok(fs.existsSync(path.join(root,'sengoku/v2/approved-three-person-staging.json')));
 assert.ok(fs.existsSync(path.join(root,'sengoku/v2/approved-up-to-ujimasa.json')));
});


test('year labels list only currently conquered municipalities for an acquired location-history card',async()=>{
 const w=await mount({
  walked_municipal_v2:visit(['25201','26103']),
  walked_sengoku_cards_v1:{'sg-card-legacy':{at:'2020-01-01'}}
 });
 try{
  const detail=openSengoku(w,personIds[0]);
  const rows=[...detail.querySelectorAll('.sengoku-era')];
  const enryakuji=rows.find(x=>x.textContent.includes('比叡山延暦寺を焼き討ちする'));
  assert.ok(enryakuji);
  assert.match(enryakuji.querySelector('.sengoku-year').textContent,/元亀2年（1571）.*制覇：大津市・京都市左京区/);
  const born=rows.find(x=>x.textContent.includes('尾張の織田家に生まれる'));
  assert.ok(born);
  assert.equal(born.querySelector('.sengoku-year').textContent.includes('制覇：'),false);
  assert.deepEqual(Object.keys(read(w).visited).sort(),['25201','26103']);
 }finally{w.close()}
});

test('unconquered OR destination is not displayed, nearby unvisited regions never appear',async()=>{
 const w=await mount({walked_municipal_v2:visit(['25201'])});
 try{
  const detail=openSengoku(w,personIds[0]);
  const rows=[...detail.querySelectorAll('.sengoku-era')];
  const item=rows.find(x=>x.textContent.includes('比叡山延暦寺を焼き討ちする'));
  assert.ok(item);
  const date=item.querySelector('.sengoku-year').textContent;
  assert.match(date,/制覇：大津市/);
  assert.equal(date.includes('京都市左京区'),false);
  const other=rows.find(x=>x.querySelector('.sengoku-year').textContent.includes('未発見'));
  assert.equal(other,undefined);
 }finally{w.close()}
});

test('isolated synthetic rank/tie view renders grouped histories without mutating actual 108 cards, places, titles or backup',async()=>{
 const w=await mount({walked_municipal_v2:visit(placeCodes)});
 try{
  const personId=personIds[0],C=require('../sengoku-chronology.js');
  const legacy=C.present(approved.histories.filter(h=>h.personId===personId),null);
  const i=legacy.findIndex((h,j)=>legacy[j+1]?.eventYear===h.eventYear);
  assert.ok(i>=0,'fixture requires same-year events');
  const earlier=legacy[i],later=legacy[i+1];
  const ordered=legacy.map(h=>h.historyId);
  [ordered[i],ordered[i+1]]=[ordered[i+1],ordered[i]];
  const group=personId+'|'+earlier.eventYear+'|20';
  const ties=[
   [later.historyId,{group,first:true,size:2}],
   [earlier.historyId,{group,first:false,size:2}]
  ];
  const before=raw(w),previous=read(w);delete previous.createdAt;
  w.eval('window.__realChronologyPreview=sengokuChronology.get('+JSON.stringify(personId)+')');
  w.eval('sengokuChronology.set('+JSON.stringify(personId)+', {orderIds:'+JSON.stringify(ordered)+
    ',tieById:new Map('+JSON.stringify(ties)+')})');
  const detail=openSengoku(w,personId);
  assert.equal(detail.querySelectorAll('.sengoku-era').length,32);
  assert.equal(detail.querySelectorAll('.sengoku-chronology-tie').length,2);
  assert.equal(detail.querySelectorAll('.sengoku-chronology-note').length,1);
  assert.match(detail.textContent,/同年の出来事。前後関係は確定していません。/);
  const rows=[...detail.querySelectorAll('.sengoku-era')];
  assert.ok(rows[i].textContent.includes(later.title));
  assert.ok(rows[i+1].textContent.includes(earlier.title));
  assert.deepEqual(raw(w),before,'the test-only display order must not touch persisted records');
  const afterBackup=read(w);delete afterBackup.createdAt;
  assert.deepEqual(afterBackup,previous,'backup payload and story unlock remain the same (export timestamp excluded)');
  w.eval('sengokuChronology.set('+JSON.stringify(personId)+',window.__realChronologyPreview);delete window.__realChronologyPreview');
  const fallback=openSengoku(w,personId);
  assert.equal(fallback.querySelectorAll('.sengoku-chronology-tie').length,0);
  const restored=JSON.parse(w.eval('JSON.stringify(sengokuChronology.get('+JSON.stringify(personId)+').orderIds)'));
  assert.ok(restored.includes(earlier.historyId));
  assert.ok(restored.includes(later.historyId));
  assert.equal(w.eval('sengokuChronology.size'),3);
 }finally{w.close()}
});

test('real C chronology manifest renders approved rank order for all 3 people in the DOM',async()=>{
 const w=await mount({walked_municipal_v2:visit(placeCodes)});
 try{
  const groups=[
   [personIds[0],1570,['sg2hist-nobu-1570-kanegasaki','sg2hist-nobu-1570-anegawa']],
   [personIds[1],1582,['sg2hist-hideyoshi-bitchu-siege-1582','sg2hist-hideyoshi-mori-peace-1582',
     'sg2hist-hideyoshi-yamazaki-1582','sg2hist-hideyoshi-taiko-kenchi']],
   [personIds[2],1615,['sg2hist-ieyasu-1615-summer','sg2hist-ieyasu-1615-buke-law','sg2hist-ieyasu-1615-kinchu-law']]
  ];
  for(const [id,year,expected] of groups){
   const actual=JSON.parse(w.eval('JSON.stringify(SengokuChronology.present(approvedHistories('+JSON.stringify(id)+'),sengokuChronology.get('+JSON.stringify(id)+')).filter(h=>h.eventYear==='+year+').map(h=>h.historyId))'));
   assert.deepEqual(actual,expected);
  }
  assert.equal(w.eval('sengokuChronology.size'),3);
  assert.equal(countV2(w),515);
 }finally{w.close()}
});

test('new Edo Castle pin is labeled yellow and remains unlinked to any GPS arrival award',async()=>{
 const w=await mount();try{
  capturePins(w);
  w.document.querySelector('[data-collection-mode="sengoku"]').click();
  const match=w.qaV2Markers.find(x=>x.popup?.querySelector('h3')?.textContent==='江戸城跡（家康入府の本拠）');
  assert.ok(match,'⑥1546 approved Edo site marker must be present');
  assert.equal(match.opts.fillColor,'#edb42d');
  assert.match(match.popup.textContent,/一部立入制限/);
  assert.match(match.popup.textContent,/非公開/);
  assert.ok(match.popup.textContent.includes('現地の案内'));
  assert.equal(read(w).cards['sg2hist-ieyasu-1590-kanto'],undefined,'pin alone must not award cards');
 }finally{w.close()}
});

test('approved Taiheiji green pin appears independently of Hideyoshi card acquisition',async()=>{
 const w=await mount();try{
  capturePins(w);w.document.querySelector('[data-collection-mode="sengoku"]').click();
  const pin=w.qaV2Markers.find(x=>x.popup?.querySelector('h3')?.textContent==='泰平寺（秀吉・島津義久和睦の地）');
  assert.ok(pin);
  assert.equal(pin.opts.fillColor,'#21864e');
  assert.match(pin.popup.textContent,/鹿児島県薩摩川内市/);
  assert.match(pin.popup.textContent,/CODH作成/);
  assert.equal(read(w).cards['sg2hist-hideyoshi-kyushu-1587'],undefined);
 }finally{w.close()}
});

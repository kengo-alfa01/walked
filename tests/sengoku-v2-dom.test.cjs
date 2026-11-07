const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {app,read,restore,raw}=require('./support/app.cjs');
const root=path.join(__dirname,'..');
const approved=JSON.parse(fs.readFileSync(path.join(root,'sengoku/v2/approved-three-person-staging.json'),'utf8'));
const personIds=approved.people.map(p=>p.personId);
const approvedIds=approved.histories.map(h=>h.historyId);
const placeCodes=[...new Set(approved.sites.filter(s=>approved.relations.some(r=>r.siteId===s.siteId)).flatMap(s=>s.municipalityCodes))];
async function mount(initial={}){
 const w=await app(initial);
 for(let i=0;i<100;i++){
  if(w.document.getElementById('sengokuQuality').textContent.includes('公開人物 3人／承認経歴 108件'))return w;
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
  assert.ok(w.document.getElementById('sengokuQuality').textContent.includes('承認経歴 108件'));
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
  const b=read(w);assert.equal(countV2(w),108);assert.equal(placeCodes.length,41);
  assert.equal(Object.keys(b.visited).length,41);
  for(const person of approved.people){
   const detail=openSengoku(w,person.personId);
   assert.ok(detail.textContent.includes(person.story.text),person.name+' story remains locked');
   assert.ok(detail.textContent.includes(person.introduction.text));
   assert.equal(detail.querySelectorAll('.sengoku-era').length,approved.histories.filter(h=>h.personId===person.personId).length);
   assert.equal(detail.querySelector('.sengoku-profile'),null,'legacy profile should not be duplicated');
  }
  const before=raw(w);w.eval('reconcileSengokuVisits()');
  assert.deepEqual(raw(w),before);assert.equal(countV2(w),108);
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
test('reviewed pin is the only v2 map pin even when previously visited',async()=>{
 const w=await mount({walked_municipal_v2:visit(['23229'])});
 try{
  w.document.querySelector('[data-collection-mode="sengoku"]').click();
  w.eval('window.qaV2Markers=[];sengokuPins.clearLayers=()=>{window.qaV2Markers.length=0};L.circleMarker=(xy,opts)=>{window.qaV2Markers.push({xy,opts});return {bindPopup(){return this},addTo(){return this}}};');
  openSengoku(w,personIds[0]);
  const pins=w.qaV2Markers;
  assert.ok(pins.length<=1,'v2 selected person should not expose other legacy pins');
  if(pins.length)assert.deepEqual(Array.from(pins[0].xy),[35.05998,136.9807]);
 }finally{w.close();}
});


test('old Hōjō Ujimasa and Ōta Dōkan card saves never surface retired people, cards or pins',async()=>{
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
  assert.deepEqual(JSON.parse(w.eval('JSON.stringify(sengokuPeople.map(p=>p.name))')),['織田信長','豊臣秀吉','徳川家康']);
  w.document.querySelector('[data-collection-mode="sengoku"]').click();
  assert.ok(!w.document.getElementById('sengokuPanel').textContent.includes('北条氏政'));
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
});

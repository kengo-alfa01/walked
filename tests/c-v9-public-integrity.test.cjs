'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const core=require('../sengoku-v2-core.js');
const doc=JSON.parse(fs.readFileSync('sengoku/v2/approved-c-20261124-p2-88.json','utf8'));
const codes=new Set(JSON.parse(fs.readFileSync('data/title-registry.json','utf8')).areas.map(x=>x.code));
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const banned=['sg2hist-nobutora-kofu-founding','sg2site-a-joun-body-mound-20261111','sg2site-a-katsuyori-tano-20261111','sg2site-a-nobutora-kawada-old-20261111'];
const restored=[
 ['sg2site-a-miy-koshimizu-20261114',3681,424,[135.336812,34.745646],'red'],
 ['sg2site-a28-murakami-shioda-20261121',3904,495,[138.19609,36.339715],'green'],
 ['sg2site-a28-murakami-nechi-20261121',3905,496,[137.869634,36.959569],'yellow'],
 ['sg2site-a27-ujitsuna-taisekiji-1537-20261121',3986,494,[138.583466,35.281353],'red']
];
test('C v9: immutable text approvals, four blocked records absent and 4 safe pins',()=>{
 const c=core.validate(doc,codes,hash);
 assert.equal(doc.version,'v2-approved-c-20261124-p2-88-v9');
 assert.deepEqual([c.people.size,c.histories.size,c.sites.size,doc.relations.length,doc.sites.filter(s=>s.publicPin).length],[88,1590,553,868,521]);
 for(const id of banned){
  assert(!doc.histories.some(x=>x.historyId===id));
  assert(!doc.sites.some(x=>x.siteId===id));
  assert(!doc.relations.some(x=>x.historyId===id||x.siteId===id));
  assert(!doc.municipalityAwards.some(x=>x.historyId===id||x.relatedSiteId===id));
 }
 const person=doc.people.find(x=>x.personId==='sg-98514cee0056');
 assert.equal(person.story.unlock.requiredHistoryCount,29);
 assert.equal(person.story.unlock.requiredPlaceHistoryCount,7);
 assert.equal(core.canUnlockStory(c,person.personId,{},hash),false);
 for(const [id,approved,row,position,color] of restored){
  const site=c.sites.get(id);
  assert(site&&site.publicPin,'missing pin '+id);
  assert.deepEqual(site.point,position);
  assert.equal(site.pinApproval.sheetRow,approved);
  assert.equal(site.pinReview.sourceSheetRow,row);
  assert.equal(site.pinReview.accessStatus,color);
  assert.equal(site.pinReview.decision,'可');
  assert.equal(core.pinDetails(site).noRouting,color==='red');
  assert(site.pinReview.attributions.some(x=>x.label.includes('CODH')&&x.url.includes('geoshape')));
 }
 const oldProtected=doc.sites.find(x=>x.siteId==='sg2site-a-hachijo-hideie-residence-20261123');
 assert(oldProtected.publicPin&&oldProtected.pinReview.accessStatus==='red');
});
test('C v9: published ledger exactly matches active JSON and no banned rows',()=>{
 const lines=fs.readFileSync('data/c-release/records.csv','utf8').trim().split('\n');
 assert.equal(lines.length,2320);
 for(const id of banned)assert(!lines.some(x=>x.includes(','+id+',')),'forbidden CSV row '+id);
 for(const [id] of restored)assert(lines.some(x=>x.includes(','+id+',')&&x.includes(',1,v2-approved-c-20261124-p2-88-v9')),'missing pin ledger '+id);
 const data=fs.readFileSync('sengoku/v2/approved-c-20261124-p2-88.json');
 const blob=crypto.createHash('sha1').update(Buffer.from('blob '+data.length+'\0')).update(data).digest('hex');
 const status=fs.readFileSync('data/c-release/status.csv','utf8');
 assert(status.includes(blob+',88,1590,553,521,2319'));
});

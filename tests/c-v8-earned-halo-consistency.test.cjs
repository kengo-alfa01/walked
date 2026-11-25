'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const core=require('../sengoku-v2-core.js');

const release=JSON.parse(fs.readFileSync('sengoku/v2/approved-c-20261124-p2-88.json','utf8'));
const known=new Set(JSON.parse(fs.readFileSync('data/title-registry.json','utf8')).areas.map(x=>x.code));
const sha=text=>crypto.createHash('sha256').update(text,'utf8').digest('hex');
const catalog=core.validate(release,known,sha);
const oyamaHistoryId='sg2hist-a-ujiteru-009-20261113';
const oyamaSiteId='sg2site-a47-ujiteru-oyama-gion-20261121';
const komakiHistoryId='sg2hist-ieyasu-1584-komaki';
const komakiSite='sg2site-nobu-komakiyama';
const nagakuteSite='sg2site-ieyasu-nagakute';
const saved=historyId=>({[historyId]:{at:'2026-11-20T12:00:00Z',basis:'old-approved-release'}});

test('B-approved 88-person published JSON remains valid with 522 pins',()=>{
 assert.equal(catalog.people.size,88);
 assert.equal([...catalog.sites.values()].filter(x=>x.publicPin).length,522);
 assert.equal(catalog.histories.get(oyamaHistoryId)?.personId,'sg-fc948f16832f');
 assert.deepEqual([...catalog.linkSites.get(oyamaHistoryId)],[oyamaSiteId]);
 assert.equal(catalog.sites.get(oyamaSiteId)?.publicPin,true);
 assert.equal(catalog.sites.get(oyamaSiteId)?.pinReview?.accessStatus,'green');
});

test('an already-acquired unique-site card stays black after no-pin to pin promotion',()=>{
 const actual=core.acquiredPinSiteIds(catalog,{},saved(oyamaHistoryId));
 assert.equal(actual.has(oyamaSiteId),true,'old legitimate acquired card missing its only approved pin');
 assert.equal(actual.has(komakiSite),false);
 assert.equal(actual.has(nagakuteSite),false);
 assert.equal(core.acquiredPinSiteIds(catalog,{},{}).has(oyamaSiteId),false,'unearned pin must remain white');
 const withSite={[oyamaHistoryId]:{at:'2026-11-20T12:00:00Z',siteId:oyamaSiteId}};
 assert.equal(core.acquiredPinSiteIds(catalog,{},withSite).has(oyamaSiteId),true);
});

test('a multi-site acquired history does not blacken unvisited other sites',()=>{
 const alone=core.acquiredPinSiteIds(catalog,{},saved(komakiHistoryId));
 assert.equal(alone.has(komakiSite),false);
 assert.equal(alone.has(nagakuteSite),false);
 const visited={'23219':{first:'2026-11-20'}};
 const matched=core.acquiredPinSiteIds(catalog,visited,saved(komakiHistoryId));
 assert.equal(matched.has(komakiSite),true);
 assert.equal(matched.has(nagakuteSite),false);
 const direct=core.acquiredPinSiteIds(catalog,{},{
  [komakiHistoryId]:{at:'2026-11-20',siteId:nagakuteSite}
 });
 assert.equal(direct.has(komakiSite),false);
 assert.equal(direct.has(nagakuteSite),true);
});

test('related-only historical-site pins retain municipality-visit collection independently of cards',()=>{
 const site=[...catalog.sites.values()].find(s=>s.relatedOnly===true&&s.publicPin===true&&s.codes.length>0);
 assert(site,'no B-approved independently collectible public site exists for regression');
 const blank=core.acquiredPinSiteIds(catalog,{},{});
 assert.equal(blank.has(site.siteId),false);
 const visited={[site.codes[0]]:{first:'2026-11-20'}};
 assert.equal(core.acquiredPinSiteIds(catalog,visited,{}).has(site.siteId),true);
});

'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const core=require('../sengoku-v2-core.js');
const d=JSON.parse(fs.readFileSync('sengoku/v2/approved-c-20261124-p2-88.json'));
const m=JSON.parse(fs.readFileSync('docs/c-release/20261125-katsuyori-approved-v10.json'));
const sha=s=>crypto.createHash('sha256').update(s,'utf8').digest('hex');
const c=core.validate(d,new Set(JSON.parse(fs.readFileSync('data/title-registry.json')).areas.map(x=>x.code)),sha);
const h=m.history.historyId,s=m.site.siteId,g=m.graveAward.relatedSiteId,p=m.history.personId;
test('exact approvals and independent grave OR',()=>{
 assert.equal(d.version,m.version);assert.equal(c.histories.get(h).text,m.history.text);assert.equal(c.histories.get(h).approval.sheetRow,4020);
 const site=c.sites.get(s);assert.equal(site.description,m.site.description);assert.equal(site.approval.sheetRow,4496);assert.equal(site.pinApproval.version,'v3');assert.deepEqual(site.point,[138.8025625,35.6409375]);assert.equal(site.pinReview.accessStatus,'yellow');assert.equal(site.pinReview.approvedE,m.site.pinReview.approvedE);
 assert.deepEqual([...c.linkSites.get(h)],[s]);assert.deepEqual([...c.codes.get(h)],['19213']);assert.deepEqual(c.municipalityAwards.get(h),m.graveAward);assert(c.sites.get(g).publicPin);assert.notDeepEqual(c.sites.get(g).point,site.point);assert.deepEqual(c.people.get(p).story.unlock,m.unlock);
});
test('unvisited, visited, existing acquisition and duplicate guard',()=>{
 const blank=core.award(c,{},{},[],'2026-11-25');assert(!Object.hasOwn(blank.records,h));assert(!core.acquiredPinSiteIds(c,{},blank.records).has(s));
 const visit={'19213':{first:'2020-01-01'}},a=core.award(c,visit,{},[],'2026-11-25');assert.equal(a.added.filter(x=>x===h).length,1);assert.equal(a.records[h].siteId,s);assert(core.acquiredPinSiteIds(c,visit,a.records).has(s));assert.deepEqual(core.earnedMunicipalities(c,h,visit,a.records),['19213']);
 const saved={[h]:{at:'2020-01-01',basis:'old-approved'}};
 const b=core.award(c,visit,saved,[],'2026-11-25');assert(!b.added.includes(h));assert.deepEqual(b.records[h],saved[h]);assert(core.acquiredPinSiteIds(c,{},b.records).has(s));
});
test('no unapproved grave variant passes',()=>{const bad=JSON.parse(JSON.stringify(d));bad.municipalityAwards.find(x=>x.historyId===h).municipalityCode='13201';assert.throws(()=>core.validate(bad,new Set(JSON.parse(fs.readFileSync('data/title-registry.json')).areas.map(x=>x.code)),sha));});

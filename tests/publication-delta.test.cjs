'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),cp=require('node:child_process');
const D=require('../scripts/import-publication-delta.cjs'),R=require('../regional-core.js'),RD=require('../scripts/regional-data.cjs'),W=require('../walked-core.js'),registry=require('../data/title-registry.json');
const base=Object.fromEntries(D.FILES.map(f=>[f,JSON.parse(cp.execFileSync('git',['show',D.release.baselineCommit+':'+f],{encoding:'utf8'}))]));
const current=Object.fromEntries(D.FILES.map(f=>[f,JSON.parse(fs.readFileSync(f))]));
const regional=require('../regional/catalog.json'),oldRegional=JSON.parse(cp.execFileSync('git',['show',D.release.baselineCommit+':regional/catalog.json'],{encoding:'utf8'}));
const regionalPatch=require('../regional/releases/20261102-line-c.json');
test('reviewed delta preserves every old ID and all nonapproved fields; history/storage/title code unchanged',()=>{
 assert.deepEqual(D.apply(base),current);assert.deepEqual(D.apply(current),current);
 for(const f of D.FILES.slice(0,4))for(const r of base[f])assert.deepEqual(current[f].find(n=>n.id===r.id),D.release.operations.find(o=>o.file===f&&o.id===r.id)?.after||r);
 assert.equal(D.release.approvals.length,22);assert.equal(D.release.operations.filter(o=>o.file==='sengoku/cards.json'&&!o.before).length,16);assert.equal(D.release.operations.filter(o=>o.file==='sengoku/cards.json'&&o.before).length,6);
 for(const f of ['index.html','walked-core.js','history.json','data/title-registry.json','regional-core.js','regional-ui.js'])assert.equal(fs.readFileSync(f,'utf8'),cp.execFileSync('git',['show',D.release.baselineCommit+':'+f],{encoding:'utf8'}));
 assert.equal(W.catalog(registry).length,214);
});
test('partial replay is idempotent and conflicting targets, unrelated changes and package tampering reject before write',()=>{
 const partial=structuredClone(base),op=D.release.operations.find(o=>o.before);partial[op.file][partial[op.file].findIndex(r=>r.id===op.id)]=op.after;assert.deepEqual(D.apply(partial),current);
 const stale=structuredClone(base);stale[op.file].find(r=>r.id===op.id).summary='different edit';assert.throws(()=>D.apply(stale),/Stale/);
 const unrelated=structuredClone(base);unrelated['sengoku/people.json'][0].name='changed';assert.throws(()=>D.apply(unrelated),/Baseline/);
 const modified=structuredClone(D.release);modified.approvals[0].publicationStatus='公開可候補';assert.throws(()=>D.apply(base,modified),/checksum/);
});
test('36 approved profiles use explicit scope, preserve unknowns, and cannot introduce media or unapproved raw fields',()=>{
 const p=current['sengoku/approved-profiles.json'];assert.equal(p.profiles.length,36);
 const allowed=new Set(Object.keys(base['sengoku/approved-profiles.json'].profiles[0]));for(const r of p.profiles){assert.ok(Object.keys(r).every(k=>allowed.has(k)));assert.match(r.approvalSHA256,/^[a-f0-9]{64}$/);assert.equal(r.publicationStatus,'公開可');}
 assert.equal(p.profiles.find(r=>r.personId==='sg-master-0185').birthYear,null);
 assert.equal(p.profiles.find(r=>r.personId==='sg-master-0817').personId,current['sengoku/people.json'].find(r=>r.id==='sg-master-0817').id);
});
test('regional patch adds439 items/447 relations and preserves already published19 unchanged; reapplying does not add history',()=>{
 R.validate(regional,registry);assert.deepEqual(RD.apply(oldRegional,regionalPatch),regional);assert.deepEqual(RD.apply(regional,regionalPatch),regional);
 assert.equal(regional.items.length,458);assert.equal(regional.relations.length,467);
 for(const r of oldRegional.items)assert.deepEqual(regional.items.find(i=>i.id===r.id),r);
 assert.ok(regionalPatch.operations.every(o=>!o.before&&o.after));
});
test('retroactive old-town visits reveal every approved regional article of a municipality; shared articles remain unique',()=>{
 const visits={'m:1320900101':{first:'2001-01-01',last:'2020-03-04'},'n:13201:1320100101':{first:'2002-02-03'}};
 const snapshot=structuredClone(visits),v=R.view(regional,visits,registry);
 for(const rel of regional.relations.filter(r=>['13209','13201'].includes(r.areaCode)))assert.ok(v.items.some(i=>i.id===rel.itemId));
 const shared=regional.items.find(i=>regional.relations.filter(r=>r.itemId===i.id&&['13209','13201'].includes(r.areaCode)).length===2);assert.ok(shared);assert.equal(v.items.filter(i=>i.id===shared.id).length,1);
 assert.deepEqual(visits,snapshot);assert.equal(R.view(regional,{},registry).items.length,0);
 const b=W.parseBackup(W.backup(visits,{old:{at:'1998-01-02'}},{awards:{},selected:null}));assert.deepEqual(R.view(regional,b.visited,registry).items,v.items);assert.equal(b.cards.old.at,'1998-01-02');
 const blank=registry.areas.find(a=>!regional.relations.some(r=>r.areaCode===a.code));assert.equal(R.view(regional,{[blank.code]:{}},registry).items.length,0);
});
const {app,read,restore}=require('./support/app.cjs');
test('current application unlocks all new same-city cards, keeps acquired timestamps, and saves/reloads/restores v3',async()=>{
 const visits={'n:34214:342140001':{first:'2000-01-01',last:'2020-01-01'},'15222':{first:'2003-04-05'}},legacy={'sg-card-0136':{at:'1997-06-07',siteId:'sg-site-ueda'},retired:{at:'1990-01-01'}};
 const w=await app({walked_municipal_v2:visits,walked_sengoku_cards_v1:legacy});const b=read(w);
 const relevant=D.release.approvals.filter(a=>['34214','15222'].includes(current['sengoku/sites.json'].find(s=>s.id===a.siteId).municipalityCode));assert.equal(relevant.length,5);
 for(const a of relevant)assert.ok(b.cards[a.cardId],a.cardId);assert.deepEqual(b.visited,visits);for(const [id,r]of Object.entries(legacy))assert.deepEqual(b.cards[id],r);
 const reloaded=await app(Object.fromEntries(['walked_municipal_v2','walked_sengoku_cards_v1','walked_titles_v1'].map(k=>[k,w.localStorage.getItem(k)])));assert.deepEqual(read(reloaded).cards,b.cards);assert.ok(reloaded.document.getElementById('sengokuToast').hidden);
 const restored=await app();await restore(restored,b);assert.deepEqual(read(restored).cards,b.cards);assert.deepEqual(read(restored).visited,visits);
 const unrelated=await app({walked_municipal_v2:{'35203':{}}});for(const a of relevant)assert.ok(!read(unrelated).cards[a.cardId]);for(const x of [w,reloaded,restored,unrelated])x.close();
});
test('all new/updated cards pass actual runtime eligibility and point-in-municipality checks',async()=>{
 const w=await app();for(const a of D.release.approvals){const valid=w.eval('eligibleSengokuCard(sengokuCards.find(c=>c.id==='+JSON.stringify(a.cardId)+'))');assert.ok(valid,a.cardId);const s=current['sengoku/sites.json'].find(s=>s.id===a.siteId);assert.equal(w.eval('getMunicipalityForPoint('+JSON.stringify(s.point)+')&&municipalCode(getMunicipalityForPoint('+JSON.stringify(s.point)+'))'),s.municipalityCode,s.id);}
 w.close();
});
test('new awards remain absent on save failure and succeed once after retry without changing visits',async()=>{
 const w=await app(),set=w.Storage.prototype.setItem;const visits={'34214':{first:'2000-01-01'}};w.eval('state.visited='+JSON.stringify(visits));
 w.Storage.prototype.setItem=function(k,v){if(k==='walked_sengoku_cards_v1')throw Error('quota');return set.call(this,k,v)};
 assert.throws(()=>w.eval('reconcileSengokuVisits()'),/quota/);assert.equal(Object.keys(read(w).cards).length,0);assert.ok(w.document.getElementById('sengokuToast').hidden);
 w.Storage.prototype.setItem=set;w.eval('reconcileSengokuVisits()');const b=read(w);for(const id of ['pub-card-268571ea41feac148a4784f9','pub-card-c7757200eb6cb07049500403','pub-card-18142cf5ecc680edce957807','pub-card-9522e5a0f5d8cc4c0d65003c'])assert.ok(b.cards[id]);w.eval('reconcileSengokuVisits()');assert.deepEqual(read(w).cards,b.cards);w.close();
});
test('expanded national-category UI limits initial DOM to30 articles and exposes sources without media',async()=>{
 const visits=Object.fromEntries(regional.relations.map(r=>[r.areaCode,{}])),w=await app({walked_municipal_v2:visits});await new Promise(r=>setTimeout(r,20));const panel=w.document.querySelector('#regionalPanel');panel.querySelector('button').click();
 const click=prefix=>{const b=[...panel.querySelectorAll('button')].find(b=>b.textContent.startsWith(prefix));assert.ok(b,prefix);b.click();};click('カテゴリーから探す');click('景勝・自然');assert.equal(panel.querySelectorAll('[data-item-id]').length,30);click('続きを表示');assert.equal(panel.querySelectorAll('[data-item-id]').length,60);
 const dialog=w.document.querySelector('#regionalDialog');dialog.showModal=function(){this.open=true};panel.querySelector('[data-item-id]').click();assert.ok(dialog.querySelector('a[href^="https://"]'));assert.equal(dialog.querySelectorAll('img,iframe,audio,video').length,0);w.close();
});

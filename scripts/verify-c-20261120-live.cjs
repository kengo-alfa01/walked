#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const prefix=process.argv[2]||'/tmp/new9-pages';
const live=p=>fs.readFileSync(prefix+'/'+p);
const m=JSON.parse(fs.readFileSync('docs/c-release/20261120-new9-approved-manifest.json','utf8'));
const qa=JSON.parse(fs.readFileSync('docs/c-release/20261120-new9-qa.json','utf8'));
const relPath='sengoku/v2/approved-c-20261120-new9-80.json';
const bytes=live(relPath),pkg=JSON.parse(bytes);
const sha=crypto.createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
const status=live('data/c-release/status.csv').toString('utf8').trim().split('\n');
const records=live('data/c-release/records.csv').toString('utf8').trim().split('\n');
assert.equal(pkg.version,'v2-approved-c-20261120-new9-80');
assert.deepEqual([pkg.people.length,pkg.histories.length,pkg.sites.length,pkg.sites.filter(s=>s.publicPin).length],[74,1251,436,419]);
assert.equal(records.length,1836);
assert.deepEqual(status,[ 'release_version,source_path,source_blob_sha,people,histories,sites,published_pins,ledger_rows',
 [pkg.version,relPath,sha,74,1251,436,419,1835].join(',')]);
const pm=new Map(pkg.people.map(x=>[x.personId,x]));
const hm=new Map(pkg.histories.map(x=>[x.historyId,x]));
const sm=new Map(pkg.sites.map(x=>[x.siteId,x]));
assert.equal(m.approved.length,80);
for(const a of m.approved){
 const rec=a.kind==='人物紹介'?pm.get(a.personId)?.introduction:
   a.kind==='完成版ストーリー'?pm.get(a.personId)?.story:
   a.kind==='経歴'?hm.get(a.originalId):sm.get(a.originalId);
 assert.ok(rec,'live missing approved '+a.row);
 const text=a.kind==='史跡'?rec.description:rec.text;
 assert.equal(text,a.text,'live body differs from ⑥ '+a.row);
 assert.equal(rec.approval.sheetRow,a.row);
 assert.equal(rec.approval.personId,a.personId);
 assert.equal(rec.approval.sourceId,a.originalId);
 assert.equal(rec.approval.version,a.version);
 assert.equal(rec.approval.sha256,crypto.createHash('sha256').update(a.text).digest('hex'));
 assert.equal(rec.approval.user,'公開OK');
}
for(const s of m.sites){
 const row=sm.get(s.id);assert.ok(row?.publicPin);
 assert.deepEqual(row.point,[s.longitude,s.latitude]);
 assert.equal(row.pinReview.accessStatus,s.accessStatus);
 assert.equal(row.pinReview.approvedE,s.approvedPositionAndSafety);
}
assert.equal(pkg.retiredHistories.length,31);
assert.equal(pkg.municipalityAwards.length,6);
assert.ok(!sm.has('sg2site-new9-matsunaga-tamon-20261119'));
assert.ok(sm.has('sg2site-a-junkei-tamon-20261112'));
assert.deepEqual(qa.released,{introductions:9,stories:9,histories:43,sites:19,relations:28,redPins:10,yellowPins:5,greenPins:4});
console.log('PAGES_NEW9_LIVE_VERIFIED',JSON.stringify({commit:process.env.GITHUB_SHA,release:pkg.version,blobSHA:sha,people:74,histories:1251,sites:436,pins:419,records:1835,
 approvalRowsChecked:80,relationLinks:qa.released.relations,colors:{red:10,yellow:5,green:4},prefecturePins:qa.pinPrefectureDelta}));

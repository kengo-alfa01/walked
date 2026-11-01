const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),cp=require('node:child_process');
const {FILES,packages,apply,hash}=require('../scripts/import-publication.cjs');
const commit=packages[0].baseline.commit;
const base=Object.fromEntries(FILES.map(f=>[f,JSON.parse(cp.execFileSync('git',['show',commit+':'+f],{encoding:'utf8'}))]));
const current=Object.fromEntries(FILES.map(f=>[f,JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'..',f)))]));
test('two reviewed packages produce the exact runtime catalog and preserve every legacy record',()=>{
 assert.deepEqual(apply(base),current);for(const f of FILES){const old=f==='history.json'?base[f].entries:base[f],now=f==='history.json'?current[f].entries:current[f];for(const r of old)assert.deepEqual(now.find(x=>x.id===r.id),r);}
 assert.equal(current['sengoku/cards.json'].length,304);assert.equal(current['sengoku/links.json'].length,233);
 for(const f of ['sengoku/people.json','sengoku/sites.json','history.json'])assert.deepEqual(current[f],base[f]);
});
test('repeat import, reversed packages and partial S1 installation are idempotent',()=>{
 assert.deepEqual(apply(current),current);assert.deepEqual(apply(base,[...packages].reverse()),current);assert.deepEqual(apply(apply(base,[packages[0]])),current);
});
test('changed old catalog, tampered delta and same-ID overwrite stop import',()=>{
 const b=structuredClone(base);b['sengoku/cards.json'][0].title+='changed';assert.throws(()=>apply(b),/Baseline/);
 const p=structuredClone(packages);p[0].delta['sengoku/cards.json'][0].summary+='changed';assert.throws(()=>apply(base,p),/checksum/);
 const b2=structuredClone(current);b2['sengoku/cards.json'].at(-1).summary+='changed';assert.throws(()=>apply(b2),/overwrite/);
});
test('published additions contain only frozen reviewed IDs, safe facts and required credits',()=>{
 const newCards=packages.flatMap(p=>p.delta['sengoku/cards.json']);assert.equal(newCards.length,2);
 for(const p of packages){assert.equal(p.approvedRecords.length,1);const c=p.delta['sengoku/cards.json'][0];assert.equal(c.id,p.approvedRecords[0].cardId);assert.equal(c.historyRecordId,p.approvedRecords[0].historyRecordId);assert.equal(c.relationId,p.approvedRecords[0].relationId);assert.equal(c.verification,'reviewed');assert.match(c.summary,/CODH.*CC BY 4.0.*10.20676\/00000456/);assert.match(c.source,/^https:\/\/kunishitei.bunka.go.jp\//);}
 assert.deepEqual(newCards.map(c=>c.eventYear),[1585,1576]);
 assert.equal(current['sengoku/sites.json'].find(s=>s.id==='sg-site-hachigata').municipalityCode,base['sengoku/sites.json'].find(s=>s.id==='sg-site-hachigata').municipalityCode);
 assert.ok(current['sengoku/cards.json'].some(c=>c.id==='sg-card-0266'));
});

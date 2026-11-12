const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const V=require('../sengoku-v2-core.js'),root=path.join(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const previous=read('sengoku/v2/approved-up-to-muneshige.json');
const current=read('sengoku/v2/approved-up-to-muneshige-pins-100.json');
const registered=new Set(read('data/title-registry.json').areas.map(a=>a.code));
const hash=s=>crypto.createHash('sha256').update(s,'utf8').digest('hex');
const index=V.validate(current,registered,hash);
test('100 explicitly authorized public pins, existing 234 immutable',()=>{
 assert.equal(index.people.size,43);assert.equal(index.histories.size,980);assert.equal(index.sites.size,355);
 assert.equal(current.relations.length,548);assert.equal(current.sites.filter(s=>s.publicPin).length,334);
 const map=new Map(current.sites.map(s=>[s.siteId,s]));
 assert.equal(previous.sites.filter(s=>s.publicPin).length,234);
 for(const old of previous.sites.filter(s=>s.publicPin))assert.deepEqual(map.get(old.siteId),old);
 const changed=current.sites.filter(s=>s.publicPin&&!previous.sites.find(o=>o.siteId===s.siteId)?.publicPin);
 assert.equal(changed.length,100);
 assert.ok(changed.every(s=>s.pinApproval.user==='公開OK'&&s.pinApproval.sheetRow>=2000&&s.pinApproval.sheetRow<=2099));
 assert.ok(changed.every(s=>s.pinReview.decision==='可'&&['green','yellow','red'].includes(s.pinReview.accessStatus)));
 assert.equal(new Set(changed.map(s=>s.siteId)).size,100);
});
test('51 approved history revisions and two city-award corrections',()=>{
 const known=new Map(current.histories.map(h=>[h.historyId,h]));
 assert.equal(current.histories.filter(h=>h.approval.version==='v2').length>=51,true);
 for(const [id,code] of [['sg2hist-mogami-1546-birth','06201'],['sg2hist-mogami-1588-jugori','06203']]){
  const h=known.get(id);assert.equal(h.kind,'place');assert.equal(h.approval.user,'公開OK');assert.equal(h.approval.version,'v2');
  const earned=V.award(index,{[code]:{first:'2026-11-12'}},{'saved-old':{at:'2019-01-01'}},[]);
  assert.ok(earned.records[id]);assert.ok(earned.records['saved-old']);
 }
 const p=current.people.find(p=>p.name==='最上義光');
 assert.equal(p.story.unlock.requiredPlaceHistoryCount,14);
});
test('published source is the index release and C ledger is current',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 assert.ok(html.includes("fetch('./sengoku/v2/approved-up-to-muneshige-pins-100.json'"));
 const csv=fs.readFileSync(path.join(root,'data/c-release/status.csv'),'utf8');
 const source=fs.readFileSync(path.join(root,'sengoku/v2/approved-up-to-muneshige-pins-100.json'));
 const hash=crypto.createHash('sha1').update(Buffer.from('blob '+source.length+'\0')).update(source).digest('hex');
 assert.ok(csv.includes(hash));assert.ok(csv.includes(',43,980,355,334,1421'));
});

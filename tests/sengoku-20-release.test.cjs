const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),V=require('../sengoku-v2-core.js');
const root=path.join(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const d=read('sengoku/v2/approved-up-to-ujimasa.json'),old=read('sengoku/v2/approved-three-person-staging.json'),known=new Set(read('data/title-registry.json').areas.map(x=>x.code));
const hash=s=>crypto.createHash('sha256').update(s,'utf8').digest('hex');
test('20 approved ranks to Hōjō Ujimasa preserve the original approved 3 and pins',()=>{
 assert.equal(d.people.length,20);assert.equal(d.people.at(-1).name,'北条氏政');
 assert.deepEqual(d.people.slice(0,3),old.people);assert.deepEqual(d.histories.slice(0,108),old.histories);
 assert.deepEqual(d.sites.slice(0,62),old.sites);assert.deepEqual(d.relations.slice(0,78),old.relations);
 assert.equal(d.histories.length,515);assert.equal(d.sites.length,236);
 assert.equal(d.sites.filter(x=>x.publicPin).length,234);
 assert.equal(d.sites.filter(x=>!x.publicPin&&x.point===null).length,2);
 assert.deepEqual(d.people.filter(p=>!p.introduction).map(p=>p.name),['長宗我部元親','直江兼続','柴田勝家','北条氏政']);
 assert.equal(d.histories.some(h=>h.historyId==='sg2hist-ujiyasu-konodai1538'),false);
});
test('⑥ approval SHA, unique rows, pin gates and location based awards validate strictly',()=>{
 const rows=new Set(),ck=(a,s)=>{assert.equal(a.user,'公開OK');assert.equal(a.quality,'品質合格');assert.equal(a.handoff,'C候補（別途公開承認）');assert.equal(a.sourceMatch,'一致');assert.equal(a.sha256,hash(s));assert.equal(rows.has(a.sheetRow),false);rows.add(a.sheetRow);};
 for(const p of d.people){if(p.introduction)ck(p.introduction.approval,p.introduction.text);ck(p.story.approval,p.story.text);}
 for(const h of d.histories)ck(h.approval,h.text);
 for(const s of d.sites){
  ck(s.approval,s.description);
  if(s.publicPin){
    if(s.pinApproval.sheetRow!==s.approval.sheetRow)ck(s.pinApproval,s.description);
    else assert.deepEqual(s.pinApproval,s.approval,'同一行の本文と位置承認が一致すること');
  }else assert.equal(s.point,null);
 }
 const catalog=V.validate(d,known,hash);assert.equal(catalog.people.size,20);assert.equal(catalog.histories.size,515);assert.equal(catalog.sites.size,236);
 for(const h of d.histories)if(h.kind==='place')assert.ok(catalog.codes.get(h.historyId)?.size>0,h.historyId);
});
test('previous save and legacy cards are not deleted',()=>{
 const cat=V.validate(d,known,hash),saved={'sg-card-0004':{at:'2020-01-02',siteId:'sg-site-odawara'}},visited={'14206':{first:'2018-05-01'}},a=V.award(cat,visited,saved,[],'2026-11-11');
 assert.deepEqual(a.records['sg-card-0004'],saved['sg-card-0004']);assert.deepEqual(visited,{'14206':{first:'2018-05-01'}});
});

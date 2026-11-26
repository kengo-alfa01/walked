'use strict';
const fs=require('node:fs'),crypto=require('node:crypto'),a=require('node:assert/strict');
const m=JSON.parse(fs.readFileSync('docs/c-release/20261126-new4-approved77.json','utf8'));
const b=fs.readFileSync('sengoku/v2/approved-c-20261124-p2-88.json'),d=JSON.parse(b);
const sha=s=>crypto.createHash('sha256').update(s,'utf8').digest('hex');
const blob=crypto.createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex');
a.equal(blob,m.priorBlob);a.equal(d.version,m.priorVersion);
const fix=(approval,text)=>{a.equal(approval.sha256,'GENERATE');approval.sha256=sha(text);};
for(const p of m.people){fix(p.introduction.approval,p.introduction.text);if(p.story){fix(p.story.approval,p.story.text);const hs=m.histories.filter(h=>h.personId===p.personId);p.story.unlock={requiredHistoryCount:hs.length,requiredPlaceHistoryCount:hs.filter(h=>h.kind==='place').length,historyIdsSHA256:sha(hs.map(h=>h.historyId).sort().join('\n'))};}}
for(const h of m.histories)fix(h.approval,h.text);
for(const s of m.sites){fix(s.approval,s.description);if(s.publicPin)s.pinApproval={...s.approval};}
d.people.push(...m.people);d.histories.push(...m.histories);d.sites.push(...m.sites);d.relations.push(...m.relations);d.version=m.version;
d.notes.cRelease.v11={date:'2026-11-26',description:'77 approved records; two long stories withheld; existing immutable records retained',priorRelease:m.priorVersion};
const core=require('../sengoku-v2-core.js'),codes=new Set(JSON.parse(fs.readFileSync('data/title-registry.json')).areas.map(x=>x.code));core.validate(d,codes,sha);
fs.writeFileSync('sengoku/v2/approved-c-20261126-new4.json',JSON.stringify(d,null,2)+'\n');console.log('C_V11_BUILD_PASS');

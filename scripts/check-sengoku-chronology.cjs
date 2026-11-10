#!/usr/bin/env node
'use strict';
// Read-only offline preflight. This does not approve, import, or publish anything.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const C=require('../sengoku-chronology.js');
const root=path.join(__dirname,'..');
const releasePath=process.argv[2]?path.resolve(process.argv[2]):
 path.join(root,'sengoku/v2/chronology-release.json');
const sha256=s=>crypto.createHash('sha256').update(s,'utf8').digest('hex');
try{
 const doc=JSON.parse(fs.readFileSync(path.join(root,'sengoku/v2/approved-three-person-staging.json'),'utf8'));
 const manifest=JSON.parse(fs.readFileSync(releasePath,'utf8'));
 if(doc.histories.length!==108||doc.people.length!==3)
  throw Error('Expected unchanged, previously published 3 people / 108 histories');
 const index={histories:new Map(doc.histories.map(h=>[h.historyId,h]))};
 if(index.histories.size!==108)throw Error('Duplicate history IDs in legacy release');
 const verified=C.loadManifest(manifest,index,sha256); // production mode: rejects all test fixtures
 for(const [personId,view] of verified){
  const p=doc.people.find(p=>p.personId===personId);
  if(!p)throw Error('Chronology person not in existing release '+personId);
  if(view.orderIds.length!==p.story.unlock.requiredHistoryCount)
   throw Error('Person history count changed '+personId);
  console.log('VERIFIED: '+p.name+' '+view.orderIds.length+' histories, B review '+view.reviewId);
 }
 if(verified.size===0){
  console.log('WAITING: 0 new B/⑥ approved chronology releases; legacy 108 remain visible.');
 }else{
  console.log('PASS: '+verified.size+' complete chronology person release(s). No files modified.');
 }
}catch(e){
 console.error('BLOCKED: '+e.message);
 process.exitCode=1;
}

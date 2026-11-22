#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.join(__dirname,'..'),base=process.env.WALKED_PAGES_BASE||'https://kengo-alfa01.github.io/walked/';
const files=['index.html','sengoku-card-cleanup.js','sengoku/v2/approved-c-20261120-new9-80.json','walked-core.js'];
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const current=JSON.parse(fs.readFileSync(path.join(root,files[2]),'utf8'));
if(current.people.length!==74||current.histories.length!==1251||current.sites.filter(s=>s.publicPin).length!==419)
 throw Error('Published approved catalogue unexpectedly changed');
async function published(p){
 const url=new URL(p,base);url.searchParams.set('c_cleanup_verify','20261122');
 const res=await fetch(url.toString(),{cache:'no-store',signal:AbortSignal.timeout(23000)});
 if(!res.ok)throw Error('HTTP '+res.status+' '+p);
 return Buffer.from(await res.arrayBuffer());
}
(async()=>{
 const originals=files.map(file=>({file,bytes:fs.readFileSync(path.join(root,file))}));
 for(let attempt=1;attempt<=18;attempt++){
  const result=[];
  for(const {file,bytes} of originals){
   try{
    const got=await published(file),equal=got.equals(bytes);
    result.push({file,match:equal,bytes:got.length,sha256:equal?hash(got):undefined});
   }catch(e){result.push({file,match:false,error:e.message})}
  }
  const passed=result.every(f=>f.match);
  console.log('C_CARD_PURGE_LIVE_BYTES',JSON.stringify({attempt,passed,files:result,approvedHistories:current.histories.length,publicPins:419}));
  if(passed)return;
  if(attempt<18)await sleep(7000);
 }
 throw Error('GitHub Pages live bytes did not equal main');
})().catch(e=>{console.error('C_CARD_PURGE_LIVE_FAILED',e);process.exitCode=1});

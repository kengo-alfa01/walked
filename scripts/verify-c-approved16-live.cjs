#!/usr/bin/env node
'use strict';
/* Compare exact published Github Pages bytes with checked-out main for approved pin display. */
const fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
const root=path.join(__dirname,'..'),base=process.env.WALKED_PAGES_BASE||'https://kengo-alfa01.github.io/walked/';
const files=[
 'index.html',
 'sengoku-pin-approved-v2.js',
 'sengoku-pin-display.js',
 'sengoku/v2/approved-pin-display-20261122-v2.json',
 'sengoku/v2/approved-c-20261120-new9-80.json',
 'sengoku-v2-core.js',
 'sengoku-source-links.js'
];
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
async function sleep(ms){await new Promise(r=>setTimeout(r,ms))}
async function live(pathname){
 const url=new URL(pathname,base);url.searchParams.set('c_publication_verify','20261122');
 const response=await fetch(url.toString(),{cache:'no-store',signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw Error(pathname+' HTTP '+response.status);
 return Buffer.from(await response.arrayBuffer());
}
async function main(){
 const manifest=JSON.parse(fs.readFileSync(path.join(root,files[3]),'utf8'));
 const main=JSON.parse(fs.readFileSync(path.join(root,files[4]),'utf8'));
 if(manifest.count!==16||Object.keys(manifest.entries).length!==16)throw Error('approved display manifest count changed');
 if(main.sites.filter(s=>s.publicPin).length!==419)throw Error('419 historical public pins changed unexpectedly');
 const local=files.map(f=>({path:f,bytes:fs.readFileSync(path.join(root,f))}));
 let outcome=[];
 for(let attempt=1;attempt<=18;attempt++){
  outcome=[];
  for(const file of local){
   try{
    const published=await live(file.path);
    const match=file.bytes.equals(published);
    outcome.push({path:file.path,match,liveBytes:published.length,localBytes:file.bytes.length,sha256:match?digest(published):null});
   }catch(error){outcome.push({path:file.path,match:false,error:error.message})}
  }
  const good=outcome.every(f=>f.match);
  console.log('C_APPROVED16_PAGES_PROOF',JSON.stringify({attempt,good,approved16:manifest.count,pins419:419,files:outcome}));
  if(good){
   if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      '### C ⑥v2 approved16 Pages byte proof: PASS\nAll 7 live files exactly equal main bytes. 16 structured display versions; 419 original pins preserved.\n');
   return;
  }
  if(attempt<18)await sleep(6500);
 }
 throw Error('GitHub Pages bytes never matched checked-out main for all seven files');
}
main().catch(e=>{console.error('C_APPROVED16_LIVE_FAIL',e.message);process.exitCode=1});

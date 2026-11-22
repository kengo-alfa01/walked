#!/usr/bin/env node
'use strict';
/* Actual GitHub Pages bytes must equal the merged main checkout before calling release complete. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.join(__dirname,'..'),base=process.env.WALKED_PAGES_BASE||'https://kengo-alfa01.github.io/walked/';
const files=[
 'index.html','sengoku-pin-sheet.js','sengoku-pin-sheet.css',
 'sengoku-pin-display.js','sengoku-pin-approved-v2.js',
 'sengoku/v2/approved-pin-display-20261122-v2.json',
 'sengoku/v2/approved-c-20261120-new9-80.json'
];
function sha256(data){return crypto.createHash('sha256').update(data).digest('hex')}
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function fetchLive(file){
 const url=new URL(file,base);url.searchParams.set('c_sheet_proof','20261122');
 const response=await fetch(url.toString(),{cache:'no-store',signal:AbortSignal.timeout(24000)});
 if(!response.ok)throw Error('HTTP '+response.status+' '+url.pathname);
 return Buffer.from(await response.arrayBuffer());
}
async function main(){
 const old=JSON.parse(fs.readFileSync(path.join(root,files[6]),'utf8'));
 if(old.sites.filter(s=>s.publicPin).length!==419||old.histories.length!==1251||old.people.length!==74)
  throw Error('Existing catalogue counts changed');
 const approval=JSON.parse(fs.readFileSync(path.join(root,files[5]),'utf8'));
 if(approval.count!==16||Object.keys(approval.entries).length!==16)throw Error('Approved v2 content changed');
 const local=files.map(file=>({file,bytes:fs.readFileSync(path.join(root,file))}));
 for(let attempt=1;attempt<=18;attempt++){
  const checks=[];
  for(const a of local){
   try{
    const got=await fetchLive(a.file),matched=got.equals(a.bytes);
    checks.push({file:a.file,matched,bytes:got.length,sha256:matched?sha256(got):null});
   }catch(e){checks.push({file:a.file,matched:false,error:e.message})}
  }
  const passed=checks.every(x=>x.matched);
  console.log('C_BOTTOM_SHEET_LIVE_PROOF',JSON.stringify({attempt,passed,files:checks,approved16:approval.count,pins:419}));
  if(passed){
   if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    '### Mobile historic-site bottom sheet — Pages bytes MATCH\n' +
    'All 7 files match the merged main checkout. Approved 16 and original 419 pins preserved.\n');
   return;
  }
  if(attempt<18)await pause(7000);
 }
 throw Error('Published GitHub Pages did not match main after 18 attempts');
}
main().catch(e=>{console.error('C_BOTTOM_SHEET_RELEASE_FAIL',e);process.exitCode=1});

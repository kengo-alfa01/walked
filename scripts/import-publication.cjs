'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const FILES=['sengoku/people.json','sengoku/sites.json','sengoku/links.json','sengoku/cards.json','history.json'];
const stable=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const hash=v=>crypto.createHash('sha256').update(stable(v)).digest('hex');
const root=path.resolve(__dirname,'..');
const packages=['20261031-stage1','20261031-stage4'].map(v=>require('../publication-import/releases/'+v+'/package.json'));
const rows=(catalog,f)=>f==='history.json'?catalog[f].entries:catalog[f];
// Immutable, reviewed additive exports only. A changed baseline requires a new review.
function apply(current,releases=packages){
 const out=structuredClone(current),baseline=structuredClone(current);
 for(const f of FILES){
  const additions=new Map();
  for(const p of releases){
   if(hash(p.delta[f])!==p.outputHashes[f])throw Error('Package checksum mismatch: '+f);
   for(const r of rows(p.delta,f)){
    if(additions.has(r.id)&&stable(additions.get(r.id))!==stable(r))throw Error('Conflicting package ID: '+r.id);
    additions.set(r.id,r);
   }
  }
  const old=rows(baseline,f),seen=new Set();
  for(const r of old){if(!r.id||seen.has(r.id))throw Error('Duplicate/missing ID: '+f);seen.add(r.id);if(additions.has(r.id)&&stable(r)!==stable(additions.get(r.id)))throw Error('Existing ID overwrite forbidden: '+r.id);}
  const stripped=old.filter(r=>!additions.has(r.id));
  if(f==='history.json')baseline[f].entries=stripped;else baseline[f]=stripped;
  for(const p of releases)if(hash(baseline[f])!==p.baseline.contentHashes[f])throw Error('Baseline changed: '+f);
  for(const [id,r] of [...additions].sort(([a],[b])=>a.localeCompare(b)))if(!seen.has(id))rows(out,f).push(structuredClone(r));
 }
 const people=new Set(out['sengoku/people.json'].map(r=>r.id)),sites=new Set(out['sengoku/sites.json'].map(r=>r.id));
 const links=new Set(out['sengoku/links.json'].map(r=>r.personId+'|'+r.siteId));
 for(const f of ['sengoku/links.json','sengoku/cards.json'])for(const r of out[f])if(!people.has(r.personId)||!sites.has(r.siteId))throw Error('Dangling reference: '+r.id);
 for(const r of out['sengoku/cards.json'])if(!links.has(r.personId+'|'+r.siteId))throw Error('Missing person-site link: '+r.id);
 return out;
}
if(require.main===module){
 const current=Object.fromEntries(FILES.map(f=>[f,JSON.parse(fs.readFileSync(path.join(root,f)))]));
 const next=apply(current);const changed=FILES.filter(f=>stable(current[f])!==stable(next[f]));
 if(process.argv.includes('--write'))for(const f of changed)fs.writeFileSync(path.join(root,f),JSON.stringify(next[f],null,2)+'\n');
 console.log(JSON.stringify({mode:process.argv.includes('--write')?'applied':'check',changed,counts:Object.fromEntries(FILES.map(f=>[f,rows(next,f).length]))}));
}
module.exports={FILES,packages,apply,hash,stable};

'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {FILES,hash,stable}=require('./import-publication.cjs');
const release=require('../publication-import/releases/20261101-stage2/package.json');
const RELEASE_SHA='1b9b4925ad2149d437e6043095f0f828ce12fd85c23022c1bce57375f4c487af';
const rawHash=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
function apply(current,p=release){
 if(hash(p)!==RELEASE_SHA)throw Error('Reviewed package checksum mismatch');
 const out=structuredClone(current),stripped=structuredClone(current);
 for(const f of FILES){
  const old=f==='history.json'?stripped[f].entries:stripped[f],add=f==='history.json'?p.additions[f].entries:p.additions[f],seen=new Set();
  for(const r of old){if(!r.id||seen.has(r.id))throw Error('Duplicate/missing ID: '+f);seen.add(r.id);}
  for(const r of add){const found=old.find(x=>x.id===r.id);if(found&&stable(found)!==stable(r))throw Error('Existing ID overwrite forbidden: '+r.id);}
  if(f==='sengoku/cards.json')for(const u of p.updates){
   const i=old.findIndex(x=>x.id===u.cardId);if(i<0)throw Error('Missing update target');
   if(rawHash(u.before)!==u.expectedBeforeSHA256||rawHash(u.after)!==u.expectedAfterSHA256)throw Error('Update checksum mismatch');
   for(const key of new Set([...Object.keys(u.before),...Object.keys(u.after)]))if(!u.mutableFields.includes(key)&&stable(u.before[key])!==stable(u.after[key]))throw Error('Protected update field');
   if(stable(old[i])!==stable(u.before)&&stable(old[i])!==stable(u.after))throw Error('Stale update target: '+u.cardId);
   old[i]=structuredClone(u.before);
  }
  const restored=old.filter(r=>!add.some(x=>x.id===r.id));
  if(f==='history.json')stripped[f].entries=restored;else stripped[f]=restored;
  if(hash(stripped[f])!==p.baselineHashes[f])throw Error('Baseline changed: '+f);
  const target=f==='history.json'?out[f].entries:out[f];for(const r of add)if(!seen.has(r.id))target.push(structuredClone(r));
  if(f==='sengoku/cards.json')for(const u of p.updates)target[target.findIndex(x=>x.id===u.cardId)]=structuredClone(u.after);
 }
 const people=new Set(out['sengoku/people.json'].map(r=>r.id)),sites=new Set(out['sengoku/sites.json'].map(r=>r.id));
 const links=new Set(out['sengoku/links.json'].map(r=>r.personId+'|'+r.siteId));
 for(const r of [...out['sengoku/links.json'],...out['sengoku/cards.json']])if(!people.has(r.personId)||!sites.has(r.siteId))throw Error('Dangling reference');
 for(const r of out['sengoku/cards.json'])if(!links.has(r.personId+'|'+r.siteId))throw Error('Missing person-site link');
 return out;
}
if(require.main===module){
 const root=path.resolve(__dirname,'..');const current=Object.fromEntries(FILES.map(f=>[f,JSON.parse(fs.readFileSync(path.join(root,f)))]));const next=apply(current);
 const extra={'sengoku/approved-profiles.json':release.profiles,'sengoku/publication-credits.json':release.credits};
 for(const [f,v] of Object.entries(extra))if(fs.existsSync(path.join(root,f))&&stable(JSON.parse(fs.readFileSync(path.join(root,f))))!==stable(v))throw Error('Reviewed runtime metadata changed: '+f);
 if(process.argv.includes('--write'))for(const [f,v] of Object.entries({...next,...extra}))fs.writeFileSync(path.join(root,f),JSON.stringify(v,null,2)+'\n');
 console.log(JSON.stringify({mode:process.argv.includes('--write')?'applied':'check',counts:Object.fromEntries(FILES.map(f=>[f,f==='history.json'?next[f].entries.length:next[f].length])),addedCards:2,updatedCards:2,approvedProfiles:release.profiles.profiles.length,published:false}));
}
module.exports={apply,release,RELEASE_SHA};

'use strict';
const fs=require('node:fs'),path=require('node:path');
const {hash,stable}=require('./import-publication.cjs');
const release=require('../publication-import/releases/20261102-line-c/package.json');
const RELEASE_SHA='4fd020b4108f0666ea5ca2c1841d91c42cacf2d6c7a81f5ead1b9700ebfe3df8';
const FILES=Object.keys(release.baselineHashes);
function validate(out){
 for(const f of FILES.slice(0,4)){const ids=new Set();for(const r of out[f]){if(!r.id||ids.has(r.id))throw Error('Duplicate/missing ID: '+f);ids.add(r.id);}}
 const people=new Set(out['sengoku/people.json'].map(r=>r.id)),sites=new Set(out['sengoku/sites.json'].map(r=>r.id)),pairs=new Set();
 for(const r of out['sengoku/links.json']){const pair=r.personId+'|'+r.siteId;if(!people.has(r.personId)||!sites.has(r.siteId)||pairs.has(pair))throw Error('Invalid/duplicate link');pairs.add(pair);}
 for(const c of out['sengoku/cards.json'])if(!people.has(c.personId)||!sites.has(c.siteId)||!pairs.has(c.personId+'|'+c.siteId))throw Error('Dangling card');
 const ids=new Set();for(const p of out['sengoku/approved-profiles.json'].profiles){if(ids.has(p.personId)||p.publicationStatus!=='公開可'||!p.approvalSHA256)throw Error('Invalid profile');ids.add(p.personId);}
 return out;
}
function apply(current,p=release){
 if(hash(p)!==RELEASE_SHA)throw Error('Reviewed package checksum mismatch');
 const out=structuredClone(current),restored=structuredClone(current),seen=new Set();
 for(const a of p.approvals)if(a.publicationStatus!=='公開可'||Object.values(a.entityStates).some(s=>s!=='公開可')||!a.approvalFingerprint||!a.publicPackageSHA256)throw Error('Unapproved record');
 for(const op of p.operations){
  if(!FILES.slice(0,4).includes(op.file)||seen.has(op.file+'|'+op.id)||op.after?.id!==op.id||hash(op.before)!==op.beforeHash||hash(op.after)!==op.afterHash)throw Error('Invalid operation/checksum');seen.add(op.file+'|'+op.id);
  for(const [doc,isRestored] of [[out,false],[restored,true]]){const rows=doc[op.file],i=rows.findIndex(r=>r.id===op.id),now=i<0?null:rows[i];if(![op.beforeHash,op.afterHash].includes(hash(now)))throw Error('Stale target: '+op.id);if(i>=0)rows.splice(i,1);const val=isRestored?op.before:op.after;if(val)rows.push(structuredClone(val));}
 }
 for(const [f,m] of Object.entries(p.metadata)){if(stable(out[f])!==stable(m.before)&&stable(out[f])!==stable(m.after))throw Error('Stale metadata: '+f);restored[f]=structuredClone(m.before);out[f]=structuredClone(m.after);}
 for(const f of FILES){const original=structuredClone(restored[f]);
  // Baseline record order is deliberately bound as well. Restore it from the checked baseline IDs.
  if(Array.isArray(original)){const order=p.baselineOrder[f];original.sort((a,b)=>order.indexOf(a.id)-order.indexOf(b.id));out[f].sort((a,b)=>{const ai=order.indexOf(a.id),bi=order.indexOf(b.id);return (ai<0?order.length:ai)-(bi<0?order.length:bi)|| (ai<0&&bi<0?a.id.localeCompare(b.id):0);});}
  if(hash(original)!==p.baselineHashes[f])throw Error('Baseline changed: '+f);
 }
 return validate(out);
}
if(require.main===module){const root=path.resolve(__dirname,'..'),cur=Object.fromEntries(FILES.map(f=>[f,JSON.parse(fs.readFileSync(path.join(root,f)))])),next=apply(cur);if(process.argv.includes('--write'))for(const f of FILES)if(stable(cur[f])!==stable(next[f]))fs.writeFileSync(path.join(root,f),JSON.stringify(next[f],null,2)+'\n');console.log(JSON.stringify({mode:process.argv.includes('--write')?'applied':'check',counts:Object.fromEntries(FILES.slice(0,4).map(f=>[f,next[f].length])),approvals:release.approvals.length,published:false}));}
module.exports={apply,validate,release,FILES,RELEASE_SHA};

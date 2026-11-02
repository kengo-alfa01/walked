(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.PublicationRuntime=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const RELEASE_SHA='4fd020b4108f0666ea5ca2c1841d91c42cacf2d6c7a81f5ead1b9700ebfe3df8';
const stable=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const clone=v=>JSON.parse(JSON.stringify(v));
// SHA-256 over UTF-8, including insecure local previews where SubtleCrypto is unavailable.
const primes=[];for(let n=2;primes.length<64;n++)if(!primes.some(p=>p*p<=n&&n%p===0))primes.push(n);
const fraction=x=>Math.floor((x-Math.floor(x))*4294967296)|0;
const initial=primes.slice(0,8).map(p=>fraction(Math.sqrt(p))),rounds=primes.map(p=>fraction(Math.cbrt(p)));
const rotate=(x,n)=>(x>>>n)|(x<<(32-n));
function sha256(text){
 const bytes=[];for(const c of text){const n=c.codePointAt(0);if(n<128)bytes.push(n);else if(n<2048)bytes.push(192|(n>>6),128|(n&63));else if(n<65536)bytes.push(224|(n>>12),128|((n>>6)&63),128|(n&63));else bytes.push(240|(n>>18),128|((n>>12)&63),128|((n>>6)&63),128|(n&63));}
 const length=bytes.length*8;bytes.push(128);while(bytes.length%64!==56)bytes.push(0);for(let i=7;i>=0;i--)bytes.push(Math.floor(length/2**(i*8))&255);
 const h=initial.slice(),w=new Int32Array(64);
 for(let start=0;start<bytes.length;start+=64){for(let i=0;i<16;i++){const j=start+i*4;w[i]=(bytes[j]<<24)|(bytes[j+1]<<16)|(bytes[j+2]<<8)|bytes[j+3];}for(let i=16;i<64;i++){const a=w[i-15],b=w[i-2];w[i]=(w[i-16]+(rotate(a,7)^rotate(a,18)^(a>>>3))+w[i-7]+(rotate(b,17)^rotate(b,19)^(b>>>10)))|0;}
  let [a,b,c,d,e,f,g,z]=h;for(let i=0;i<64;i++){const t1=(z+(rotate(e,6)^rotate(e,11)^rotate(e,25))+((e&f)^(~e&g))+rounds[i]+w[i])|0,t2=((rotate(a,2)^rotate(a,13)^rotate(a,22))+((a&b)^(a&c)^(b&c)))|0;z=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0;}for(const [i,v]of [a,b,c,d,e,f,g,z].entries())h[i]=(h[i]+v)|0;
 }
 return h.map(v=>(v>>>0).toString(16).padStart(8,'0')).join('');
}
const hash=v=>sha256(stable(v));
function validate(out){
 for(const f of ['sengoku/people.json','sengoku/sites.json','sengoku/cards.json','sengoku/links.json']){const ids=new Set();for(const r of out[f]){if(!r.id||ids.has(r.id))throw Error('Duplicate/missing ID: '+f);ids.add(r.id);}}
 const people=new Set(out['sengoku/people.json'].map(r=>r.id)),sites=new Set(out['sengoku/sites.json'].map(r=>r.id)),pairs=new Set();
 for(const r of out['sengoku/links.json']){const pair=r.personId+'|'+r.siteId;if(!people.has(r.personId)||!sites.has(r.siteId)||pairs.has(pair))throw Error('Invalid/duplicate link');pairs.add(pair);}
 for(const c of out['sengoku/cards.json'])if(!people.has(c.personId)||!sites.has(c.siteId)||!pairs.has(c.personId+'|'+c.siteId))throw Error('Dangling card');
 const ids=new Set();for(const p of out['sengoku/approved-profiles.json'].profiles){if(ids.has(p.personId)||p.publicationStatus!=='公開可'||!p.approvalSHA256)throw Error('Invalid profile');ids.add(p.personId);}
 return out;
}
function apply(current,p){
 if(hash(p)!==RELEASE_SHA)throw Error('Reviewed package checksum mismatch');
 const files=Object.keys(p.baselineHashes),out=clone(current),restored=clone(current),seen=new Set();
 for(const a of p.approvals)if(a.publicationStatus!=='公開可'||Object.values(a.entityStates).some(s=>s!=='公開可')||!a.approvalFingerprint||!a.publicPackageSHA256)throw Error('Unapproved record');
 for(const op of p.operations){
  if(!files.slice(0,4).includes(op.file)||seen.has(op.file+'|'+op.id)||op.after?.id!==op.id||hash(op.before)!==op.beforeHash||hash(op.after)!==op.afterHash)throw Error('Invalid operation/checksum');seen.add(op.file+'|'+op.id);
  for(const [doc,isRestored]of [[out,false],[restored,true]]){const rows=doc[op.file],i=rows.findIndex(r=>r.id===op.id),now=i<0?null:rows[i];if(stable(now)!==stable(op.before)&&stable(now)!==stable(op.after))throw Error('Stale target: '+op.id);if(i>=0)rows.splice(i,1);const val=isRestored?op.before:op.after;if(val)rows.push(clone(val));}
 }
 for(const [f,m]of Object.entries(p.metadata)){if(stable(out[f])!==stable(m.before)&&stable(out[f])!==stable(m.after))throw Error('Stale metadata: '+f);restored[f]=clone(m.before);out[f]=clone(m.after);}
 for(const f of files){const original=clone(restored[f]);if(Array.isArray(original)){const order=p.baselineOrder[f],positions=new Map(order.map((id,i)=>[id,i]));original.sort((a,b)=>positions.get(a.id)-positions.get(b.id));out[f].sort((a,b)=>{const ai=positions.get(a.id),bi=positions.get(b.id);return (ai??order.length)-(bi??order.length)||(ai===undefined&&bi===undefined?a.id.localeCompare(b.id):0);});}if(hash(original)!==p.baselineHashes[f])throw Error('Baseline changed: '+f);}
 return validate(out);
}
return {apply,validate,hash,sha256,RELEASE_SHA};
});

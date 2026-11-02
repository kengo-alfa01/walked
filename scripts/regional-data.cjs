'use strict';
const fs=require('node:fs'),crypto=require('node:crypto'),R=require('../regional-core.js'),registry=require('../data/title-registry.json');
const stable=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const hash=x=>crypto.createHash('sha256').update(stable(x)).digest('hex');
const empty={schemaVersion:1,version:'empty',items:[],relations:[],sources:[]};
function project(raw,version){
 const split=s=>String(s||'').split(/\s+/).filter(Boolean),rows=s=>raw[s].slice(1);
 const approved=rows('地域項目マスター').filter(r=>r[22]==='公開可'&&r[25]==='登録');
 const relations=rows('地域・項目対応').filter(r=>r[9]==='公開可'&&approved.some(i=>i[0]===r[2])).map(r=>({id:r[0],areaCode:String(r[1]),itemId:r[2],sourceIds:split(r[7]),publicationStatus:r[9]}));
 const items=approved.filter(r=>relations.some(l=>l.itemId===r[0])).map(r=>({id:r[0],name:r[1],category:r[3],description:r[5],nature:r[15]||'',sourceIds:split(r[16]),publicationStatus:r[22]}));
 const needed=new Set([...items,...relations].flatMap(i=>i.sourceIds));
 const sources=rows('出典マスター').filter(r=>needed.has(r[0])).map(r=>({id:r[0],name:r[1],url:r[2],publisher:r[3],checkedOn:r[5]||''}));
 return R.validate({schemaVersion:1,version,items,relations,sources},registry);
}
function diff(base,next,removed={}){
 R.validate(base,registry);R.validate(next,registry);const operations=[];
 for(const collection of ['items','relations','sources']){
  for(const after of next[collection]){const before=base[collection].find(r=>r.id===after.id)||null;if(hash(before)!==hash(after))operations.push({collection,id:after.id,before,after,beforeHash:hash(before),afterHash:hash(after)});}
  for(const id of removed[collection]||[]){const before=base[collection].find(r=>r.id===id);if(!before||next[collection].some(r=>r.id===id))throw Error('削除対象が不正です');operations.push({collection,id,before,after:null,beforeHash:hash(before),afterHash:hash(null)});}
 }
 return {schemaVersion:1,version:next.version,baseVersion:base.version,baseHash:hash({...base,...Object.fromEntries(['items','relations','sources'].map(k=>[k,[...base[k]].sort((a,b)=>a.id.localeCompare(b.id))]))}),operations};
}
function apply(base,patch){
 if(patch.schemaVersion!==1||!Array.isArray(patch.operations))throw Error('差分形式が不正です');
 const out=structuredClone(base),restored=structuredClone(base),seen=new Set();
 for(const op of patch.operations){if(!['items','relations','sources'].includes(op.collection)||seen.has(op.collection+'|'+op.id))throw Error('差分ID重複/不正');seen.add(op.collection+'|'+op.id);
  if(hash(op.before)!==op.beforeHash||hash(op.after)!==op.afterHash||[op.before,op.after].some(r=>r&&r.id!==op.id))throw Error('差分指紋/ID不一致');
  const list=out[op.collection],i=list.findIndex(r=>r.id===op.id),current=i<0?null:list[i];if(hash(current)!==op.beforeHash&&hash(current)!==op.afterHash)throw Error('更新前レコード不一致');
  const old=restored[op.collection],j=old.findIndex(r=>r.id===op.id);if(j>=0)old.splice(j,1);if(op.before)old.push(op.before);
  if(i>=0)list.splice(i,1);if(op.after)list.push(structuredClone(op.after));
 }
 for(const d of [out,restored])for(const key of ['items','relations','sources'])d[key].sort((a,b)=>a.id.localeCompare(b.id));
 restored.version=patch.baseVersion;const original=structuredClone(restored);if(hash(original)!==patch.baseHash)throw Error('基準版不一致');
 if(![patch.baseVersion,patch.version].includes(base.version))throw Error('版不一致');out.version=patch.version;return R.validate(out,registry);
}
if(require.main===module){const [cmd,...a]=process.argv.slice(2);if(cmd==='export'){const doc=project(JSON.parse(fs.readFileSync(a[0])),a[1]);fs.writeFileSync(a[2],JSON.stringify(doc,null,2)+'\n');}else if(cmd==='diff'){const b=a[0]==='empty'?empty:JSON.parse(fs.readFileSync(a[0])),n=JSON.parse(fs.readFileSync(a[1])),p=diff(b,n,a[3]?JSON.parse(fs.readFileSync(a[3])):{});fs.writeFileSync(a[2],JSON.stringify(p,null,2)+'\n');}else if(cmd==='apply'){const b=a[0]==='empty'?empty:JSON.parse(fs.readFileSync(a[0])),p=JSON.parse(fs.readFileSync(a[1]));fs.writeFileSync(a[2],JSON.stringify(apply(b,p),null,2)+'\n');}else throw Error('export raw version out | diff base next patch [explicit-removals] | apply base patch out');}
module.exports={project,diff,apply,empty,hash};

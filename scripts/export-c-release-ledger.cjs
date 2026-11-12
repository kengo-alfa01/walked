#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const match=html.match(/fetch\(\s*['"]\.\/(sengoku\/v2\/approved-[^'"]+\.json)['"]/);
if(!match)throw Error('Cannot identify the actual Sengoku release referenced in index.html');
const sourcePath=match[1],sourceBytes=fs.readFileSync(path.join(root,sourcePath));
const pkg=JSON.parse(sourceBytes.toString('utf8'));
const registry=JSON.parse(fs.readFileSync(path.join(root,'data/title-registry.json'),'utf8'));
const core=require(path.join(root,'sengoku-v2-core.js'));
const sha256=s=>crypto.createHash('sha256').update(s,'utf8').digest('hex');
core.validate(pkg,new Set(registry.areas.map(a=>a.code)),sha256);
const sourceBlobSha=crypto.createHash('sha1')
  .update(Buffer.from('blob '+sourceBytes.length+'\0')).update(sourceBytes).digest('hex');
const items=[],seen=new Set();
function add(kind,id,name,approval,personIds,pin){
 if(!approval || approval.user!=='公開OK' || !approval.sheetRow ||
    !approval.version || !approval.sha256 || approval.sourceMatch!=='一致')
  throw Error('Refusing unapproved or nonmatching record: '+kind+' '+id);
 const key=kind+'|'+id;
 if(seen.has(key))throw Error('Duplicate C record '+key);
 seen.add(key);
 items.push([kind,id,name,approval.sheetRow,approval.version,approval.sha256,
   (Array.isArray(personIds)?personIds:[personIds]).filter(Boolean).join(';'),pin?1:0,pkg.version]);
}
for(const p of pkg.people){
 add('人物紹介',p.personId,p.name,p.introduction.approval,p.personId,false);
 add('完成版ストーリー',p.personId,p.name,p.story.approval,p.personId,false);
}
for(const h of pkg.histories)add('経歴',h.historyId,h.title,h.approval,h.personId,false);
for(const s of pkg.sites){
 if(s.publicPin && (!s.pinApproval || !Array.isArray(s.point) || s.point.length!==2))
  throw Error('Published pin missing approved location: '+s.siteId);
 add('史跡',s.siteId,s.name,s.publicPin?s.pinApproval:s.approval,s.personIds||[],s.publicPin);
}
const csvCell=v=>{
 let s=String(v??'');
 if(/^[=+\-@]/.test(s))s="'"+s;
 return /[",\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;
};
const csv=table=>table.map(r=>r.map(csvCell).join(',')).join('\n')+'\n';
const records=csv([
 ['kind','content_id','name','approval_row','approval_version','approval_sha256','person_ids','public_pin','release_version'],
 ...items]);
const status=csv([
 ['release_version','source_path','source_blob_sha','people','histories','sites','published_pins','ledger_rows'],
 [pkg.version,sourcePath,sourceBlobSha,pkg.people.length,pkg.histories.length,
  pkg.sites.length,pkg.sites.filter(s=>s.publicPin).length,items.length]
]);
function save(rel,content){
 const destination=path.join(root,rel);
 if(process.argv.includes('--check')){
  if(!fs.existsSync(destination)||fs.readFileSync(destination,'utf8')!==content)
   throw Error('Stale C ledger: '+rel+'; regenerate before merging publication');
 }else{
  fs.mkdirSync(path.dirname(destination),{recursive:true});
  fs.writeFileSync(destination,content,'utf8');
 }
}
save('data/c-release/records.csv',records);
save('data/c-release/status.csv',status);
console.log('C release ledger '+pkg.version+' / '+items.length+' entries / '+sourceBlobSha);

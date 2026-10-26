/* Preview-only data helpers. A correspondence is not a historical verification. */
(function(root){
'use strict';
const normalize=s=>String(s||'').normalize('NFKC').replace(/[\s　]/g,'').toLocaleLowerCase('ja');
function matches(person,query){const q=normalize(query);return !q||[person.name,person.reading,person.group,...(person.aliases||[]),...(person.aliasCandidates||[])].some(s=>normalize(s).includes(q));}
function validate(data){
 const {people,archive,sites,links,cards}=data;
 for(const rows of [people,archive,sites,links,cards]){
  if(!Array.isArray(rows))throw Error('データは配列である必要があります');
  const ids=rows.map(x=>x.id);if(ids.some(id=>typeof id!=='string'||!id)||new Set(ids).size!==ids.length)throw Error('IDが不正または重複しています');
 }
 const ids=new Set([...people,...archive].map(p=>p.id));
 if(ids.size!==people.length+archive.length)throw Error('採用人物と互換人物のIDが重複しています');
 const sids=new Set(sites.map(s=>s.id)),pairs=new Set(links.map(l=>l.siteId+'|'+l.personId));
 if([...links,...cards].some(r=>!ids.has(r.personId)||!sids.has(r.siteId)))throw Error('人物または史跡への参照が不正です');
 if(cards.some(c=>!pairs.has(c.siteId+'|'+c.personId)))throw Error('カードに対応する関連がありません');
 if(archive.some(p=>p.active!==false))throw Error('互換人物が採用扱いになっています');
 return true;
}
function backup(visited,found){return {format:'walked-backup-v2',visited,sengokuCards:found,source:'migration-preview'};}
function restore(data){
 const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
 if(data.format!=='walked-backup-v2'||!object(data.visited))throw Error('WALKEDバックアップではありません');
 const visited={},found={};
 for(const [k,v] of Object.entries(data.visited)){
  if(['__proto__','constructor','prototype'].includes(k))continue;visited[k]=v;
 }
 if(data.sengokuCards!==undefined&&!object(data.sengokuCards))throw Error('カード保存形式が不正です');
 for(const [k,v] of Object.entries(data.sengokuCards||{})){
  if(!['__proto__','constructor','prototype'].includes(k)&&object(v))found[k]=v;
 }
 // Keep unknown/future card IDs too; displaying them remains subject to eligibility.
 return {visited,found};
}
root.WalkedMigration={normalize,matches,validate,backup,restore};
if(typeof module!=='undefined')module.exports=root.WalkedMigration;
})(typeof globalThis!=='undefined'?globalThis:this);

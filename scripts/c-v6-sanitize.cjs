'use strict';
/*
 * Preparation-only C v6 transformation for a separately approved candidate.
 * Removes specifically superseded/indirect awards; preserves IDs of all other
 * valid earned cards and visit data. Never writes into the production release.
 */
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const retired=new Set([
 'sg2hist-hanbei-shigekado-birth',
 'sg2hist-hanbei-nagashino-1575'
]);
const removedRelations=new Set([
 'sg2hist-tadakatsu-1610-death|sg2site-tadakatsu-jodoji',
 'sg2hist-masanobu-1563-ikko|sg2site-ieyasu-honshoji'
]);
const hash=x=>crypto.createHash('sha256').update(x,'utf8').digest('hex');
function sanitize(input){
 if(!input||!Array.isArray(input.people)||!Array.isArray(input.histories)||!Array.isArray(input.relations))throw Error('C候補JSONの形式が不正');
 const doc=structuredClone(input);
 const peopleBefore=new Set(doc.people.map(p=>p.personId));
 const oldIds=new Set(doc.histories.map(h=>h.historyId));
 for(const id of retired)if(!oldIds.has(id))throw Error('統合対象の旧経歴IDがありません: '+id);
 doc.histories=doc.histories.filter(h=>!retired.has(h.historyId));
 const current=new Set(doc.histories.map(h=>h.historyId));
 doc.relations=doc.relations.filter(r=>current.has(r.historyId)&&!removedRelations.has(r.historyId+'|'+r.siteId));
 for(const id of retired)if(doc.relations.some(r=>r.historyId===id))throw Error('廃止カードの関係が残っています: '+id);
 for(const rel of removedRelations)if(doc.relations.some(r=>r.historyId+'|'+r.siteId===rel))throw Error('廃止関係が残っています: '+rel);
 doc.retiredHistories=(doc.retiredHistories||[]).map(entry=>{
  const h=entry.history||entry;
  if(!h.historyId||!h.personId||!peopleBefore.has(h.personId))throw Error('退役記録の帰属不明');
  return {historyId:h.historyId,personId:h.personId,type:entry.type||'旧公開記録'};
 });
 for(const p of doc.people){
  const histories=doc.histories.filter(h=>h.personId===p.personId);
  if(!histories.length)throw Error('経歴がゼロ件の人物は公開不可: '+p.personId);
  if(!p.story||!p.story.unlock)throw Error('完成版ストーリーの解除条件がありません: '+p.personId);
  p.story.unlock={
   requiredHistoryCount:histories.length,
   requiredPlaceHistoryCount:histories.filter(h=>h.kind==='place').length,
   historyIdsSHA256:hash(histories.map(h=>h.historyId).sort().join('\n'))
  };
 }
 return doc;
}
module.exports={sanitize,retiredHistoryIds:[...retired],removedRelationKeys:[...removedRelations]};
if(require.main===module){
 const argv=process.argv,inp=argv.indexOf('--in'),out=argv.indexOf('--out');
 if(inp<0||out<0||!argv[inp+1]||!argv[out+1])throw Error('Use: node scripts/c-v6-sanitize.cjs --in input.json --out new-preview.json');
 const from=path.resolve(argv[inp+1]),to=path.resolve(argv[out+1]);
 const production=path.resolve(__dirname,'../sengoku/v2/approved-c-20261120-new9-80.json');
 if(from===to||to===production)throw Error('原稿や現行本番JSONへの上書きは禁止');
 const doc=sanitize(JSON.parse(fs.readFileSync(from,'utf8')));
 fs.writeFileSync(to,JSON.stringify(doc,null,2)+'\n','utf8');
 console.log(JSON.stringify({status:'STAGING_ONLY_NOT_PUBLISHED',people:doc.people.length,histories:doc.histories.length,sites:doc.sites.length,relations:doc.relations.length,retiredTextCount:(doc.retiredHistories||[]).filter(x=>x.history?.text||x.text).length},null,2));
}

/* Pure title/backup rules. Browser global + Node tests; no catalog mutation. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.WalkedCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const nationalNames=['足軽','足軽大将','侍大将','城主','国人領主','戦国大名','大大名','天下人','天下統一','日本全国完全制覇'];
 const nationalThresholds=[1,25,50,100,200,350,500,750,1000];
 const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
 function object(v){return v!==null&&typeof v==='object'&&!Array.isArray(v);}
 function safeTree(v){if(!v||typeof v!=='object')return;for(const k of Object.keys(v)){if(['__proto__','constructor','prototype'].includes(k))throw Error('安全でないキーを含みます');safeTree(v[k]);}}
 function records(v,label){if(!object(v))throw Error(label+'の形式が不正です');safeTree(v);for(const [k,r] of Object.entries(v)){if(!k||!object(r))throw Error(label+'の記録が不正です');for(const field of ['first','last','source','at','siteId','acquiredAt','basis'])if(own(r,field)&&typeof r[field]!=='string')throw Error(label+'の'+field+'が不正です');}return v;}
 function titleState(v){if(!object(v)||!object(v.awards)||!(v.selected===null||typeof v.selected==='string'))throw Error('称号記録の形式が不正です');records(v.awards,'称号');return v;}
 function canonical(id){const m=String(id).match(/^n:(13209|14151|14152|14153):(.+)$/);return m?(m[1]==='13209'?'m:':'s:')+m[2]:String(id);}
 function municipality(id){id=canonical(id);if(/^[ms]:\d{5}/.test(id)||/^n:\d{5}:/.test(id))return id.slice(2,7);return /^\d{5}$/.test(id)?id:'';}
 function earlier(a,b){if(!a)return b;if(!b)return a;const x=Date.parse(a),y=Date.parse(b);return Number.isFinite(x)&&Number.isFinite(y)?(x<=y?a:b):a;}
 function later(a,b){if(!a)return b;if(!b)return a;const x=Date.parse(a),y=Date.parse(b);return Number.isFinite(x)&&Number.isFinite(y)?(x>=y?a:b):a;}
 function mergeRecord(a,b){const r={...b,...a};for(const k of ['first','at','acquiredAt'])if(a[k]||b[k])r[k]=earlier(a[k],b[k]);if(a.last||b.last)r.last=later(a.last,b.last);return r;}
 function mergeRecords(a,b,normalize=x=>x){const out={};for(const map of [a,b])for(const [raw,r] of Object.entries(map)){const k=normalize(raw);out[k]=own(out,k)?mergeRecord(out[k],r):{...r};}return out;}
 function parseBackup(doc){
  if(!object(doc)||!['walked-backup-v2','walked-backup-v3'].includes(doc.format))throw Error('対応するWALKEDバックアップではありません');
  records(doc.visited,'制覇');
  if(doc.format==='walked-backup-v2')return {visited:doc.visited,cards:{},titles:{awards:{},selected:null},legacy:true};
  records(doc.cards,'カード');titleState(doc.titles);
  return {visited:doc.visited,cards:doc.cards,titles:doc.titles,legacy:false};
 }
 function backup(visited,cards,titles,at=new Date().toISOString()){records(visited,'制覇');records(cards,'カード');titleState(titles);return {format:'walked-backup-v3',createdAt:at,visited:JSON.parse(JSON.stringify(visited)),cards:JSON.parse(JSON.stringify(cards)),titles:JSON.parse(JSON.stringify(titles))};}
 function mergeBackup(current,incoming){const awards=mergeRecords(current.titles.awards,incoming.titles.awards);let selected=current.titles.selected||incoming.titles.selected||null;if(selected&&!own(awards,selected))selected=null;return {visited:mergeRecords(current.visited,incoming.visited,canonical),cards:mergeRecords(current.cards,incoming.cards),titles:{awards,selected}};}
 function catalog(registry){
  const out=nationalNames.map((name,i)=>({id:'national-'+(i+1),kind:'national',name,threshold:i===9?registry.areas.length:nationalThresholds[i]}));
  for(const p of registry.prefectures)for(const [i,percent] of [25,50,75,100].entries())out.push({id:'pref-'+p.code+'-'+percent,kind:'prefecture',name:p.stem+'の'+['国衆','領主','大名','覇者'][i],prefecture:p.code,percent,areaName:p.name,note:p.note});
  for(const r of registry.regions)for(const [i,percent] of [50,80].entries())out.push({id:r.id+'-'+percent,kind:'region',name:r.names[i],prefectures:r.prefectures,percent,areaName:r.name,note:r.note});
  return out;
 }
 function progress(visited,registry){
  const allowed=new Set(registry.areas.map(a=>a.code));const codes=new Set(Object.keys(visited).map(municipality).filter(c=>allowed.has(c)));
  const prefs={};for(const p of registry.prefectures)prefs[p.code]={total:0,count:0};for(const a of registry.areas){prefs[a.prefecture].total++;if(codes.has(a.code))prefs[a.prefecture].count++;}
  return {total:allowed.size,count:codes.size,prefectures:prefs};
 }
 function meets(p,percent){return !!p&&p.total>0&&p.count>=Math.ceil(p.total*percent/100);}
 function qualifies(t,p){return t.kind==='national'?p.total>0&&p.count>=t.threshold:t.kind==='prefecture'?meets(p.prefectures[t.prefecture],t.percent):t.prefectures.every(c=>meets(p.prefectures[c],t.percent));}
 function evaluate(visited,registry,previous,at=new Date().toISOString()){
  const p=progress(visited,registry),all=catalog(registry),awards={...previous.awards},newIds=[];
  for(const t of all)if(qualifies(t,p)&&!own(awards,t.id)){awards[t.id]={acquiredAt:at,basis:registry.version};newIds.push(t.id);}
  // selected:null means the user deliberately chose no title; don't auto-equip.
  return {state:{awards,selected:previous.selected},newIds,progress:p,catalog:all};
 }
 // localStorage is not multi-key atomic. A durable journal allows crash recovery.
 function recover(storage,journalKey){const raw=storage.getItem(journalKey);if(!raw)return;const previous=JSON.parse(raw);if(!object(previous))throw Error('復元保護記録が不正です');for(const [k,v] of Object.entries(previous)){if(v===null)storage.removeItem(k);else if(typeof v==='string')storage.setItem(k,v);else throw Error('復元保護記録が不正です');}storage.removeItem(journalKey);}
 function transaction(storage,values,journalKey){
  const previous={};for(const k of Object.keys(values))previous[k]=storage.getItem(k);
  storage.setItem(journalKey,JSON.stringify(previous));
  try{for(const [k,v] of Object.entries(values))storage.setItem(k,v);storage.removeItem(journalKey);}
  catch(error){try{recover(storage,journalKey);}catch{throw Error('保存に失敗しました。復元保護記録を保持しています。空き容量を確保し再読み込みしてください。');}throw error;}
 }
 return {canonical,municipality,records,titleState,parseBackup,backup,mergeBackup,catalog,progress,qualifies,evaluate,transaction,recover};
});

/* Current-release-only historic card records.
 * Deliberately remove retired/unknown history IDs from saved acquisitions and
 * imported backups. Never guess replacements for revoked cards.
 * The immutable published approval manifest is kept for source audit, not for
 * playable/owned old cards.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.SengokuCardCleanup=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function prune(records,catalog){
  if(!catalog||!(catalog.histories instanceof Map))throw Error('現行承認済みカード一覧の確認が必要です');
  if(!records||typeof records!=='object'||Array.isArray(records))throw Error('保存カードの形式が不正です');
  const kept={},removedIds=[];
  for(const [historyId,record] of Object.entries(records)){
   if(catalog.histories.has(historyId))kept[historyId]=record;
   else removedIds.push(historyId);
  }
  return {records:kept,removedIds};
 }
 return {prune};
});

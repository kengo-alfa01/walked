/* Current-release-only historic card records.
 * Delete both retired IDs and orphan non-place histories. The current game can
 * earn non-place histories only after a place history for the same person.
 * This prevents previously orphaned non-place cards from falsely unlocking a person.
 * All validation is against the unchanged, approved current catalog.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.SengokuCardCleanup=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const own=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);
 function placeOwners(records,catalog){
  const owners=new Set();
  for(const historyId of Object.keys(records)){
   const h=catalog.histories.get(historyId);
   if(h?.kind==='place')owners.add(h.personId);
  }
  return owners;
 }
 function owns(records,catalog,historyId){
  if(!catalog||!(catalog.histories instanceof Map)||!records||!own(records,historyId))return false;
  const h=catalog.histories.get(historyId);
  if(!h)return false;
  return h.kind!=='nonplace'||placeOwners(records,catalog).has(h.personId);
 }
 function prune(records,catalog){
  if(!catalog||!(catalog.histories instanceof Map))throw Error('現行承認済みカード一覧の確認が必要です');
  if(!records||typeof records!=='object'||Array.isArray(records))throw Error('保存カードの形式が不正です');
  const candidates={},removedIds=[];
  for(const [historyId,record] of Object.entries(records)){
   if(catalog.histories.has(historyId))candidates[historyId]=record;
   else removedIds.push(historyId);
  }
  const owners=placeOwners(candidates,catalog),kept={};
  for(const [historyId,record] of Object.entries(candidates)){
   const h=catalog.histories.get(historyId);
   if(h.kind==='nonplace'&&!owners.has(h.personId))removedIds.push(historyId);
   else kept[historyId]=record;
  }
  return {records:kept,removedIds};
 }
 return {prune,owns,placeOwners};
});

(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.MapColoring=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const PALETTE=[
  {name:'ブルー',hex:'#5A9BD5'},
  {name:'グリーン',hex:'#62B28C'},
  {name:'オレンジ',hex:'#E5A45F'},
  {name:'パープル',hex:'#9D8BCB'},
  {name:'ピンク',hex:'#D88DA8'},
  {name:'ターコイズ',hex:'#56B7B3'}
 ];
 const stableHash=s=>{let h=2166136261;for(const c of String(s)){h=Math.imul(h^c.charCodeAt(0),16777619)}return h>>>0;};
 // A planar map always has a vertex of degree <=5. Eliminate it, then color
 // backwards with six choices; adjacent areas can never share an assigned color.
 function assign(ids,adjacency){
  if(!Array.isArray(ids)||!Array.isArray(adjacency)||ids.length!==adjacency.length)throw Error('地域の隣接データが不正です');
  const n=ids.length,index=new Map();
  for(let i=0;i<n;i++){
   const id=String(ids[i]);if(!id||index.has(id))throw Error('地域IDが欠落または重複しています');
   index.set(id,i);
  }
  const neighbors=Array.from({length:n},()=>new Set());
  adjacency.forEach((items,i)=>{
   if(!Array.isArray(items))throw Error('隣接配列が不正です');
   for(const j of items){
    if(!Number.isInteger(j)||j<0||j>=n||i===j)continue;
    neighbors[i].add(j);neighbors[j].add(i);
   }
  });
  const degrees=neighbors.map(x=>x.size),active=new Set(ids.map((_,i)=>i)),removed=[];
  while(active.size){
   let best=-1;
   for(const i of active)
    if(best<0||degrees[i]<degrees[best]||degrees[i]===degrees[best]&&String(ids[i]).localeCompare(String(ids[best]))<0)best=i;
   // Nonplanar or malformed source geometries are not safe to auto-color.
   if(degrees[best]>5)throw Error('この隣接グラフは6色法の条件を満たしません');
   active.delete(best);removed.push(best);
   for(const j of neighbors[best])if(active.has(j))degrees[j]--;
  }
  const numbers=Array(n).fill(-1),usedCounts=Array(PALETTE.length).fill(0);
  for(let k=removed.length-1;k>=0;k--){
   const i=removed[k],forbidden=new Set([...neighbors[i]].map(j=>numbers[j]).filter(c=>c>=0));
   const options=Array.from({length:PALETTE.length},(_,c)=>c).filter(c=>!forbidden.has(c));
   if(!options.length)throw Error('6色以内に割り当てられません');
   const offset=stableHash(ids[i])%PALETTE.length;
   options.sort((a,b)=>usedCounts[a]-usedCounts[b]||((a-offset+6)%6)-((b-offset+6)%6));
   numbers[i]=options[0];usedCounts[options[0]]++;
  }
  const colors=new Map(),links=new Map();
  ids.forEach((id,i)=>{
   id=String(id);colors.set(id,numbers[i]);links.set(id,new Set([...neighbors[i]].map(j=>String(ids[j]))));
  });
  return {colors,neighbors:links};
 }
 function fromTopology(topo,object,topojson){
  if(!object||!Array.isArray(object.geometries)||!topojson||typeof topojson.neighbors!=='function')throw Error('行政境界のTopology構造が不正です');
  const ids=object.geometries.map(g=>String(g.id??g.properties?.code??''));
  return assign(ids,topojson.neighbors(object.geometries));
 }
 function effectiveColor(id,scheme,overrides={}){
  if(Object.prototype.hasOwnProperty.call(overrides,id)&&Number.isInteger(overrides[id])&&overrides[id]>=0&&overrides[id]<PALETTE.length)return overrides[id];
  return scheme?.colors?.get(id);
 }
 function canOverride(id,color,scheme,overrides={}){
  if(!Number.isInteger(color)||color<0||color>=PALETTE.length||!scheme?.colors?.has(id))return false;
  for(const adjacent of scheme.neighbors.get(id)||[])
   if(effectiveColor(adjacent,scheme,overrides)===color)return false;
  return true;
 }
 return Object.freeze({PALETTE,assign,fromTopology,effectiveColor,canOverride});
});

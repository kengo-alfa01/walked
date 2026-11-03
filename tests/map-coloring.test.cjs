const {test}=require('node:test');
const assert=require('node:assert/strict');
const M=require('../map-coloring.js');

test('six-color planar adjacency is deterministic and never repeats on shared edges',()=>{
 assert.equal(M.PALETTE.length,6);
 const width=15,height=12,n=width*height;
 const ids=Array.from({length:n},(_,i)=>String(i).padStart(5,'0'));
 const adjacent=ids.map((_,i)=>{
  const x=i%width,y=Math.floor(i/width);
  return [[x-1,y],[x+1,y],[x,y-1],[x,y+1]].filter(([a,b])=>a>=0&&a<width&&b>=0&&b<height).map(([a,b])=>b*width+a);
 });
 const result=M.assign(ids,adjacent),again=M.assign(ids,adjacent);
 assert.deepEqual([...result.colors],[...again.colors]);
 assert.ok(new Set(result.colors.values()).size<=6);
 for(let i=0;i<n;i++){
  assert.ok(result.colors.get(ids[i])>=0&&result.colors.get(ids[i])<6);
  for(const j of adjacent[i])assert.notEqual(result.colors.get(ids[i]),result.colors.get(ids[j]));
 }
});

test('neighboring prefectures or municipalities cannot be manually assigned the same color',()=>{
 const p=M.assign(['13','14','19'],[[1,2],[0,2],[0,1]]);
 const pref='13',neighbor='14',neighborColor=p.colors.get(neighbor);
 assert.equal(M.canOverride(pref,neighborColor,p,{}),false);
 const allowed=M.PALETTE.map((_,i)=>i).find(i=>M.canOverride(pref,i,p,{}));
 assert.ok(Number.isInteger(allowed));
 assert.equal(M.canOverride(pref,allowed,p,{}),true);
 assert.equal(M.effectiveColor(pref,p,{[pref]:allowed}),allowed);
 assert.equal(M.effectiveColor(pref,p,{}),p.colors.get(pref));
});

test('a sixth distinct color can cover six pairwise adjacent regions',()=>{
 const names=['A','B','C','D','E','F'];
 const neighbors=names.map((_,i)=>names.map((_,j)=>j).filter(j=>j!==i));
 const result=M.assign(names,neighbors);
 assert.equal(new Set(result.colors.values()).size,6);
});

test('TopoJSON geometry IDs are preserved and neighbor edges use shared arcs',()=>{
 const geometries=[{id:'13209'},{id:'14151'},{id:'14152'}];
 const fake={neighbors:gs=>{assert.equal(gs,geometries);return [[1],[0,2],[1]];}};
 const scheme=M.fromTopology({}, {geometries},fake);
 assert.equal(scheme.colors.size,3);
 assert.notEqual(scheme.colors.get('13209'),scheme.colors.get('14151'));
 assert.notEqual(scheme.colors.get('14151'),scheme.colors.get('14152'));
 assert.ok(scheme.neighbors.get('13209').has('14151'));
});

test('invalid topology and non-planar graphs fail closed rather than silently colliding',()=>{
 assert.throws(()=>M.fromTopology({}, {}, {neighbors:()=>[]}),/Topology/);
 assert.throws(()=>M.assign(['a','a'],[[],[]]),/重複/);
 const ids=Array.from({length:7},(_,i)=>String(i));
 const edges=ids.map((_,i)=>ids.map((_,j)=>j).filter(j=>j!==i));
 assert.throws(()=>M.assign(ids,edges),/6色法/);
});

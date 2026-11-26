'use strict';
// Decode only requested geometries from a hash-verified TopoJSON; no fetching or writes.
function features(topology,codes){
 const wanted=new Set(codes),cache=new Map(),transform=topology.transform;
 function arc(n){const i=n<0?~n:n;if(!cache.has(i)){let x=0,y=0;cache.set(i,topology.arcs[i].map(p=>{if(!transform)return p.slice();x+=p[0];y+=p[1];return [x*transform.scale[0]+transform.translate[0],y*transform.scale[1]+transform.translate[1]];}));}const a=cache.get(i);return n<0?[...a].reverse():a;}
 function ring(ns){const out=[];for(const n of ns){const a=arc(n);out.push(...(out.length?a.slice(1):a));}return out;}
 return topology.objects.municipalities.geometries.filter(g=>wanted.has(String(g.id))).map(g=>({type:'Feature',id:String(g.id),properties:g.properties,geometry:{type:g.type,coordinates:g.type==='Polygon'?g.arcs.map(ring):g.arcs.map(p=>p.map(ring))}}));
}
module.exports={features};

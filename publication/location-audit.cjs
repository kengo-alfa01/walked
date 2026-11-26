'use strict';
const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const {features}=require('./geometry.cjs');
function functionSource(html,name){const script=html.split('<script>').at(-1).split('</script>')[0],start=script.indexOf('function '+name+'(');if(start<0)throw Error('Missing app function '+name);let i=script.indexOf('{',start)+1,depth=1;for(;depth;i++){if(script[i]==='{')depth++;if(script[i]==='}')depth--;}return script.slice(start,i);}
function audit(html,boundary,registry,sites){
 const hash=crypto.createHash('sha256').update(boundary).digest('hex');if(hash!==registry.sourceSHA256)throw Error('Boundary version mismatch');
 const ff=features(JSON.parse(boundary),sites.map(s=>s.municipalityCode)),ctx={};vm.createContext(ctx);
 for(const n of ['ringContains','geomContains'])vm.runInContext(functionSource(html,n),ctx);
 return {boundarySHA256:hash,boundarySource:registry.sourceURL,engine:'pinned main index.html geomContains',results:sites.map(s=>({siteId:s.id,municipalityCode:s.municipalityCode,codeInRegistry:registry.areas.some(a=>a.code===s.municipalityCode),point:s.point,pointInMunicipality:!!ff.find(f=>f.id===s.municipalityCode&&ctx.geomContains(s.point,f.geometry))}))};
}
module.exports={audit,functionSource};

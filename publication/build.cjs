'use strict';
const fs=require('node:fs'),path=require('node:path'),{FILES,build}=require('./lib.cjs');
const root=path.resolve(__dirname,'..'),inputFile=path.resolve(process.argv[2]||path.join(__dirname,'releases/20261031-stage1/input.json')),out=path.resolve(process.argv[3]||path.join(__dirname,'generated/20261031-stage1'));
if(out===root||!out.includes(path.sep+'publication'+path.sep))throw Error('Output must stay inside publication/; never write live catalog');
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),base=Object.fromEntries(FILES.map(f=>[f,read(path.join(root,f))]));const result=build(read(inputFile),base,read(path.join(root,'data/title-registry.json')));
const save=(f,x)=>{const dest=path.join(out,f);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,JSON.stringify(x,null,2)+'\n');};
for(const f of FILES)save('delta/'+f,result.delta[f]);
for(const f of ['manifest','records','rejected'])save(f+'.json',result[f]);
console.log(JSON.stringify(result.manifest,null,2));

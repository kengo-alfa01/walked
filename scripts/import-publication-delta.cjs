'use strict';
const fs=require('node:fs'),path=require('node:path');
const {stable}=require('./import-publication.cjs');
const release=require('../publication-import/releases/20261102-line-c/package.json');
const FILES=Object.keys(release.baselineHashes);
const {apply:applyRuntime,validate,RELEASE_SHA}=require('../publication-runtime.js');
function apply(current,p=release){return applyRuntime(current,p);}
if(require.main===module){const root=path.resolve(__dirname,'..'),cur=Object.fromEntries(FILES.map(f=>[f,JSON.parse(fs.readFileSync(path.join(root,f)))])),next=apply(cur);if(process.argv.includes('--write'))for(const f of FILES)if(stable(cur[f])!==stable(next[f]))fs.writeFileSync(path.join(root,f),JSON.stringify(next[f],null,2)+'\n');console.log(JSON.stringify({mode:process.argv.includes('--write')?'applied':'check',counts:Object.fromEntries(FILES.slice(0,4).map(f=>[f,next[f].length])),approvals:release.approvals.length,published:false}));}
module.exports={apply,validate,release,FILES,RELEASE_SHA};

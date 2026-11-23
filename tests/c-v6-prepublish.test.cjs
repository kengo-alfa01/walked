'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const script=path.join(root,'scripts/check-c-v6-prepublish.cjs');
test('frozen ⑥ 764-item manifest agrees with the current 1,835-row baseline',()=>{
 const r=spawnSync(process.execPath,[script,'--check-manifest'],{cwd:root,encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);
 const msg=JSON.parse(r.stdout);
 assert.equal(msg.approvedRows,764);
 assert.equal(msg.sourceReferences,2807);
 assert.equal(msg.status,'MANIFEST_PASS_RELEASE_NOT_BUILT');
});
test('the existing 74-person live payload is NOT accepted as the new 88-person release',()=>{
 const r=spawnSync(process.execPath,[script,'--candidate',path.join(root,'sengoku/v2/approved-c-20261120-new9-80.json')],{cwd:root,encoding:'utf8'});
 assert.notEqual(r.status,0);
 assert.match(r.stderr,/88人/);
});

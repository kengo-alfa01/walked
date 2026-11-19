#!/usr/bin/env node
'use strict';
/* 2026-11-19 C fixed 57: apply ONLY the latest user-approved M:Z / ⑥ version
 * on top of the already published C JSON. Never regenerate from the old 1230/77 snapshot. */
const fs=require('node:fs'), path=require('node:path'),crypto=require('node:crypto');
const root=path.join(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const write=(p,j)=>{const f=path.join(root,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(j,null,2)+'\n');};
const hash=s=>crypto.createHash('sha256').update(String(s),'utf8').digest('hex'),clone=j=>JSON.parse(JSON.stringify(j));
const unique=a=>[...new Set(a)],expect=(ok,msg)=>{if(!ok)throw Error(msg)};
const manifest=read('docs/c-release/20261119-fixed57-approved-manifest.json');
const baseline=read('sengoku/v2/approved-c-20261119.json');
expect(manifest.schema==='walked.c.20261119.fixed57.v1'&&manifest.baseVersion===baseline.version&&manifest.fixedCount===57,'Baseline/manifest version mismatch');
expect(manifest.baseBlobSha==='e89499fb7fa0d6117c7ef59d0cb6917fff175bd5','Release base blob mismatch');
expect(manifest.items.length===57&&manifest.heldFixedIds.length===11,'Fixed scope changed');
expect(manifest.items.filter(i=>i.pin).length===50,'Pin scope changed');
expect(new Set(manifest.items.map(i=>i.fixedId)).size===57,'Duplicate fixed process ID');
expect(manifest.heldFixedIds.every(id=>!manifest.items.some(i=>i.fixedId===id)),'A held item was reintroduced');
const pkg=clone(baseline),sourceProjection=read('docs/c-release/20261119-approved-source-projection.json');
const sourceUrl=new Map(sourceProjection.sources.map(s=>[s.sourceId,s.url]));
const goodUrls=(ids,previous=[])=>unique([...ids.map(id=>sourceUrl.get(id)),...previous].filter(u=>typeof u==='string'&&u.startsWith('https://')));
const sites=new Map(pkg.sites.map(s=>[s.siteId,s]));
const histories=new Map(pkg.histories.map(h=>[h.historyId,h]));
const people=new Map(pkg.people.map(p=>[p.personId,p]));
const relationsBefore=JSON.stringify(pkg.relations),retiredBefore=JSON.stringify(pkg.retiredHistories),holds=new Set(manifest.heldFixedIds);
const status=[],updates=new Set(),municipalityAwards=[];
for(const i of manifest.items){
 expect(i.fixedId.startsWith('CR20261119-')&&!holds.has(i.fixedId)&&i.text&&/^v[1-9]\d*$/.test(i.approvedVersion),'Invalid manifest row '+i.fixedId);
 expect(i.approvedRow>=2&&['経歴','史跡'].includes(i.type),'Approval type/row missing '+i.fixedId);
 const approval={sheetRow:i.approvedRow,version:i.approvedVersion,user:'公開OK',quality:'品質合格',rights:i.rights,
  handoff:'C候補（別途公開承認）',sourceMatch:'一致',sha256:hash(i.text),kind:i.type,personId:i.approvalPersonRaw,sourceId:i.sourceId};
 expect(i.type==='史跡'||i.personIds.length===1,'History approval person missing '+i.fixedId);
 const previousHistory=histories.get(i.sourceId),previousSite=sites.get(i.sourceId);
 if(i.kind==='自治体獲得の実装整合'){
  expect(i.type==='経歴'&&i.history&&!previousSite,'Municipality history malformed '+i.fixedId);
  const r=i.history.relation;
  expect(r&&r.personId===i.personIds[0]&&r.historyId===i.sourceId&&
   ['本人直接','出来事直接（史料）','出来事直接（公的伝承）'].includes(r.classification)&&
   r.bStatus==='合格'&&r.linkDecision==='関係上対象'&&
   i.related.includes(i.history.municipalityCode)&&/^\d{5}$/.test(i.history.municipalityCode),'Unapproved municipality link '+i.fixedId);
  expect(!sites.has(r.siteId),'Non-public source site unexpectedly published; separate review needed '+i.fixedId);
  expect(!previousHistory||previousHistory.kind==='place','Cannot convert an existing nonplace history '+i.fixedId);
  const h={...(previousHistory||{}),historyId:i.sourceId,personId:i.personIds[0],kind:'place',
    title:i.title,text:i.text,yearText:i.history.yearText,
    eventYear:/^\d{3,4}$/.test(i.history.startYear)?Number(i.history.startYear):null,
    eventYearEnd:/^\d{3,4}$/.test(i.history.endYear)?Number(i.history.endYear):null,
    sourceIds:i.sourceIds,sourceUrls:goodUrls(i.sourceIds,previousHistory?.sourceUrls||[]),approval};
  if(i.history.displayOrder!==''&&Number.isFinite(+i.history.displayOrder))h.displayOrder=Number(i.history.displayOrder);
  const award={historyId:i.sourceId,personId:i.personIds[0],municipalityCode:i.history.municipalityCode,
    relationSheetRow:r.sheetRow,relatedSiteId:r.siteId,classification:r.classification,bStatus:r.bStatus,
    linkDecision:r.linkDecision,relationSourceIds:r.sourceIds,approvalRow:i.approvedRow,approvalVersion:i.approvedVersion,
    processId:i.fixedId,historySheetRow:i.history.historySheetRow};
  h.municipalityAward=clone(award);histories.set(i.sourceId,h);
  municipalityAwards.push(award);
 }else{
  expect(i.type==='史跡'&&previousSite&&i.site,'Unpublished/missing site '+i.fixedId);
  const s=previousSite;
  // Keep prior ID, existing associations, coordinate history and acquire-on-visit links.
  const evidenceOwners=new Set(pkg.relations.filter(r=>r.siteId===i.sourceId&&r.bStatus==='合格'&&r.linkDecision==='関係上対象').map(r=>r.personId));
  for(const owner of i.personIds)
   expect(s.personIds.includes(owner)||evidenceOwners.has(owner),'New site owner lacks existing B-approved relation '+i.fixedId+':'+owner);
  s.personIds=unique([...s.personIds,...i.personIds]);
  s.approvedPersonIds=[...i.personIds]; // Do not write to ⑥M or infer its blank contents.
  s.name=i.title;s.description=i.text;s.approval=approval;
  s.sourceIds=i.sourceIds.length?i.sourceIds:s.sourceIds;
  s.sourceUrls=goodUrls(s.sourceIds,s.sourceUrls||[]);
  if(i.kind==='承認済み名称版の反映'){
   expect(!i.pin&&i.approvedRow===3564&&i.approvedVersion==='v5'&&
    i.title==='新高山城跡（小早川隆景の居城）','New Takayama version mismatch');
   // This site has an OLD independently approved pin; keep its GPS, B color, historical pin approval.
   if(s.publicPin&&s.pinApproval&&s.pinApproval.sha256!==approval.sha256&&
      !s.pinApprovalText)s.pinApprovalText=previousSite.description===i.text?'':baseline.sites.find(x=>x.siteId===s.siteId).description;
  }else{
   expect(i.pin&&i.pin.isNew===true&&s.publicPin===false&&s.point===null,'Unintended pin overwrite '+i.fixedId);
   expect(i.pin.sourceSheetRow===i.site.sourceSheetRow&&
    ['green','yellow','red'].includes(i.pin.accessStatus)&&Number.isFinite(i.pin.lat)&&Number.isFinite(i.pin.lng),'Missing approved GPS or access '+i.fixedId);
   const pinOwners=unique(i.personIds.length?i.personIds:
     (evidenceOwners.size?[...evidenceOwners]:[...s.personIds]));
   expect(pinOwners.length>0&&pinOwners.every(owner=>s.personIds.includes(owner)),'Unapproved pin owner '+i.fixedId);
   s.publicPin=true;s.point=[i.pin.lng,i.pin.lat];s.pinApproval=clone(approval);
   s.pinPersonIds=pinOwners;delete s.pinApprovalText;
   const common='史跡に関する歴史情報の参照点です。人物が実際に立った場所や安全な入口・見学経路を示すものではありません。現地の案内と立入制限に従ってください。';
   const special={
    'CR20261119-036':'旧城域は採石で消失しています。採石区域、急崖、私有地へ立ち入らず、現地見学や登山の経路として利用しないでください。',
    'CR20261119-043':'一部区域に立入制限があります。見学可能範囲と現地の案内に従ってください。',
    'CR20261119-046':'史跡案内所付近の情報参照点です。史跡本体内部、果樹園、民家や私有地への立入案内ではありません。',
    'CR20261119-048':'九戸政実斬首伝承地の情報参照点です。伝承地は史実の断定ではなく、施設内部や私有地への入場を案内しません。',
    'CR20261119-063':'館跡の歴史情報参照点であり、庭園の入口を示しません。庭園の指定園路と見学時間に従い、発掘・管理区域、民有地へ立ち入らないでください。'
   }[i.fixedId]||'';
   s.pinReview={decision:'可',accessStatus:i.pin.accessStatus,sourceSheetRow:i.pin.sourceSheetRow,
    municipality:i.site.municipalityName,locationKind:'B確認済みの史跡歴史情報参照点（安全な入口ではありません）',
    checkedAt:i.pin.checkedAt,
    restriction:i.pin.accessStatus==='green'?'':(special?special+' ':'')+common,
    officialInfoUrl:s.sourceUrls[0]||null,positionEvidenceUrl:s.sourceUrls.at(-1)||null,
    positionSourceIds:unique(i.site.sourceIds.length?i.site.sourceIds:i.sourceIds),
    approvedE:i.pin.evidence,pinProcessId:i.fixedId};
   s.pinOwnerEvidence=i.personIds.length?{approvalRow:i.approvedRow,personIds:[...i.personIds]}:
      {approvalRow:i.approvedRow,personIds:[],priorSitePersonIds:[...s.personIds],
       bQualifiedRelationPersonIds:[...evidenceOwners],noNewAcquisitionLinks:true};
  }
 }
 status.push({fixedId:i.fixedId,sourceId:i.sourceId,approvalRow:i.approvedRow,approvalVersion:i.approvedVersion,
  action:i.kind,approvalSHA256:approval.sha256,changedFromPrior:JSON.stringify(previousHistory||previousSite)!==JSON.stringify(i.type==='経歴'?histories.get(i.sourceId):sites.get(i.sourceId))});
 updates.add(i.sourceId);
}
expect(municipalityAwards.length===6&&status.length===57,'Processing incomplete');
pkg.histories=[...histories.values()];
pkg.municipalityAwards=municipalityAwards;
// Five added histories / one existing history updated. Recalculate unlock only for people affected.
for(const pid of unique(municipalityAwards.map(r=>r.personId))){
 const p=people.get(pid);expect(!!p?.story?.unlock,'Missing approved biography '+pid);
 const hs=pkg.histories.filter(h=>h.personId===pid);
 p.story.unlock={requiredHistoryCount:hs.length,requiredPlaceHistoryCount:hs.filter(h=>h.kind==='place').length,
  historyIdsSHA256:hash(hs.map(h=>h.historyId).sort().join('\n'))};
}
pkg.version='v2-approved-c-20261119-57';
pkg.notes={...pkg.notes,cRelease:{...pkg.notes.cRelease,fixedBatchId:'C-20261119-57',
  baseVersion:manifest.baseVersion,baseCommit:manifest.baseCommit,baseBlobSha:manifest.baseBlobSha,
  approvedIds:manifest.items.map(i=>i.fixedId),heldIds:manifest.heldFixedIds,addedPinCount:50,
  municipalityAwardCount:6,preserveHistoricalPinApproval:true}};
const oldSites=new Map(baseline.sites.map(s=>[s.siteId,s]));
const oldHists=new Map(baseline.histories.map(h=>[h.historyId,h]));
const lost=baseline.histories.filter(h=>!histories.has(h.historyId)).map(h=>h.historyId);
expect(!lost.length&&pkg.histories.length===baseline.histories.length+5,'Historic content loss/addition mismatch');
expect(pkg.sites.length===baseline.sites.length&&pkg.people.length===baseline.people.length,'Non-scoped entity count change');
expect(pkg.sites.filter(s=>s.publicPin).length===baseline.sites.filter(s=>s.publicPin).length+50,'Pin total mismatch');
expect(relationsBefore===JSON.stringify(pkg.relations)&&retiredBefore===JSON.stringify(pkg.retiredHistories),'Relations or prior retired history mutated');
for(const s of pkg.sites)if(!updates.has(s.siteId))expect(JSON.stringify(s)===JSON.stringify(oldSites.get(s.siteId)),'Out-of-scope site changed '+s.siteId);
for(const h of pkg.histories)if(oldHists.has(h.historyId)&&!updates.has(h.historyId))
 expect(JSON.stringify(h)===JSON.stringify(oldHists.get(h.historyId)),'Out-of-scope history changed '+h.historyId);
const completedIds=status.map(x=>x.fixedId);
const audit={baseVersion:manifest.baseVersion,releaseVersion:pkg.version,baseCommit:manifest.baseCommit,
  fixedCount:57,completedCount:completedIds.length,completedIds,heldCount:11,heldIds:manifest.heldFixedIds,
  historyUpdates:municipalityAwards.length,addedHistories:5,existingHistoryUpdates:1,nameBodyUpdates:1,
  approvedPinUpdates:50,counts:{people:pkg.people.length,histories:pkg.histories.length,
    sites:pkg.sites.length,pins:pkg.sites.filter(s=>s.publicPin).length,relations:pkg.relations.length,
    retiredHistories:pkg.retiredHistories.length},
  preservation:{priorSitesKept:true,priorHistoryIdsKept:true,priorPublishedPinsKept:true,
    retiredHistoriesUnchanged:true,relationsUnchanged:true,heldUnchanged:true,noUnapprovedPins:true},
  completed:status,municipalityAwards};
write('sengoku/v2/approved-c-20261119-57.json',pkg);
write('docs/c-release/20261119-fixed57-delta-qa.json',audit);
console.log('C_FIXED57_BUILT',JSON.stringify({version:pkg.version,counts:audit.counts,complete:status.length,held:11}));

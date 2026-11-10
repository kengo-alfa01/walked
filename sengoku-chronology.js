/* 日本見風録: opt-in, approval-gated chronology; no card/storage mutations. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.SengokuChronology=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const SCHEMA='walked.sengoku.chronology.v1';
  const Q_SCHEMA='walked.sengoku.chronology.snapshot.v1';
  const SOURCE='1KirrKgmmK6j9boIzsOGlGqFAGVK7t8K5yoDvWsxfSsw';
  const TIE_NOTE='同年の出来事。前後関係は確定していません。';
  const TYPES=new Set(['confirmed-date','confirmed-causality','life-before-death','death-before-funeral','death-before-burial','death-before-reburial','posthumous-sequence']);
  const own=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
  function check(condition,reason){if(!condition)throw Error('時系列承認ゲート: '+reason);}
  function obj(x){return x!==null&&typeof x==='object'&&!Array.isArray(x);}
  function canonical(x){
    if(Array.isArray(x))return x.map(canonical);
    if(obj(x))return Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])]));
    return x;
  }
  function digest(hash,x){
    check(typeof hash==='function','SHA-256関数が必要です');
    const d=hash(JSON.stringify(canonical(x)));
    check(typeof d==='string'&&/^[0-9a-f]{64}$/.test(d),'SHA-256の結果が不正です');
    return d;
  }
  function same(a,b){return JSON.stringify(canonical(a))===JSON.stringify(canonical(b));}
  function validYear(y){return Number.isInteger(y)&&y>=1&&y<=9999;}
  function key(row){return row.personId+'|'+row.startYear;}
  function pairKey(row){return key(row)+'|'+row.displayOrder;}
  function rowWire(r){
    return {historyId:r.historyId,personId:r.personId,startYear:r.startYear,
      endYear:r.endYear,displayOrder:r.displayOrder,tieStatus:r.tieStatus,
      yearText:r.yearText,phase:r.phase,tieReason:r.tieReason,tieEvidenceIds:r.tieEvidenceIds};
  }
  function sortForHash(rows){return rows.map(rowWire).sort((a,b)=>a.historyId.localeCompare(b.historyId));}
  function constraintWire(c){
    return {beforeId:c.beforeId,afterId:c.afterId,type:c.type,
      evidenceIds:c.evidenceIds,bVerified:c.bVerified,calendarBasis:c.calendarBasis};
  }
  function sortConstraints(cs){return cs.map(constraintWire).sort((a,b)=>
    (a.beforeId+'|'+a.afterId+'|'+a.type).localeCompare(b.beforeId+'|'+b.afterId+'|'+b.type));}
  function before(a,b){
    return a.startYear<b.startYear||(a.startYear===b.startYear&&
      Number.isInteger(a.displayOrder)&&Number.isInteger(b.displayOrder)&&a.displayOrder<b.displayOrder);
  }

  /* Structured A/B rows only. Neither event IDs nor date strings determine chronology. */
  function validateRows(rows,constraints,hash){
    check(Array.isArray(rows)&&rows.length>0,'②経歴の順序行がありません');
    check(Array.isArray(constraints),'A/B順序制約の配列がありません');
    const byId=new Map(),years=new Map();
    for(const [i,r] of rows.entries()){
      check(obj(r)&&typeof r.historyId==='string'&&r.historyId&&typeof r.personId==='string'&&r.personId,'経歴ID・人物ID不足');
      check(!byId.has(r.historyId),'経歴ID重複 '+r.historyId);
      check(validYear(r.startYear),'開始年が不正 '+r.historyId);
      check(r.endYear===null||validYear(r.endYear)&&r.endYear>=r.startYear,'終了年が不正 '+r.historyId);
      check(typeof r.yearText==='string'&&r.yearText&&typeof r.phase==='string'&&r.phase,'年次表示・物語段階がありません '+r.historyId);
      check(r.displayOrder===null||Number.isSafeInteger(r.displayOrder)&&r.displayOrder>0,'Tは正の整数・単年1件のみ空欄 '+r.historyId);
      check(r.tieStatus===null||r.tieStatus==='unresolved','同順位理由が不正 '+r.historyId);
      check(r.tieReason===null||typeof r.tieReason==='string','同順位根拠が不正 '+r.historyId);
      check(Array.isArray(r.tieEvidenceIds)&&r.tieEvidenceIds.every(v=>typeof v==='string'&&v.trim()),'同順位の出典IDが不正 '+r.historyId);
      byId.set(r.historyId,{...r,_index:i});
      const groupKey=key(r);if(!years.has(groupKey))years.set(groupKey,[]);
      years.get(groupKey).push(r);
    }
    const tieEntries=new Map(),yearHashes=new Map();
    for(const [groupKey,group] of years){
      if(group.length>1)check(group.every(r=>Number.isSafeInteger(r.displayOrder)&&r.displayOrder>0),'同一年複数件でT未設定 '+groupKey);
      else check(group[0].displayOrder===null||group[0].displayOrder>0,'単一年のT不正 '+groupKey);
      const byRank=new Map();
      for(const r of group){if(!byRank.has(r.displayOrder))byRank.set(r.displayOrder,[]);byRank.get(r.displayOrder).push(r);}
      for(const [rank,tied] of byRank){
        if(tied.length>1){
          check(rank!==null&&tied.every(r=>r.tieStatus==='unresolved'&&r.tieReason?.trim()&&r.tieEvidenceIds.length>0),
            '同順位の留保・②Sの理由・⑤出典IDがありません '+groupKey+' / '+rank);
          tieEntries.set(groupKey+'|'+rank,tied.map(r=>r.historyId));
        }else check(tied[0].tieStatus===null&&tied[0].tieReason===null&&tied[0].tieEvidenceIds.length===0,
          '単独経歴に未確定同順位が付いています '+tied[0].historyId);
      }
      yearHashes.set(groupKey,digest(hash,sortForHash(group)));
    }
    const constrained=new Set();
    for(const c of constraints){
      check(obj(c)&&TYPES.has(c.type),'制約種別が不正');
      check(c.beforeId!==c.afterId&&byId.has(c.beforeId)&&byId.has(c.afterId),'制約の経歴IDが不正');
      check(byId.get(c.beforeId).personId===byId.get(c.afterId).personId,'制約が別人物へまたがっています');
      check(c.bVerified===true&&Array.isArray(c.evidenceIds)&&c.evidenceIds.length>0&&
        c.evidenceIds.every(x=>typeof x==='string'&&x.trim()),'B確認済みの根拠がありません');
      if(c.type==='confirmed-date')check(typeof c.calendarBasis==='string'&&c.calendarBasis.trim(),'旧暦・新暦の照合記録がありません');
      const ck=c.beforeId+'|'+c.afterId+'|'+c.type;
      check(!constrained.has(ck),'同じ制約を重複登録 '+ck);constrained.add(ck);
      check(before(byId.get(c.beforeId),byId.get(c.afterId)),'確定前後関係の逆転・同順位 '+ck);
    }
    // Only structured ②F phases: never derive a death event from title/body/site keywords.
    const people=new Map();
    for(const r of byId.values()){if(!people.has(r.personId))people.set(r.personId,[]);people.get(r.personId).push(r);}
    for(const [personId,entries] of people){
      const deaths=entries.filter(r=>r.phase==='死去');
      check(deaths.length<=1,'本人の死去区分が複数 '+personId);
      const death=deaths[0];
      if(death){
        for(const r of entries){
          if(r.historyId===death.historyId)continue;
          if(r.phase==='没後')check(before(death,r),'没後行事が本人死去と逆転・同順位 '+r.historyId);
          else check(before(r,death),'生前活動が本人死去と逆転・同順位 '+r.historyId);
        }
      }else check(!entries.some(r=>r.phase==='没後'),'死去区分のない人物に没後記録 '+personId);
    }
    const ordered=[...byId.values()].sort((a,b)=>
      a.startYear-b.startYear||(a.displayOrder??0)-(b.displayOrder??0)||a._index-b._index);
    return {ordered,byId,years,tieEntries,yearHashes,
      rowsSha256:digest(hash,sortForHash(rows)),constraintsSha256:digest(hash,sortConstraints(constraints))};
  }
  function snapshotFor(row,verified,review){
    return {schemaVersion:Q_SCHEMA,personId:row.personId,historyId:row.historyId,
      startYear:row.startYear,endYear:row.endYear,displayOrder:row.displayOrder,
      tieStatus:row.tieStatus,yearGroupSha256:verified.yearHashes.get(key(row)),
      bReviewId:review.reviewId,bRowsSha256:review.rowsSha256,bConstraintsSha256:review.constraintsSha256};
  }
  function versionNumber(version){const m=/^v([1-9]\d*)$/.exec(version||'');return m?Number(m[1]):0;}
  function verifyRelease(release,catalog,hash,options={}){
    check(obj(release)&&typeof release.personId==='string'&&release.personId,'人物単位の順序版がありません');
    check(!release.testFixture||options.allowTestFixtures===true,'テスト用の仮承認を本番取り込みできません');
    check(catalog&&catalog.histories instanceof Map,'既存の承認済み経歴がありません');
    const rows=release.histories,verified=validateRows(rows,release.constraints,hash);
    const old=[...catalog.histories.values()].filter(h=>h.personId===release.personId);
    check(old.length===rows.length&&old.length>0,'人物の全経歴が揃っていません '+release.personId);
    const oldById=new Map(old.map(h=>[h.historyId,h]));
    check(rows.every(r=>r.personId===release.personId&&oldById.has(r.historyId)),'人物・経歴ID集合不一致');
    for(const r of rows){
      const h=oldById.get(r.historyId);
      check(r.startYear===h.eventYear&&r.endYear===(h.eventYearEnd??null)&&r.yearText===h.yearText,'②I/J/Bが既存経歴と不一致 '+r.historyId);
    }
    const review=release.bReview;
    check(obj(review)&&review.status==='合格'&&review.reviewedBy==='B'&&
      typeof review.reviewId==='string'&&review.reviewId.trim(),'B独立時系列審査が未完了');
    check(review.rowsSha256===verified.rowsSha256&&review.constraintsSha256===verified.constraintsSha256,
      'B審査時のT値・前後制約と現在のT値が異なります');
    check(Array.isArray(review.coveredHistoryIds)&&same([...review.coveredHistoryIds].sort(),rows.map(r=>r.historyId).sort()),
      'Bの確認対象経歴に漏れがあります');
    check(Array.isArray(release.approvals)&&release.approvals.length===rows.length,'⑥の順位新版が一部未承認');
    const approvalById=new Map();
    for(const a of release.approvals){
      check(obj(a)&&!approvalById.has(a.historyId)&&oldById.has(a.historyId),'⑥承認のID重複・対象外');
      approvalById.set(a.historyId,a);
    }
    for(const r of rows){
      const a=approvalById.get(r.historyId),h=oldById.get(r.historyId);
      check(!!a,'⑥承認がありません '+r.historyId);
      check(a.personId===r.personId&&a.sheetRow>h.approval.sheetRow&&Number.isSafeInteger(a.sheetRow)&&
        versionNumber(a.version)>versionNumber(h.approval.version),'⑥の新規版・人物・承認行が不正 '+r.historyId);
      check(a.user==='公開OK'&&a.sourceMatch==='一致'&&a.handoff==='C候補（別途公開承認）'&&a.latest===true,
        '⑥最新版のユーザー承認・P照合が未完了 '+r.historyId);
      check(a.textSha256===h.approval.sha256,'⑥本文ハッシュと既存承認本文が不一致 '+r.historyId);
      check(same(a.qSnapshot,snapshotFor(r,verified,review)),'⑥Q順位スナップショットが②T/B審査と不一致 '+r.historyId);
    }
    const tieById=new Map(),orderIds=verified.ordered.map(r=>r.historyId);
    for(const [groupKey,ids] of verified.tieEntries){
      const sorted=verified.ordered.filter(r=>ids.includes(r.historyId)).map(r=>r.historyId);
      for(const [i,id] of sorted.entries())tieById.set(id,{group:groupKey,first:i===0,size:sorted.length});
    }
    return {personId:release.personId,orderIds,tieById,rowsById:verified.byId,
      reviewId:review.reviewId,rowsSha256:verified.rowsSha256};
  }
  function loadManifest(manifest,catalog,hash,options={}){
    check(obj(manifest)&&manifest.schemaVersion===SCHEMA&&manifest.sourceSpreadsheetId===SOURCE&&Array.isArray(manifest.releases),
      '順序版マニフェストのスキーマ・正本が違います');
    const byPerson=new Map();
    for(const release of manifest.releases){
      check(!byPerson.has(release.personId),'同じ人物の順序版が複数あります');
      byPerson.set(release.personId,verifyRelease(release,catalog,hash,options));
    }
    return byPerson;
  }
  function present(legacyHistories,view){
    if(!view)return [...legacyHistories].sort((a,b)=>
      (a.eventYear??9999)-(b.eventYear??9999)||a.historyId.localeCompare(b.historyId));
    const byId=new Map(legacyHistories.map(h=>[h.historyId,h]));
    check(byId.size===view.orderIds.length&&view.orderIds.every(id=>byId.has(id)),'公開経歴リストと順序版のIDが異なります');
    return view.orderIds.map(id=>byId.get(id));
  }
  return {SCHEMA,Q_SCHEMA,SOURCE,TIE_NOTE,digest,validateRows,snapshotFor,verifyRelease,loadManifest,present};
});

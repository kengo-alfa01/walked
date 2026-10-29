#!/usr/bin/env python3
"""Integrate the dated evidence round into review candidates, then export all 624 rows.

No master, registry, production data, or approval is written. --apply-round is an
explicit, idempotent update of research-review only; later unrelated edits abort it.
"""
import argparse
import collections
import copy
import hashlib
import json
import re
from generate_sengoku_master import ROOT, load, dump, csvout

ROUND = ROOT / 'migration/research/20261028'
OUT = ROOT / 'migration/reports/person-quality-20261028'
LABELS = {
    'verified':'確認済み（記載した範囲）', 'unverified':'未確認',
    'partially_verified':'一部確認', 'disputed':'異説あり',
    'calendar_basis_requires_review':'暦の基準・換算要確認',
    'secondary_source_checked':'辞典本文確認・追加照合待ち',
    'requires_review':'利用条件未確認', 'requires_correction':'要修正・判断待ち',
    'unchanged_appropriate':'変更不要（文章品質のみ）',
    'provisional_masanari_not_all_hanzo_holders':'正成へ暫定対応・襲名全体の同定未完',
    'legacy_unverified':'旧値継承・未確認',
}
FIELDS = [('name','人物名'),('identity','同一性'),('aliases','別名'),('birth','生年'),
          ('death','没年'),('biography','事績'),('biographyQuality','略歴品質'),
          ('sourceRelevance','出典本文'),('license','利用条件')]

def evidence_sha(v):
    v = [str(x or '') for x in v] + [''] * 23
    return hashlib.sha256(json.dumps(v[:7] + v[9:16] + v[20:22], ensure_ascii=False).encode()).hexdigest()

def validate_round(data, rows):
    for k, p in data['people'].items():
        assert k in rows, f'unselected person {k}'
        if p.get('biography'):
            assert 50 <= len(p['biography']) <= 100, k
            assert p.get('bodyForSelectedPerson', True), k
            assert any(c['field'] == 'biography' and c['status'] == 'verified' for c in p['claims']), k
        for c in p['claims']:
            assert c['sourceIds'], (k, c)
            assert all(s in data['sources'] and data['sources'][s]['access'] == 'body_read' for s in c['sourceIds']), (k,c)
    assert all(a['rosterId'] in rows for a in data['attempts'])

def merged_review(data, prior, rows):
    result = copy.deepcopy(prior)
    for k, p in data['people'].items():
        # A same-name page about another generation is not positive person evidence.
        if not p.get('bodyForSelectedPerson', True):
            continue
        rv = result['people'].setdefault(k, {})
        fs = rv.setdefault('fieldStatus', {})
        for c in p['claims']:
            fs[c['field']] = c['status']
            if c['field'] in ('birth','death'):
                prefix = c['field'].title()
                if c.get('value') is not None and c['status'] == 'verified':
                    rv['confirmed' + prefix + 'Value'] = c['value']
                candidates = c.get('candidateYears', [])
                if candidates:
                    key = 'additional' + prefix + 'Candidates'
                    rv[key] = sorted(set(rv.get(key, []) + candidates))
        if p.get('biography'):
            rv['biography'] = p['biography']
            fs['biographyQuality'] = 'verified'
        elif p.get('biographyQuality'):
            fs['biographyQuality'] = p['biographyQuality']
        fs['sourceRelevance'] = 'partially_verified'
        rv['verifiedAliases'] = list(dict.fromkeys(rv.get('verifiedAliases', []) + p['verifiedAliases']))
        ids = list(dict.fromkeys(s for c in p['claims'] for s in c['sourceIds']))
        rv['sources'] = list(dict.fromkeys(rv.get('sources', []) + [data['sources'][s]['url'] for s in ids]))
        rv['note'] = '\n'.join(x for x in [rv.get('note',''), data['reviewedOn'] + '追記：' + p['note']] if x)
        rv.update(reviewedOn=data['reviewedOn'], masterEvidenceSha256=evidence_sha(rows[k]),
                  method='Field-specific source body review; independently written proposal; not full historical or commercial clearance.',
                  evidenceRef=f"migration/research/{data['round']}/evidence.json#/people/{k}",
                  approvalStatus='pending_user_review', approvalDate=None)
        if any(c['field'] == 'license' for c in p['claims']):
            rv['licenseStatus'] = 'partially_verified'
    return result

def export():
    data, baseline, prior = (load(ROUND/f) for f in ['evidence.json','baseline.json','prior-review.json'])
    snapshot = load(ROOT/'migration/input/master-snapshot.json')
    rows = {str(r['values'][8]):r['values'] for r in snapshot['rows']}
    validate_round(data,rows)
    people = load(ROOT/'migration/generated/people.json')
    assert len(people) == len(rows) == 624
    bykey = {p['selection']['rosterId']:p for p in people}
    before = set(baseline['reviewedIds'])
    started_before = set(baseline.get('startedIds', baseline['reviewedIds']))
    before_bios = set(baseline['biographyIds'])
    body = {k for k,p in data['people'].items() if p.get('bodyForSelectedPerson',True)}
    attempted = set(data['people']) | {a['rosterId'] for a in data['attempts']}
    started = started_before | attempted
    bios = {k for k,p in data['people'].items() if p.get('biography')}
    assert not (bios & before_bios), 'round must not relabel prior proposals as newly written'
    attempts = {**baseline.get('priorAttempts',{}), **{a['rosterId']:a for a in data['attempts']}}
    cards = collections.Counter(r['personId'] for r in load(ROOT/'migration/generated/cards.json'))
    links = collections.Counter(r['personId'] for r in load(ROOT/'migration/generated/links.json'))
    collisions = collections.Counter(pid for r in load(ROOT/'migration/generated/alias-collisions.json') for pid in r['personIds'])
    table, revisions, issues, queue, claims = [], [], [], [], []
    priority_ids = {'542','1640','18','311','312','1755','1749','1839','1394','48','1840','1765','1046','1053','170','205','460','538'}
    for p in people:
        k = p['selection']['rosterId']; v=rows[k]; r=data['people'].get(k,{})
        fs=p['fieldStatus']; rv=p['researchReview']; legacy=prior['people'].get(k,{})
        cycle = '今回新規本文確認' if k in body-before else '既存確認を今回拡張' if k in body else '既存PR確認（今回未再読）' if k in before else '調査着手・対象本人の本文未確認' if k in started else '未調査（自動課題抽出のみ）'
        bio_class = '今回新規改稿' if k in bios else f'既存{len(before_bios)}件' if k in before_bios else '変更不要案（史実全確認ではない）' if r.get('biographyQuality') else '改稿保留（資料・同一性の確認不足）' if k in started else '未調査・改稿案なし'
        results = lambda f: ' ／ '.join(c['result'] for c in r.get('claims',[]) if c['field']==f) or ('既存PRの確認状態を継承。個別資料箇所は旧記録参照' if legacy.get('fieldStatus',{}).get(f,'unverified') != 'unverified' else '未確認')
        unresolved = []
        for f,label in FIELDS:
            if fs.get(f,'unverified') != 'verified':
                unresolved.append(label+':'+LABELS.get(fs.get(f,'unverified'),fs.get(f,'unverified')))
        note = r.get('note') or rv.get('note') or attempts.get(k,{}).get('reason','本文調査未着手。元シートの確認申告を独立確認へ昇格しない。')
        quality = LABELS.get(fs.get('biographyQuality','unverified'),'未確認')
        if k in before_bios and k not in bios:
            quality='既存改稿案あり・今回文章再審査なし'
        used = list(dict.fromkeys(s for c in r.get('claims',[]) for s in c['sourceIds']))
        urls = [data['sources'][s]['url'] for s in used] if used else legacy.get('sources',[])
        source_kind = '今回本文実読（対象本人への帰属は未確認）' if r and k not in body else '今回本文実読' if used else '既存PR確認記録・今回未再読' if urls else '本文未確認'
        approval_sha = evidence_sha(v)
        row={'名簿ID':k,'人物ID':p['id'],'人物名':v[0],'調査区分':cycle,'優先度':'P0' if k in priority_ids else 'P1' if 'mechanical_biography_rewrite_needed' in p['qualityIssues'] else 'P2',
             '既存略歴':v[4],'改稿後の略歴案':rv.get('biography',''),'改稿区分':bio_class,
             '生年（既存）':v[2],'生年（確認結果）':results('birth'),'生年候補（元値保持）':p['birth']['candidates'],
             '没年（既存）':v[3],'没年（確認結果）':results('death'),'没年候補（元値保持）':p['death']['candidates'],
             '暦・精度の基準':'出典の西暦年表示（年単位）。旧暦日付から先発グレゴリオ暦への独立換算は未実施。候補列は元値からの機械抽出を含むため、確定説の一覧ではない。',
             '別名・通称（既存）':v[1],'別名・通称（確認結果）':results('aliases'),
             '確認した史実・修正理由':' ／ '.join(c['result'] for c in r.get('claims',[]) if c['field'] in ('name','identity','biography')) or (legacy.get('note') or note),
             '出典URL（確認記録）':urls,'正本出典URL（未再読含む）':v[5],
             '出典記録区分':source_kind,'確認日':data['reviewedOn'] if k in attempted else legacy.get('reviewedOn',baseline.get('priorAttemptDate','') if k in started_before else ''),
             **{label+'状態':LABELS.get(fs.get(f,'unverified'),fs.get(f,'unverified')) for f,label in FIELDS},
             '略歴品質状態':quality,'利用条件・転載リスク':'今回案は独自文章・画像なし。'+('一部資料の方針を確認。他の資料と個別権利は未確認。' if fs.get('license')=='partially_verified' else '参照資料の個別利用条件は未確認。')+'既存Wikipedia由来部分の帰属・CC BY-SA条件は継承して要確認。',
             '未解決事項':' ／ '.join(unresolved)+' ／ '+note,'総合判定':'未完了・修正候補は承認待ち' if rv.get('biography') else '未完了',
             '既存カード数':cards[p['id']],'既存史跡関連数':links[p['id']], '別名候補衝突語数':collisions[p['id']],
             '承認状態':'未承認','承認する項目（ユーザー記入）':'','承認者・日付（ユーザー記入）':'','正本根拠SHA256':approval_sha,'正本反映':'未実施'}
        table.append(row)
        if rv.get('biography'):
            revisions.append({key:row[key] for key in ['名簿ID','人物ID','人物名','改稿区分','既存略歴','改稿後の略歴案','確認した史実・修正理由','出典URL（確認記録）','確認日','略歴品質状態','承認状態','正本反映']})
        issues.append({'重要度':row['優先度'],'名簿ID':k,'人物名':v[0],'区分':cycle,'課題':note,'項目別残課題':unresolved,'次の作業':attempts.get(k,{}).get('next','別名の世代・出典別年代・不足する本文・利用条件を照合。承認された項目のみ後日正本へ反映。'),'参照':urls})
        mechanical='mechanical_biography_rewrite_needed' in p['qualityIssues']
        uncertain=any(fs.get(f) in ('disputed','calendar_basis_requires_review','requires_correction') for f in ('birth','death','identity')) or any(x in p['qualityIssues'] for x in ['unknown_or_disputed_year_preserve_raw','identity_or_legend_caution_in_source_notes'])
        queue.append({'名簿ID':k,'人物名':v[0],'重要度':row['優先度'],'機械的略歴改稿が残る':mechanical,'年代・人物識別に注意':uncertain,'同名別名候補衝突数':collisions[p['id']],'カード数':cards[p['id']],'史跡関連数':links[p['id']],'調査区分':cycle,'次の論点':note})
        for c in r.get('claims',[]):
            for sid in c['sourceIds']:
                s=data['sources'][sid]
                claims.append({'記録区分':'今回本文確認' if k in body else '同名別世代・誤帰属防止の調査記録','名簿ID':k,'人物名':v[0],'項目':c['field'],'確認状態':c['status'],'確認結果（独自要約）':c['result'],'資料ID':sid,'資料名':s['title'],'URL':s['url'],'確認箇所':s['locator'],'資料種別':s['kind'],'確認日':s['checkedOn'],'利用条件':s['reuseStatus'],'資料本文の転載':'なし'})
    queue.sort(key=lambda q:(q['重要度'],not q['機械的略歴改稿が残る'],not q['年代・人物識別に注意'],not bool(q['同名別名候補衝突数']),-(q['カード数']+q['史跡関連数']),int(q['名簿ID'])))
    issues.sort(key=lambda q:(q['重要度'],int(q['名簿ID'])))
    for filename,records in [('review-624.csv',table),('biography-comparison.csv',revisions),('unresolved.csv',issues),('priority-queue.csv',queue),('evidence-by-field.csv',claims)]:
        csvout(OUT/filename,records,list(records[0]))
    csvout(OUT/'biographies-new.csv',[r for r in revisions if r['改稿区分']=='今回新規改稿'],list(revisions[0]))
    csvout(OUT/f'biographies-prior-{len(before_bios)}.csv',[r for r in revisions if r['改稿区分']==f'既存{len(before_bios)}件'],list(revisions[0]))
    def count(fs,fields,states=('verified',)):
        return sum(all(s.get(f) in states for f in fields) for s in fs.values())
    old_fs=baseline['fieldStatus']; new_fs={k:p['fieldStatus'] for k,p in bykey.items()}
    metrics={'date':data['reviewedOn'],'selected':624,'automatedTriageOnlyNotResearch':624,
             'researchStarted':len(started),'researchStartedNew':len(attempted-started_before),
             'sourceBodyPeople':len(before|body),'sourceBodyPeopleNew':len(body-before),'sourceBodyRevisited':len(body&before),'sourceBodyPeopleThisRound':len(body),
             'sourceBodyNotConfirmed':624-len(before|body),'attemptedWithoutSelectedBody':len(started-(before|body)),
             'notStarted':624-len(started),'biographiesPrior':len(before_bios),'biographiesNew':len(bios),'biographiesTotal':len(before_bios|bios),
             'bothYearsVerifiedBefore':count(old_fs,['birth','death']),'bothYearsVerified':count(new_fs,['birth','death']),
             'birthVerified':count(new_fs,['birth']),'deathVerified':count(new_fs,['death']),
             'aliasesAndIdentityPartiallyCheckedBefore':count(old_fs,['aliases','identity'],('verified','partially_verified','provisional_masanari_not_all_hanzo_holders')),
             'aliasesAndIdentityPartiallyChecked':count(new_fs,['aliases','identity'],('verified','partially_verified','provisional_masanari_not_all_hanzo_holders')),
             'aliasesAndIdentityFullyVerified':count(new_fs,['aliases','identity']),
             'allFieldsComplete':sum(p['verification']=='verified' for p in people),'incomplete':sum(p['verification']!='verified' for p in people),
             'mechanicalBiographiesRemaining':sum('mechanical_biography_rewrite_needed' in p['qualityIssues'] for p in people),
             'mechanicalBiographiesBefore':baseline.get('mechanicalBiographiesRemaining',505),'termsPartiallyCheckedPeople':count(new_fs,['license'],('partially_verified',)),
             'termsFullyVerifiedPeople':count(new_fs,['license']),
             'startedIds':sorted(started,key=int),
             'currentRoundPeople':sorted(attempted,key=int),'newBodyPeople':sorted(body-before,key=int),'newBiographyPeople':sorted(bios,key=int),
             'definitions':{'body':'実際に採用人物の項目を資料本文で確認。検索抄録・書誌・別世代の記事のみは除外。','years':'生年・没年の両方がverified。暦の基準未解決・辞典のみの追加照合待ちは除外。','allComplete':'全fieldStatusがverified。事績確認や100字案の存在だけでは完了しない。','prior':'baseCommit時点のPR記録を再利用。今回全件再読したという意味ではない。'}}
    dump(OUT/'progress.json',metrics)
    safety={'unchangedFiles':{f:hashlib.sha256((ROOT/f).read_bytes()).hexdigest()==h for f,h in baseline['preservedSha256'].items()},'selectedRosterIdsUnchanged':set(rows)==set(bykey),'noPersonIdChange':all(p['id']==load(ROOT/'migration/input/id-registry.json')[k]['id'] for k,p in bykey.items()),'newBiographiesHaveEvidence':True,'completePeople':metrics['allFieldsComplete']}
    assert all(safety['unchangedFiles'].values()), safety
    assert safety['selectedRosterIdsUnchanged'] and safety['noPersonIdChange']
    dump(OUT/'preservation-check.json',safety)
    print(json.dumps(metrics,ensure_ascii=False,indent=2))

def main():
    global ROUND, OUT
    parser=argparse.ArgumentParser();parser.add_argument('--apply-round',action='store_true')
    parser.add_argument('--round',default='20261028');args=parser.parse_args()
    if not re.fullmatch(r'\d{8}(?:-\d{2})?', args.round):
        parser.error('--round must be YYYYMMDD or YYYYMMDD-NN')
    ROUND=ROOT/f'migration/research/{args.round}'
    OUT=ROOT/f'migration/reports/person-quality-{args.round}'
    if args.apply_round:
        data=load(ROUND/'evidence.json');prior=load(ROUND/'prior-review.json')
        rows={str(r['values'][8]):r['values'] for r in load(ROOT/'migration/input/master-snapshot.json')['rows']}
        validate_round(data,rows);merged=merged_review(data,prior,rows)
        target=ROOT/'migration/input/research-review.json'
        if load(target) not in [prior,merged]:
            raise ValueError('Later or unrelated review edits found; reconcile explicitly before applying this old round')
        dump(target,merged);print('Review proposals updated; regenerate migration candidates before exporting.')
    else:
        export()

if __name__=='__main__':main()

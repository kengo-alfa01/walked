#!/usr/bin/env python3
"""Export person research discoveries; never create production sites or links."""
import collections
from generate_sengoku_master import ROOT, load, dump, csvout

INPUT = ROOT / 'migration/input/person-life-events.json'
OUT = ROOT / 'migration/reports/person-life-timeline'
RELATIONS = {'居城','居館','屋敷','本拠地','滞在','人質','居城移転','転封','初陣',
             '参戦','攻城戦','陣地','本陣','戦死','築城','築城奉行','改修','造船',
             '領地経営','城下町整備','寺社創建','寺社再建','寺社保護','寄進',
             '隠居','幽閉','配流','蟄居','その他転機'}
STATUS = {'verified':'記載した関係を本文確認','partially_verified':'一部確認・追加照合待ち',
          'disputed':'異説あり','unverified':'未確認'}

def inputs():
    data = load(INPUT)
    people = {p['selection']['rosterId']:p for p in load(ROOT/'migration/generated/people.json')}
    bundles = {k:load(ROOT/v) for k,v in data['evidenceFiles'].items()}
    return data, people, bundles

def validate(data, people, bundles):
    events = data['events']; places = data['candidates']
    assert len({e['eventId'] for e in events}) == len(events), 'duplicate event ID'
    byevent = {e['eventId']:e for e in events}
    for key, p in places.items():
        assert p['candidateId'] == key
        assert p['existingSiteId'] is None and p['coordinates'] is None, 'handoff must not publish sites'
        assert p['locationStatus'] == 'unverified'
    for e in events:
        k=e['rosterId']; p=people[k]
        assert (e['personId'],e['personName']) == (p['id'],p['name']), 'person identity mismatch'
        assert e['candidateId'] in places
        assert e['relationTypes'] and set(e['relationTypes']) <= RELATIONS, 'excluded or unknown relation'
        assert e['relationStatus'] in STATUS
        assert e['approvalStatus'] == 'pending_user_review'
        assert e['sourceBodyStatus'] == 'body_read' and e['sourceLocator'] and e['sourceRefs']
        for ref in e['sourceRefs']:
            round_id, sid=ref.split(':',1); bundle=bundles[round_id]
            assert bundle['sources'][sid]['access'] == 'body_read', 'source body not read'
            assert bundle['people'][k].get('bodyForSelectedPerson',True), 'wrong person generation'
            assert any(sid in c['sourceIds'] for c in bundle['people'][k]['claims']), 'source not tied to person review'
        start,end,precision=e['yearStart'],e['yearEnd'],e['datePrecision']
        assert precision in {'year','interval','after','unknown'}
        assert all(x is None or (type(x) is int and 1000 <= x <= 2000) for x in (start,end))
        if precision=='unknown': assert start is None and end is None
        elif precision=='after': assert start is not None and end is None
        else:
            assert start is not None and end is not None and start <= end
            if precision=='year': assert start == end
        if e['previousMainBaseCandidateId']:
            assert e['previousMainBaseCandidateId'] in places
            assert any(x['rosterId']==k and x['candidateId']==e['previousMainBaseCandidateId'] for x in events)
    for seq in data['residenceSequences']:
        assert seq['completeness']=='partial_not_exhaustive'
        assert len(seq['candidateIds'])==len(seq['eventIds'])
        for cid,eid in zip(seq['candidateIds'],seq['eventIds']):
            assert byevent[eid]['rosterId']==seq['rosterId'] and byevent[eid]['candidateId']==cid
    return {'events':len(events),'candidatePlaces':len(places),'people':len({e['rosterId'] for e in events}),
            'selected':len(people),'peopleWithoutExtraction':len(people)-len({e['rosterId'] for e in events}),
            'completeLifeTimelines':0,'publishedSites':0,'publishedLinks':0,
            'definition':'候補数は抽出用の場所単位。全国データとの照合前であり、新規史跡数・独立訪問先数ではない。'}

def make_rows(data, bundles):
    rows=[]
    for e in sorted(data['events'],key=lambda x:(int(x['rosterId']), x['yearStart'] is None, x['yearStart'] or 0,x['eventId'])):
        place=data['candidates'][e['candidateId']]
        sources=[bundles[r.split(':',1)[0]]['sources'][r.split(':',1)[1]] for r in e['sourceRefs']]
        rows.append({'年表記録ID':e['eventId'],'人物ID':e['personId'],'名簿ID':e['rosterId'],'人物名':e['personName'],
                     '年代':e['dateLabel'],'開始年・下限':e['yearStart'],'終了年・上限':e['yearEnd'],
                     '年代精度':e['datePrecision'],'暦基準':e['calendarBasis'],'出来事':e['event'],
                     '史跡候補キー':e['candidateId'],'場所名':place['placeName'],'出典上の地域':place['regionAsSource'],
                     '場所の粒度':place['spatialGranularity'],'関係の種類':e['relationTypes'],
                     '前の主要拠点（途中滞在未網羅）':e['previousMainBaseCandidateId'],
                     '人物関係の確認状態':STATUS[e['relationStatus']],'年代の確認状態':e['dateStatus'],
                     '現在地の確認状態':'未確認','出典URL':list(dict.fromkeys(s['url'] for s in sources)),
                     '資料名':list(dict.fromkeys(s['title'] for s in sources)),'確認箇所':e['sourceLocator'],
                     '根拠記録':e['sourceRefs'],'確認日':e['checkedOn'],'利用条件':e['reuseStatus'],
                     '承認状態':'未承認','未解決事項':e['unresolved']})
    return rows

def main():
    data, people, bundles=inputs(); summary=validate(data,people,bundles); rows=make_rows(data,bundles)
    csvout(OUT/'person-life-timeline.csv',rows,list(rows[0]))
    grouped=collections.defaultdict(list)
    for row in rows: grouped[row['史跡候補キー']].append(row)
    candidates=[]
    for key,place in data['candidates'].items():
        found=grouped[key]; assert found, f'orphan candidate {key}'
        candidates.append({'史跡候補キー':key,'場所名':place['placeName'],'出典上の地域':place['regionAsSource'],
                           '場所の粒度':place['spatialGranularity'],'人物ID':list(dict.fromkeys(r['人物ID'] for r in found)),
                           '名簿ID':list(dict.fromkeys(r['名簿ID'] for r in found)),'人物名':list(dict.fromkeys(r['人物名'] for r in found)),
                           '年代':list(dict.fromkeys(r['年代'] for r in found)),'出来事':[r['出来事'] for r in found],
                           '関係の種類':sorted({v for r in found for v in r['関係の種類']}),
                           '年表記録ID':[r['年表記録ID'] for r in found],
                           '人物関係の確認状態':list(dict.fromkeys(r['人物関係の確認状態'] for r in found)),
                           '出典URL':list(dict.fromkeys(url for r in found for url in r['出典URL'])),
                           '確認日':data['updatedOn'],'既存史跡ID':'未照合','現在地・座標':'未確認',
                           '別スレッドとの重複':place['crossThreadOverlap'],'全国側で確認する事項':place['unresolved'],
                           '利用条件':'未確認・史実の独自要約のみ','採用状態':'候補・正式登録なし'})
    csvout(OUT/'person-discovered-site-candidates.csv',candidates,list(candidates[0]))
    dump(OUT/'handoff.json',{'schemaVersion':1,'summary':summary,'events':data['events'],
                          'candidates':data['candidates'],'residenceSequences':data['residenceSequences'],
                          'evidenceFiles':data['evidenceFiles'],
                          'sources':{f'{rid}:{sid}':s for rid,b in bundles.items() for sid,s in b['sources'].items()}})
    dump(OUT/'summary.json',summary)
    print(summary)

if __name__=='__main__': main()

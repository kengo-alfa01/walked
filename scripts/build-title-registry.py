"""Build the title registry from the exact map source; no person/site/card data is read."""
import json, sys, hashlib
from pathlib import Path
src=Path(sys.argv[1]); raw=src.read_bytes(); topo=json.loads(raw)
rules=json.loads(Path('data/title-rules.json').read_text())
excluded={'12000':'所属未定地','13000':'所属未定地','23000':'所属未定地','30000':'所属未定地','40000':'所属未定地','46000':'所属未定地','47000':'所属未定地', **{str(i):'対象外' for i in range(1695,1701)}}
# Codes are five digits including the leading zero.
excluded={k.zfill(5):v for k,v in excluded.items()}
areas=[{'code':str(g['id']), 'name':g['properties']['displayName'], 'prefecture':str(g['id'])[:2]} for g in topo['objects']['municipalities']['geometries']]
assert len(areas)==len({a['code'] for a in areas})==1905
prefs=rules['prefectures']
regions=rules['regions']
registry={'version':'municipalities-2025-stage1','sourceCommit':'78f20994bcdd7afbbbf8bf0b8aeb88b9e314a713','sourceSHA256':hashlib.sha256(raw).hexdigest(),'sourceURL':'https://github.com/kyodo-official/japan-choropleth/blob/78f20994bcdd7afbbbf8bf0b8aeb88b9e314a713/data/topojson/municipalities.topojson','attribution':'国土交通省 国土数値情報 行政区域データ2025年版（CC BY 4.0）を共同通信社が加工。対象コード・名称を抽出。','excluded':[a for a in areas if a['code'] in excluded],'areas':[a for a in areas if a['code'] not in excluded],'prefectures':prefs,'regions':regions}
assert len(registry['areas'])==1892
Path('data/title-registry.json').write_text(json.dumps(registry,ensure_ascii=False,indent=2)+'\n')
print('Registry: 1905 source / 13 excluded / 1892 targets / 47 prefectures / 8 regions')

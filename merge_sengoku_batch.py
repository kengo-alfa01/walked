#!/usr/bin/env python3
"""Append-only batch importer. Usage: python scripts/merge_sengoku_batch.py sengoku/batches/your-batch.json"""
import json,pathlib,sys,collections
ROOT=pathlib.Path(__file__).resolve().parent.parent/'sengoku'
TABLES=('people','sites','links','cards')
def load(path):
 with open(path,encoding='utf-8') as f:return json.load(f)
def fail(message):raise SystemExit('ERROR: '+message)
def main(path):
 patch=load(path)
 if not isinstance(patch,dict) or set(patch)-set(TABLES):fail('unknown table name')
 data={k:load(ROOT/(k+'.json')) for k in TABLES}
 for table,rows in patch.items():
  if not isinstance(rows,list):fail(table+' must be a list')
  known={r['id']:r for r in data[table]}
  for r in rows:
   if not isinstance(r,dict) or not r.get('id'):fail('row missing id in '+table)
   if r['id'] in known:
    if known[r['id']]!=r:fail('ID collision (existing item differs): '+r['id'])
    continue
   data[table].append(r);known[r['id']]=r
 pids={x['id'] for x in data['people']};sids={x['id'] for x in data['sites']}
 pairs={(x['siteId'],x['personId']) for x in data['links']}
 for l in data['links']:
  if l['personId'] not in pids or l['siteId'] not in sids:fail('link references missing site/person: '+l['id'])
 for c in data['cards']:
  if (c['siteId'],c['personId']) not in pairs:fail('card has no link: '+c['id'])
  if c.get('eventYear') is not None and (not isinstance(c['eventYear'],int) or not 1000<=c['eventYear']<=2100):fail('invalid year: '+c['id'])
  if c.get('eventYearEnd') is not None and (not isinstance(c['eventYearEnd'],int) or c['eventYearEnd']<(c.get('eventYear') or 0)):fail('invalid year end: '+c['id'])
 for k,items in data.items():
  ids=[x['id'] for x in items]
  if len(ids)!=len(set(ids)):fail('duplicate IDs: '+k)
 for k,items in data.items():
  (ROOT/(k+'.json')).write_text(json.dumps(items,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
  print(k,len(items))
if __name__=='__main__':
 if len(sys.argv)!=2:fail('pass batch path')
 main(sys.argv[1])

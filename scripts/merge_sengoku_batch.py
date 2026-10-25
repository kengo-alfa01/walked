#!/usr/bin/env python3
"""Atomic/idempotent insert+reviewed chronology update importer.
Usage: python scripts/merge_sengoku_batch.py sengoku/batches/BATCH.json
"""
import json,pathlib,sys,collections,copy
ROOT=pathlib.Path(__file__).resolve().parent.parent/'sengoku'
TABLES=('people','sites','links','cards')
UPDATE_FIELDS={'cards':{'eventYear','eventYearEnd','yearEvidence','yearSource'},'links':{'eventYears','yearEvidence'},'sites':set(),'people':set()}
def load(p):
 with open(p,encoding='utf-8') as f:return json.load(f)
def fail(msg):raise SystemExit('ERROR: '+msg)
def main(path):
 patch=load(path)
 if not isinstance(patch,dict) or set(patch)-set(TABLES+('updates',)):fail('unknown tables or patch type')
 data={k:load(ROOT/(k+'.json')) for k in TABLES}
 for table in TABLES:
  known={r['id']:r for r in data[table]}
  for row in patch.get(table,[]):
   if not isinstance(row,dict) or not row.get('id'):fail('insert missing id: '+table)
   if row['id'] in known:
    if known[row['id']]!=row:fail('append-only collision: '+row['id'])
    continue
   data[table].append(row);known[row['id']]=row
 updates=patch.get('updates',{})
 if not isinstance(updates,dict) or set(updates)-set(TABLES):fail('invalid updates')
 for table,rows in updates.items():
  known={r['id']:r for r in data[table]}
  if not isinstance(rows,list):fail('updates must be array: '+table)
  for row in rows:
   if not isinstance(row,dict) or row.get('id') not in known:fail('update refers to missing item: '+str(row.get('id')))
   unexpected=set(row)-UPDATE_FIELDS[table]-{'id'}
   if unexpected:fail('forbidden update fields: '+str(unexpected))
   target=known[row['id']]
   for field,value in row.items():
    if field=='id':continue
    existing=target.get(field)
    if existing not in (None,[],value) and not (field=='yearEvidence' and existing=='unverified' and value=='derived_from_dated_cards') and not (field=='eventYears' and isinstance(existing,list) and isinstance(value,list) and set(existing).issubset(value)):fail('conflicting existing value: '+row['id']+'.'+field)
    target[field]=value
 pids={x['id'] for x in data['people']};sids={x['id'] for x in data['sites']}
 pairs={(x['siteId'],x['personId']) for x in data['links']}
 for l in data['links']:
  if l['personId'] not in pids or l['siteId'] not in sids:fail('link missing person/site: '+l['id'])
  if 'eventYears' in l and (not isinstance(l['eventYears'],list) or any(not isinstance(y,int) or y<1000 or y>2100 for y in l['eventYears']) or sorted(set(l['eventYears']))!=l['eventYears']):fail('invalid linked years: '+l['id'])
 for c in data['cards']:
  if (c['siteId'],c['personId']) not in pairs:fail('card missing person/site link: '+c['id'])
  y=c.get('eventYear');e=c.get('eventYearEnd')
  if y is not None and (type(y)!=int or not 1000<=y<=2100):fail('invalid year: '+c['id'])
  if e is not None and (type(e)!=int or y is None or e<y):fail('invalid year end: '+c['id'])
 for table,rows in data.items():
  ids=[r['id'] for r in rows]
  if len(ids)!=len(set(ids)):fail('duplicate id: '+table)
 # only write after all tables are validated
 for table,rows in data.items():
  (ROOT/(table+'.json')).write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
  print(table,len(rows))
if __name__=='__main__':
 if len(sys.argv)!=2:fail('pass batch path')
 main(sys.argv[1])

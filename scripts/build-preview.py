"""Package the existing app for an isolated, private testing origin."""
import argparse, json, shutil, subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--output',required=True);args=parser.parse_args()
out=Path(args.output).resolve()
if out==root or root in out.parents: raise SystemExit('Use a separate Site directory outside the application checkout')
out.mkdir(parents=True,exist_ok=True)
# Explicit runtime allowlist: no Git metadata, management documents or user storage.
files=['index.html','walked-core.js','history.json','machida-boundaries.topojson','sagamihara-14151.topojson','sagamihara-14152.topojson','sagamihara-14153.topojson','data/title-registry.json','sengoku/people.json','sengoku/sites.json','sengoku/links.json','sengoku/cards.json','preview/preview.js','preview/preview.css']
files += [str(p.relative_to(root)) for p in sorted((root/'town-data').glob('*.topojson'))]
for name in files:
 dest=out/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(root/name,dest)
sha=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
s=(out/'index.html').read_text()
s=s.replace('<title>WALKED | 市区町村探索マップ</title>','<title>WALKED 確認用 — 称号・バックアップ</title>')
s=s.replace('</head>',f'<meta name="walked-preview" content="PR #4 / {sha[:7]}"><link rel="stylesheet" href="./preview/preview.css"></head>')
s=s.replace('</body>','<script src="./preview/preview.js"></script></body>')
(out/'index.html').write_text(s)
(out/'preview-build.json').write_text(json.dumps({'sourceRepository':'kengo-alfa01/walked','sourceCommit':sha,'pullRequest':4,'files':len(files)},indent=2)+'\n')
print(json.dumps({'source_commit':sha,'files':len(files),'output':str(out)}))

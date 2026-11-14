"""Build an isolated, review-only copy of the current branch (no main/Pages changes)."""
from pathlib import Path
import argparse, json, shutil, subprocess, zipfile

root=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser()
p.add_argument('--output',default='dist/homebase-preview')
args=p.parse_args()
dest=(root/args.output).resolve()
if dest==root or root in dest.parents and dest.relative_to(root).parts[0] not in ('dist',):
    raise SystemExit('The output must be within dist/ or outside the repository.')
if dest.exists():
    shutil.rmtree(dest)
dest.mkdir(parents=True)
runtime=[
 'index.html','walked-core.js','publication-runtime.js','sengoku-v2-core.js',
 'sengoku-chronology.js','regional-core.js','regional-ui.js','regional.css',
 'map-coloring.js','manifest.webmanifest','machida-boundaries.topojson',
 'sagamihara-14151.topojson','sagamihara-14152.topojson','sagamihara-14153.topojson',
]
for name in runtime:
    source=root/name
    if not source.is_file():raise SystemExit('Missing runtime file '+name)
    target=dest/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,target)
for dirname in ('assets','data','sengoku','regional','town-data'):
    source=root/dirname
    if not source.is_dir():raise SystemExit('Missing runtime directory '+dirname)
    shutil.copytree(source,dest/dirname)
sha=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
branch=subprocess.check_output(['git','branch','--show-current'],cwd=root,text=True).strip()
html=(dest/'index.html').read_text(encoding='utf-8')
html=html.replace('<title>日本見風録</title>','<title>日本見風録 — 本拠地検証版（本番とは別）</title>',1)
html=html.replace('</head>','<meta name="robots" content="noindex,nofollow"></head>',1)
banner=(
 '<aside role="note" style="padding:10px 15px;background:#fff3ca;'
 'color:#553c10;font-size:12px;text-align:center">'
 '検証版：本拠地・ダッシュボード改修（GitHub main 未反映）。'
 '実際のタイムラインや個人データを投入せず、テスト用記録で確認してください。'
 '</aside>'
)
html=html.replace('</header>','</header>'+banner,1)
(dest/'index.html').write_text(html,encoding='utf-8')
info={'branch':branch,'commit':sha,'runtimeFiles':len(list(dest.rglob('*')))}
(dest/'preview-build.json').write_text(json.dumps(info,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
guide='''日本見風録 本拠地・ダッシュボード検証版
main は変更しません。検証は本番とは別のブラウザ保存領域で行ってください。
ウェブサーバーで公開されたURLから開いてください。file:// はブラウザ制約で動作しません。
例: このフォルダーの直下で python3 -m http.server 8765 を起動。
個人のタイムライン情報を第三者サイトにアップロードしないでください。
'''
(dest/'PREVIEW-README.txt').write_text(guide,encoding='utf-8')
zippath=dest.parent/'homebase-preview-site.zip'
with zipfile.ZipFile(zippath,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for file in dest.rglob('*'):
        if file.is_file():z.write(file,file.relative_to(dest))
print(json.dumps({'previewDirectory':str(dest),'zip':str(zippath),**info},ensure_ascii=False))

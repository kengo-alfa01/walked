#!/usr/bin/env python3
"""Generate preview from current index.html; no changes to live entry point."""

import pathlib, json

ROOT = pathlib.Path(__file__).resolve().parents[1]


def build():
    s = (ROOT / "index.html").read_text()

    def replace(old, new):
        nonlocal s
        if s.count(old) != 1:
            raise ValueError("Preview injection anchor changed: " + old[:60])
        s = s.replace(old, new, 1)

    replace("<head>", '<head><base href="../">')
    replace(
        "<script>\n'use strict';",
        "<script src=\"./migration/runtime.js\"></script><script>\n'use strict';",
    )
    replace(
        "const DBKEY='walked_municipal_v2'", "const DBKEY='walked_migration_preview_visited_v1'"
    )
    replace(
        "localStorage.getItem(DBKEY)||'{}'",
        "localStorage.getItem(DBKEY)||localStorage.getItem('walked_municipal_v2')||'{}'",
    )
    replace(
        "const sengokuStoreKey='walked_sengoku_cards_v1';",
        "const sengokuStoreKey='walked_migration_preview_cards_v1';",
    )
    replace(
        "localStorage.getItem(sengokuStoreKey)||'{}'",
        "localStorage.getItem(sengokuStoreKey)||localStorage.getItem('walked_sengoku_cards_v1')||'{}'",
    )
    replace(
        "let sengokuPeople=[],sengokuSites=[]",
        "let sengokuArchive=[],sengokuPeople=[],sengokuSites=[]",
    )
    replace(
        "const responses=await Promise.all(['people','sites','links','cards'].map(k=>fetch('./sengoku/'+k+'.json',{cache:'no-cache'})));",
        "const responses=await Promise.all(['people','sites','links','cards','people-archive'].map(k=>fetch('./migration/generated/'+k+'.json',{cache:'no-cache'})));",
    )
    replace(
        "const [people,sites,links,cards]=await Promise.all(responses.map(r=>r.json()));",
        "const [people,sites,links,cards,archive]=await Promise.all(responses.map(r=>r.json()));\n WalkedMigration.validate({people,sites,links,cards,archive});",
    )
    replace(
        "const ids=new Set(people.map(p=>p.id)),siteIds=new Set(sites.map(s=>s.id));",
        "const ids=new Set([...people,...archive].map(p=>p.id)),siteIds=new Set(sites.map(s=>s.id));",
    )
    replace(
        "sengokuPeople=people;sengokuSites=sites;",
        "sengokuArchive=archive;sengokuPeople=people;sengokuSites=sites;",
    )
    replace(
        "const people=sengokuPeople.filter(p=>(!q||p.name.includes(q)||String(p.group||'').includes(q))&&(filter!=='found'||countOwned(p.id)>0));",
        "const candidates=filter==='found'?[...sengokuPeople,...sengokuArchive.filter(p=>countOwned(p.id)>0)]:sengokuPeople;\n const people=candidates.filter(p=>WalkedMigration.matches(p,q)&&(filter!=='found'||countOwned(p.id)>0));",
    )
    replace(
        "t.textContent=person.name;",
        "t.textContent=person.name+(person.active===false?'（過去のカード）':'');",
    )
    replace(
        "const p=sengokuPeople.find(x=>x.id===distinctPeople[0]);",
        "const p=[...sengokuPeople,...sengokuArchive].find(x=>x.id===distinctPeople[0]);",
    )
    replace(
        "const h=document.createElement('h3');h.textContent=person.name+' ― 人生の足跡';div.append(h);",
        "const h=document.createElement('h3');h.textContent=person.name+' ― 人生の足跡';div.append(h);\n if(person.biography){const p=document.createElement('p');p.textContent=(person.fieldStatus?.biography==='verified'?'事績の典拠確認済み（人物全体の精査は継続中）：':'未確認の略歴：')+person.biography;div.append(p);}\n const caution=document.createElement('p');caution.textContent=person.active===false?'今回の採用対象外です。過去のカードとのつながりを残しています。':'別名候補・生没年には未確認情報を含みます。人物全体の史実確認は未完了です。';div.append(caution);\n if(person.birth){const y=document.createElement('p');y.textContent='生年：'+WalkedMigration.yearLabel(person.birth)+'／没年：'+WalkedMigration.yearLabel(person.death)+'（異説・暦・未確認を含む）';div.append(y);}\n if(person.sources){const details=document.createElement('details');const summary=document.createElement('summary');summary.textContent='出典・利用条件';details.append(summary);for(const url of person.sources){const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=url;details.append(a,document.createElement('br'));}const lic=document.createElement('p');lic.textContent=person.license.attribution+'　ライセンスの精査は継続中。';details.append(lic);if(person.researchReview?.note){const review=document.createElement('p');review.textContent='今回の確認メモ：'+person.researchReview.note;details.append(review);}div.append(details);}",
    )
    old = "$('save').onclick=()=>download('WALKED-backup-'+new Date().toISOString().slice(0,10)+'.json',{format:'walked-backup-v2',visited:state.visited});"
    replace(
        old,
        "$('save').onclick=()=>download('WALKED-preview-backup-'+new Date().toISOString().slice(0,10)+'.json',WalkedMigration.backup(state.visited,sengokuFound));",
    )
    replace(
        "if(d.format!=='walked-backup-v2'||!d.visited)throw Error('WALKEDバックアップではありません');Object.assign(state.visited,d.visited);persist();repaint();",
        "const restored=WalkedMigration.restore(d);Object.assign(state.visited,restored.visited);Object.assign(sengokuFound,restored.found);localStorage.setItem(sengokuStoreKey,JSON.stringify(sengokuFound));persist();repaint();renderSengoku();refreshSengokuPins();",
    )
    replace(
        "<main>",
        '<main><div class="notice" role="status">移行データの確認用です。採用__SELECTED_COUNT__人・史実精査中。操作した記録は確認用に別保存します。「獲得済み」には採用対象外の過去のカードも表示します。</div>',
    )
    replace(
        "</style>",
        "@media(max-width:650px){.sengoku-grid{grid-template-columns:repeat(auto-fit,minmax(min(140px,100%),1fr))}.sengoku-actions{flex-wrap:wrap}.sengoku-actions input{flex-basis:100%}}.sengoku-person,.sengoku-detail{overflow-wrap:anywhere}.sengoku-actions input{font-size:16px}</style>",
    )
    count = json.loads((ROOT / "migration/generated/summary.json").read_text())["selected"]
    s = s.replace("採用__SELECTED_COUNT__人・史実精査中", f"採用{count}人・史実精査中")
    (ROOT / "migration/preview.html").write_text(s.replace("\n} \n", "\n}\n"))


if __name__ == "__main__":
    build()

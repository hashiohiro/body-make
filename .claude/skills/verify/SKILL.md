---
name: verify
description: BodyMake の検証（整形・型・テスト・ビルド）を Windows 側の Node で走らせる。WSL から /mnt/c を読むと jsdom の読み込みだけで 37 秒かかるため、テストが 5 倍遅くなる。報告・コミット・デプロイの前に通す。
---

# 検証を走らせる

報告する前・コミットする前・デプロイする前は、この 4 つを通す。

```bash
W="/mnt/c/Program Files/nodejs/node.exe"

"$W" node_modules/prettier/bin/prettier.cjs --check src   # 整形
"$W" node_modules/typescript/lib/tsc.js -b --noEmit       # 型
"$W" node_modules/vitest/vitest.mjs run                   # テスト
"$W" scripts/copy-notices.mjs && "$W" node_modules/vite/bin/vite.js build   # ビルド
```

整形が落ちたら `--check` を `--write` に変えて直し、もう一度通す。

## なぜ Windows の Node を使うのか

**このリポジトリは Windows ドライブ（`/mnt/c`）にあり、WSL からは 9p 越しに読む。**
小さいファイルが数千個ある依存（jsdom）を読むたびに待たされる。

```
require('jsdom') だけ   WSL の node 37 秒  /  Windows の node 2.8 秒
```

実測（全 565 テスト、同じファイル・同じ node_modules）。

| | WSL の node | Windows の node |
| --- | --- | --- |
| vitest（全体） | 97 秒 | **18 秒** |
| tsc | 8.6 秒 | 5.6 秒 |
| prettier | 4.3 秒 | 4.3 秒 |

`node_modules` には `linux-x64` と `win32-x64` の**両方**のバイナリが入っている
（`@esbuild` / `@rollup` を見れば分かる）ので、入れ直しは要らない。どちらからでも動く。

**リポジトリを WSL 側へ移す必要はない。**遅いのは「WSL から Windows ドライブを読む」経路だけで、
IntelliJ（Windows）から走らせるぶんには元から速い。

## 見つからないとき

`node.exe` が上のパスに無ければ `ls /mnt/c/Program\ Files/nodejs/` で探す。
それでも無ければ WSL の `npx` に落とす（`npx prettier` / `npx tsc` / `npx vitest run` / `npm run build`）。
**遅いだけで結果は同じ**なので、落としたことだけ報告すれば足りる。

## ビルドについて

`npm run build` は `prebuild`（`scripts/copy-notices.mjs`）→ `tsc -b` → `vite build` の 3 段。
上のコマンドは同じ 3 つを Windows の Node で直接叩いている。
ライセンス表記のファイルを作る `copy-notices` を飛ばすと、配布物に `THIRD-PARTY-NOTICES.txt` が入らない。

## デプロイ

**検証が通っても、勝手にデプロイしない。**実機で確認した OK が出てから、
明示的に頼まれたときだけ出す。手順は `deploy` スキル。

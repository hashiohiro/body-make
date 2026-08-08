# BodyMake

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE.txt)
[![PWA](https://img.shields.io/badge/PWA-offline%20ready-5a5a5a.svg)](#スマホで使う)

体重と体脂肪率を記録し、体組成の変化を追うためのアプリケーションです。
私がExcelでつけていた記録を、スマホでどこでも開けるようにアプリ化してみました。

**デモ: https://bodymake.hashiohiro.workers.dev**

<p>
  <img src="docs/screenshot-home.png" width="380" alt="ホーム画面。現在の体重、体脂肪量、除脂肪体重、当日の記録入力" />
  <img src="docs/screenshot-charts.png" width="380" alt="グラフ画面。体重の推移、体脂肪率の推移、週平均の体組成" />
</p>

## 使い方

デモ URL をスマホのブラウザで開き、「ホーム画面に追加」。オフラインでも起動し、アドレスバーのないアプリとして開きます。

## ローカル環境の作り方

```bash
npm install
npm run dev      # http://localhost:5173
```

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | 開発サーバー |
| `npm run build` | 型チェック＋本番ビルド（`dist/`） |
| `npm run preview` | ビルド結果をローカル配信 |
| `npm run typecheck` | 型チェックのみ |
| `npm run licenses` | 配布物に含まれる第三者コードを一覧 |
| `npm run licenses:check` | 未申告があれば異常終了（CI 用） |
| `npm run deploy` | ビルドして Cloudflare へデプロイ |

Service Worker は本番ビルドでのみ有効です。`file://` で `index.html` を直接開くことはできません（ES モジュールと Service Worker が使えないため）。ローカル確認は `npm run preview` を使ってください。

**技術構成** — React 19 / TypeScript / SCSS（CSS Modules）/ Vite。

## データの扱い

記録はブラウザの localStorage にのみ保存され、サーバーへは送信されません。裏を返すと、ブラウザのデータを消すと記録も消えます。設定画面から JSON / CSV で書き出せるので、ときどきバックアップを取ってください。

CSV は元の Excel と同じ列構成（日次記録＋週次分析）で BOM 付き出力なので、Excel でそのまま開けます。読み込みも同じ形式を受け付けます。

## デプロイ

Cloudflare Workers の static assets で配信します。

```bash
npm run cf:login   # 初回のみ
npm run deploy
```

`wrangler.jsonc` の `name` がプロジェクト名です。キャッシュ設定は `public/_headers` にあり、`sw.js` と `index.html` を `no-cache`、ハッシュ付きの `assets/*` を1年 immutable にしています。ここは PWA の更新可否に直結するので、変更する際は注意してください。

Service Worker は `autoUpdate` 設定です。ホーム画面に追加済みの端末では、**次に開いたときに新しいビルドを取得し、そのまた次の起動から反映**されます。

## 構成

```
src/
  types.ts          ドメイン型
  lib/
    date.ts         ローカル日付ユーティリティ（UTC を経由しない）
    derive.ts       日平均・移動平均・週次集計・統計・到達予測
    energy.ts       週平均の差からの推定カロリー収支
    storage.ts      localStorage 永続化と入力値のサニタイズ
    io.ts           JSON / CSV 入出力
    badges.ts       実績バッジの判定
  hooks/            状態管理・テーマ・数値入力・要素幅計測
  components/
    charts/         依存ライブラリなしの SVG チャート
  views/            ホーム / グラフ / 記録 / 設定
  styles/
    _tokens.scss    配色・角丸・タイポのトークン（ライト／ダーク）
    ui.module.scss  カード・ボタン・表など共有の見た目
scripts/
  licenses.mjs      配布物から第三者コードを洗い出す
```

色はすべて `_tokens.scss` の CSS カスタムプロパティ経由で、ダークテーマは OS 設定（`prefers-color-scheme`）とアプリ内トグル（`data-theme`）の両方に対応します。グラフの系列色は「体重＝青／体脂肪＝オレンジ／除脂肪＝アクア」で実体に固定し、色覚多様性の分離条件をライト・ダーク両モードで満たす組み合わせを選んでいます。全グラフに表ビューがあるので、色が見分けにくい環境でも値に到達できます。

## ライセンス

MIT License — [LICENSE.txt](LICENSE.txt)

配布物に含まれる第三者コードの帰属は [THIRD-PARTY-NOTICES.txt](THIRD-PARTY-NOTICES.txt) に分離しています。
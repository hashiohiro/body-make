---
name: deploy
description: BodyMake を Cloudflare Workers へデプロイする。本番は npm run deploy:prod、デモは npm run deploy:demo だけを使う（ビルドと wrangler を手で組まない）。実機確認の OK が出て、明示的に頼まれたときだけ使う。
---

# デプロイする

**実機で確認した OK が出てから、頼まれたときだけ**叩く。検証が通っただけでは出さない。

## 手順

1. `verify` スキルで 4 つ（整形・型・テスト・ビルド）を通す
2. 出す先のスクリプトを **WSL のシェルで** 叩く

```bash
npm run deploy:prod   # 本番  https://bodymake.hashiohiro.workers.dev
npm run deploy:demo   # デモ  https://bodymake-demo.hashiohiro.workers.dev
```

「デプロイして」とだけ言われたら**本番だけ**を出し、デモにも出すかは報告で聞く。
両方と言われたら 2 つとも叩く（順番はどちらでもよい。別のワーカーで、互いに影響しない）。

## スクリプト以外で出さない

**ビルドと `wrangler deploy` を手で組み立てない。**遅くてもスクリプトを使う。

違いは初期データを入れるかどうかの 1 点で、それを決めているのがスクリプトの組み合わせ。

| スクリプト | ビルド | 初期データ | 出す先 |
| --- | --- | --- | --- |
| `deploy:prod` | `npm run build` | **入れない** | `bodymake` |
| `deploy:demo` | `npm run build:demo`（`.env.demo` の `VITE_DEMO=1`） | 入れる | `bodymake-demo` |

**デモの初期データ（作成者の記録）を本番に入れてはいけない。**本番に他人の数字が入ると、
消すまで自分の記録が読めない。手で組むと「どのビルドをどこへ出すか」を自分で守ることになり、
取り違える余地が生まれる。スクリプトならその組み合わせが固定されている。

## WSL の Node で叩く理由

`verify` は速さのために Windows の Node を使うが、**wrangler は WSL の Node でしか動かない。**
`node_modules` に入っている workerd が linux 用のバイナリだけなので、Windows の Node から叩くと
`You installed workerd on another platform` で落ちる。

ログインが切れていたら、ユーザーに `! npm run cf:login` を打ってもらう
（ブラウザでの認可が要るので、こちらでは進められない）。状態は `npx wrangler whoami` で見られる。

## 出るけれど問題ない警告

`deploy:prod` では次の警告が出る。本番は設定ファイルの最上位の環境なので、これで正しい。

```
Multiple environments are defined in the Wrangler configuration file,
but no target environment was specified for the deploy command.
```

## 報告すること

- 出した先の URL と `Current Version ID`
- 出した中身（何の変更が入ったか）
- **コミットしていない変更が含まれているか**（スクリプトは作業ツリーをそのままビルドする）
- ホーム画面に追加済みの端末では、**次に開いたときに取得して、その次の起動から反映**されること

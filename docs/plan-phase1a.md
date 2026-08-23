# Phase 1a 実装計画

設計は [design-training.md](design-training.md)。ここは「触るファイルと順序」だけを書く。

**1a の完了条件** — 筋トレを記録でき、その日の結果表が出る。**グラフはまだ作らない。**
ここまでで自分で使い始められる状態にして、実データを見てから 1b 以降の見え方を決める。

---

## 0. バージョンの扱い

**保存ガードは入れない**（設計 §9）。`sanitizeData` は `version` を見て
v1 なら `exercises: []` / `workouts: {}` を補い、v2 はそのまま通す。それだけ。

1a のデプロイ後にロールバックすると筋トレ分は消えるが、`entries` と `settings` は残る。
これは許容する。復旧が要る場合は既存の JSON エクスポートから読み戻す。

---

## 1. 触るファイル

### 新規

| ファイル | 内容 |
| --- | --- |
| `src/lib/exerciseCatalog.ts` | 種目カタログ28種（設計 §3）。localStorage には触れない |
| `src/lib/training.ts` | 導出：役割判定・有効重量・挙上量・1RM・開始値・自己最高 |
| `src/lib/training.test.ts` | 導出の純関数テスト（§4） |
| `src/views/TrainingView.test.tsx` | 画面の結線テスト（jsdom） |
| `src/views/TrainingView.tsx` | トレタブ本体 |
| `src/views/TrainingView.module.scss` | |
| `src/components/training/SetRow.tsx` | セット1行（重量・レップ・削除・ウォームアップ切替） |
| `src/components/training/ExerciseCard.tsx` | 種目1件（前回実績・セット列・小計） |
| `src/components/training/ExercisePicker.tsx` | 種目を当日に追加 |
| `src/components/training/SessionSummary.tsx` | その日の結果表 |
| `src/components/training/ExerciseManager.tsx` | 種目マスタの追加・並べ替え・アーカイブ |

### 変更

| ファイル | 変更点 |
| --- | --- |
| `package.json` | `vitest` / `jsdom` / `@testing-library/react` を devDependency に、`test` スクリプト |
| `src/types.ts` | `Exercise` / `WorkSet` / `SessionExercise` / `Workouts` / `AppData` v2 と導出型 |
| `src/lib/storage.ts` | v2 サニタイズ、値域定数、種目 seed キー |
| `src/hooks/useBodyData.ts` | 筋トレの更新アクションと `training` 派生 |
| `src/views/RecordsView.tsx` | 体重／トレーニングのセグメント切り替え |
| `src/components/NumberField.tsx` | ± ボタンを外し、直近値をプレースホルダに |
| `src/lib/io.ts` | `ImportResult` に `exercises` / `workouts` を足す |
| `src/views/SettingsView.tsx` | 削除ボタンを2系統に、インポートの復元対象を拡張 |

**触らない** — `derive.ts` / `energy.ts` / `badges.ts` / `components/charts` /
既存 `views`（`SettingsView` を除く）。
**体重側の計算と表示を1つも変えない**ことを 1a の不変条件にする。

---

## 2. 実装順序

### S0. 基盤

1. `npm i -D vitest`、`"test": "vitest run"` / `"test:watch": "vitest"` を追加。
   Vite プロジェクトなので `vite.config.ts` をそのまま拾う。純関数だけなので環境は node のまま
2. `src/types.ts` に型を追加（§3）

> ここで一度 `npm run typecheck` を通す。既存コードの型が `AppData` の変更に追随しているか確認。

### S1. 永続化とカタログ

3. **`loadData()` の seed 分岐を修正**。`const base = stored ?? emptyData()` を作り、
   seed 経路も `{ ...base, entries: seedEntries() }` を返す形にして
   `exercises` / `workouts` を落とさないようにする。`DATA_KEY` は変えない
4. `sanitizeExercise` / `sanitizeExercises` / `sanitizeWorkSet` / `sanitizeWorkouts` を
   既存 `num(value, min, max)` の作法で書く。値域は設計 §15
5. `sanitizeData` を v1 分岐つきに（v1 は `exercises: []` / `workouts: {}` を補うだけ）
6. `exerciseCatalog.ts` — 28種。`id` はカタログ固定の文字列（`ex_bench` など）にして、
   同じ種目を選び直しても過去ログの参照が繋がるようにする
7. `io.ts` の `ImportResult` に `exercises` / `workouts` を足す

> `crypto.randomUUID()` はユーザーが自作した種目にだけ使う。**カタログ由来は固定 ID**
> （`ex_bench` など）。削除して入れ直しても過去ログの参照が繋がる（設計 §3）。

### S2. 導出（UI なし・ここでテストを書く）

8. `resolveRoles(sets)` — トップセット index（最大重量 → 同率ならレップ最大 → 最初）を決め、
   各セットに `'warmup' | 'work' | 'top'` を割り当てる。`warmup: null` のときだけ位置で既定を決める
9. `effectiveWeight(exercise, set, bodyWeight)` — `perSide` の ×2、`loadType` 4分岐
10. `buildExercisePoint(...)` — セット挙上量、ワークセット数、e1RM（実測かどうかのフラグ込み）
11. `buildSessions(workouts, exercises, daily)` — 日付順の `SessionPoint[]`。
    体重は既存 `daily` から引く（`weight` → 欠測なら `maWeight`）
12. `exerciseBaseline(sessions, exerciseId)` — 最初の3セッションの主指標の平均、3未満は `null`
13. `personalBest(sessions, exerciseId, date)` — その日までの自己最高（**保存しない**）

> **`buildSessions` の入力に `daily` が要る**ので、`useBodyData` 内での計算順は
> `daily` → `sessions` になる。循環はしない。

### S3. 状態

14. `useBodyData` に追加：
    `setSetValue(date, exerciseId, index, field, value)` /
    `addSet(date, exerciseId)` / `removeSet(date, exerciseId, index)` /
    `setWarmup(date, exerciseId, index, value)` /
    `addDayExercise(date, exerciseId)` / `removeDayExercise(date, exerciseId)` /
    `copyPreviousSets(date, exerciseId)` /
    `upsertExercise(exercise)` / `archiveExercise(id)` / `moveExercise(id, delta)` /
    `clearRecords()` / `clearAll()` / `importData(result, mode)`
15. 削除の連鎖は設計 §2.2 のとおり（空セット → 空種目 → 日付キー）。
    既存 `setValue` の blank 判定と同じ形にそろえる
16. `sessions` を `useMemo` で派生（`data.workouts` / `data.exercises` / `daily` に依存）

> `useBodyData` が肥大するが、**AppData の所有者を1つに保つ**ほうを優先する。
> 別フックに割ると `setData` を渡す必要が出て、保存タイミングが二重になる。

### S4. 画面の骨

17. `TabBar` に `training` を追加（`TabId` / `ICONS` / `LABELS` / `ORDER`）。
    アイコンは既存と同じ手書き SVG、`strokeWidth="1.8"` にそろえる
18. `App.tsx` の `TITLES` に `training: 'トレ'`、`<main>` に分岐を追加
19. `TrainingView` の骨組み — 日付ナビ（`QuickEntry` の `‹ 日付 ›` と `max={today}` を流用）

### S5. 記録 UI

20. `SetRow` — `NumberField` 2つ（重量は種目の `step`、レップは `step=1`）。
    行メニューに「削除」「ウォームアップにする / しない」
21. `ExerciseCard` — 種目名、**対象日より前**の直近セッションの実績、セット列、小計と前回比、
    「前回の構成で始める」
22. `ExercisePicker` — アーカイブ済みを除いた一覧。**当日すでにある種目を選んだら、
    重複を作らず既存カードへスクロールする**（設計 §2.1）
23. `SessionSummary` — 結果表。「過去最大」列、ウォームアップ除外数の明示
24. 記録0件のときの空状態（既存 `HomeView` の `emptyState` と同じ書式）

### S6. 種目管理

25. `ExerciseManager` — `TrainingView` 下部。追加フォームは
    **名前 / 部位 / コンパウンドかアイソレーションかの2択**の3項目だけ。
    `step` と `loadType` は詳細に畳む
26. 並べ替えは上下ボタン、削除はアーカイブ（物理削除しない）
27. 「アーカイブ済みを表示」トグルと解除ボタン
28. 「カタログから追加」— 1件ずつ選ぶほか、**すべて追加**で初期状態に戻せる（設計 §3）

---

## 3. 型の差分

```ts
/* --- 保存する型（設計 §2）--- */
export type MuscleGroup = 'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'core';
export type Mechanic    = 'compound' | 'isolation';
export type LoadType    = 'external' | 'bodyweight' | 'assisted' | 'none';

export interface Exercise { /* 設計 §2 のとおり */ }
export interface WorkSet { weight: number | null; reps: number | null; warmup: boolean | null }
export interface SessionExercise { exerciseId: string; sets: WorkSet[] }
export type Workouts = Record<string, SessionExercise[]>;

export interface AppData {
  version: 2;
  settings: Settings;   // 無改変
  entries: Entries;     // 無改変
  exercises: Exercise[];
  workouts: Workouts;
}

/* --- 導出型（保存しない）--- */
export type SetRole = 'warmup' | 'work' | 'top';

export interface SetPoint {
  index: number;
  weight: number | null;
  reps: number | null;
  role: SetRole;
  /** 挙上量に数えるか（ウォームアップ・欠測・loadType none は false） */
  counted: boolean;
  effectiveWeight: number | null;
  volume: number | null;
}

export interface ExercisePoint {
  exerciseId: string;
  name: string;
  sets: SetPoint[];
  top: SetPoint | null;
  volume: number;
  workSets: number;
  reps: number;
  /** 推定または実測の1RM。アイソレーションでも計算はするが主指標には使わない */
  oneRm: number | null;
  /** reps = 1 の実測が採用されたか */
  measured: boolean;
}

export interface SessionPoint {
  date: string;
  time: number;
  exercises: ExercisePoint[];
  volume: number;
  workSets: number;
  warmupSets: number;
  reps: number;
}
```

---

## 4. テストケース（`training.test.ts`）

設計 §10 の定義表と1対1で書く。**表の行が増えたらテストも増える**という関係にしておく。

### 有効重量

| # | 入力 | 期待 |
| --- | --- | --- |
| 1 | `perSide: true`、20kg × 10 | 400（片側20 → 基準40） |
| 2 | `bodyweight`、係数1.0、体重70、追加10kg × 5 | 400 |
| 3 | `bodyweight`、当日の体重が欠測 | 7日移動平均を使う |
| 4 | `bodyweight`、体重の記録が一切ない | `null`（除外） |
| 5 | `assisted`、係数1.0、体重70、アシスト20kg × 8 | 400 |
| 6 | `loadType: 'none'` | 挙上量0、ただし `workSets` には数える |
| 7 | `weight: null` または `reps: null` | 除外（0 として数えない） |

### 役割の判定

| # | 入力 | 期待 |
| --- | --- | --- |
| 8 | `60×5, 80×3, 100×2, 120×3, 90×10, 90×9` | 前3つ warmup / `120×3` top / 後2つ work |
| 9 | `60×10, 60×10, 60×11` | top は**3番目**（同率ならレップ最大） |
| 10 | `60×10, 60×10` | top は**最初**（重量もレップも同率） |
| 11 | 逆ピラミッド `100×5, 90×8, 80×10` | top は最初、残りは work（warmup ゼロ） |
| 12 | ランプアップに `warmup: false` を手で設定 | 挙上量に数える |
| 13 | 単一セット `60×10` | それが top、warmup ゼロ |

### 1RM

| # | 入力 | 期待 |
| --- | --- | --- |
| 14 | `reps = 1`、120kg | 120.0（Epley を通さない）、`measured: true` |
| 15 | `reps = 12`、100kg | 140.0（Epley） |
| 16 | `reps = 13` | 採用しない |
| 17 | ウォームアップのみのセッション | `null` |
| 18 | トップ `120×3` とバックオフ `90×10` | 132.0（最大を採る） |

### 開始値・自己最高

| # | 入力 | 期待 |
| --- | --- | --- |
| 19 | 2セッションしかない | `null`（開始比を出さない） |
| 20 | 3セッション | 3件の主指標の平均 |
| 21 | `personalBest(date)` | **その日までの**最高。未来のセッションを含めない |

### サニタイズと削除

| # | 入力 | 期待 |
| --- | --- | --- |
| 22 | 値域外（重量600 / レップ0 / 負値） | `null` に落ちる |
| 23 | 未知の `exerciseId` を参照するログ | 落とす |
| 24 | 空セット → 空種目 → 空日 | 連鎖して落ちる（§2.2） |
| 25 | v1 データ | `exercises: []` / `workouts: {}` が補われ、`entries` は無傷 |
| 26 | v2 バックアップの読み戻し | `entries` / `settings` / `exercises` / `workouts` がすべて復元される |
| 27 | `clearRecords()` | `entries` と `workouts` が空、`exercises` と `settings` は残る |
| 28 | seed 分岐（体重0件・未 seed・筋トレあり） | `entries` に seed が入り、`exercises` / `workouts` は無傷 |
| 29 | カタログから再追加した種目 | 固定 ID なので過去ログの `exerciseId` が解決できる |

---

## 5. 完了条件

### 自動テストで担保している

- [x] `npm run typecheck` / `npm run test`（41件） / `npm run build` が通る
- [x] 種目を追加し、セットを記録し、集計が出る
- [x] 直前のセットが複製されるので入力は差分だけで済む
- [x] 同じ種目を2回追加しようとしても重複が作られない
- [x] セットを全部消すと種目ごと、種目が空になれば日付キーごと消える
- [x] 書いたセットはすべて挙上量に数える（ウォームアップの区別を持たない）
- [x] 初期状態は空。まとめて追加でカタログ全件が入り、削除すると減る
- [x] 体重0件・未 seed の状態でも筋トレの記録が消えない（seed 分岐の穴）
- [x] v1 データが `entries` を保ったまま v2 になる
- [x] v2 バックアップが筋トレを含めて往復する
- [x] 記録0件でクラッシュせず、空状態が出る

### 実機で確認すること（自動テストでは見ていない）

- [ ] v1 の localStorage から起動して、体重側の表示が変わっていない
- [ ] 5タブになったタブバーの見た目と、親指の届き方
- [ ] セット行のステッパーが片手で押せる幅か（iOS のズーム抑制含む）
- [ ] 日付を戻しての再編集
- [ ] 「実績データを削除」で種目マスタが残り、「すべて削除」で消える
- [ ] ダークテーマでの見え方

---

## 6. 既知の割り切り

- **空セットの掃除はサニタイズ任せ。** 入力欄を空にしただけでは行を消さない
  （打鍵の途中で行が消えると入力できないため）。残った空セットは次回の読み込み時に落ちる
- **`Exercise.step` はモバイルでは実質何もしない。** ± を外したので、効くのは
  PC の上下キーと数値の粒度だけ。削除の候補（設計 §11-14）
- **種目ごとの `targetWeight` は入力できるが、まだ何にも使っていない。** Phase 2 で目標線に使う

---

## 7. 1a のあと

実データを2〜3週ためてから 1b（種目別推移グラフ・週トータル）に入る。
設計 §14 の未決（バッジの成果系、到達予測、ヒートマップの濃淡）は、そのデータを見て決める。

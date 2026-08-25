import { Fragment, useMemo, useRef } from 'react';
import { ExerciseManager } from '../components/training/ExerciseManager';
import { exportCsv, exportJson, readImportFile } from '../lib/io';
import { SEED_SOURCE } from '../lib/seed';
import { THEME_OPTIONS } from '../lib/themes';
import type { BodyData } from '../hooks/useBodyData';
import type { ThemePref } from '../types';
import ui from '../styles/ui.module.scss';
import s from './SettingsView.module.scss';

/**
 * 設定はカテゴリを選んでから中身を出す。
 * 1 画面に全部並べると縦に長くなり、目当ての項目を探すのにスクロールが要る。
 *
 * カテゴリは「何についての設定か」で切る。階層は 1 段だけで、
 * 1 つの画面に複数のカードが載る。
 * 遷移先は URL に載せる（`#settings/general`）ので、戻る操作とリロードで位置が保たれる。
 *
 * 置くのは「滅多に変えない定義」だけ。目標体重も週のセット数も種目の目標も、
 * 進捗を見ながら何度も変わるので目標タブが持つ。
 * 頻度の違うものを同じ階層に置いたのが、画面を往復する原因だった。
 */
export const SETTINGS_SECTIONS = [
  { id: 'general', label: '一般', hint: '表示・データ・このアプリについて' },
  { id: 'training', label: 'トレーニング', hint: '種目の追加・並び・詳細設定' },
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]['id'];

export function settingsSectionTitle(id: string): string | null {
  return SETTINGS_SECTIONS.find((sec) => sec.id === id)?.label ?? null;
}

interface Props {
  body: BodyData;
  section: string | null;
  onOpen: (section: SettingsSectionId | null) => void;
  onToast: (message: string) => void;
}

export function SettingsView({ body, section, onOpen, onToast }: Props) {
  const {
    data,
    daily,
    weeks,
    sessions,
    updateSettings,
    importData,
    clearRecords,
    clearAll,
    addExercises,
    upsertExercise,
    removeExercise,
    moveExercise,
  } = body;

  // 種目を消すとその記録も消えるので、何日ぶんが消えるかを確認ダイアログに出す
  const usage = useMemo(() => {
    const map = new Map<string, number>();
    for (const day of Object.values(data.workouts)) {
      for (const entry of day) map.set(entry.exerciseId, (map.get(entry.exerciseId) ?? 0) + 1);
    }
    return map;
  }, [data.workouts]);

  const fileRef = useRef<HTMLInputElement>(null);
  const { settings } = data;

  const handleImport = async (file: File) => {
    try {
      const result = await readImportFile(file);
      const found = [
        result.count > 0 ? `体組成 ${result.count}日ぶん` : null,
        result.exerciseCount > 0 ? `種目 ${result.exerciseCount}件` : null,
        result.sessionCount > 0 ? `トレーニング ${result.sessionCount}日ぶん` : null,
      ].filter(Boolean);

      if (found.length === 0) {
        onToast('読み込める記録がありませんでした');
        return;
      }
      const replace = confirm(
        `${found.join(' / ')}を読み込みます。\n\n[OK] 既存の記録を置き換える\n[キャンセル] 既存に上書きマージする`,
      );
      importData(result, replace ? 'replace' : 'merge');
      onToast(`${found.join(' / ')}を読み込みました`);
    } catch {
      onToast('ファイルを読み込めませんでした');
    }
  };

  /* ---------------- カテゴリ一覧 ---------------- */

  if (section == null) {
    return (
      <section className={ui.card}>
        <div className={s.menu}>
          {SETTINGS_SECTIONS.map((sec) => (
            <button key={sec.id} type="button" className={s.row} onClick={() => onOpen(sec.id)}>
              <span className={s.label}>
                {sec.label}
                <small className={s.hint}>{sec.hint}</small>
              </span>
              <span className={s.chevron} aria-hidden="true">
                ›
              </span>
            </button>
          ))}
        </div>
      </section>
    );
  }

  /* ---------------- トレーニング ---------------- */

  if (section === 'training') {
    return (
      <ExerciseManager
        exercises={data.exercises}
        usage={usage}
        onAdd={addExercises}
        onUpdate={upsertExercise}
        onRemove={removeExercise}
        onMove={moveExercise}
      />
    );
  }

  /* ---------------- 一般 ---------------- */

  return (
    <>
      <section className={ui.card}>
        <header className={ui.cardHeader}>
          <h2 className={ui.cardTitle}>表示</h2>
        </header>
        <div className={ui.formRow}>
          <label htmlFor="theme">テーマ</label>
          <select
            id="theme"
            value={settings.theme}
            onChange={(e) => updateSettings({ theme: e.target.value as ThemePref })}
          >
            {THEME_OPTIONS.map((theme) =>
              theme.id === 'system' ? (
                // 端末に従うものと、配色を名指しで選ぶものの境目。
                // option で線を引くと 1 行ぶんの高さを取るので hr にする
                // （古いブラウザは無視するだけで、選択肢は壊れない）
                <Fragment key={theme.id}>
                  <option value={theme.id}>{theme.label}</option>
                  <hr />
                </Fragment>
              ) : (
                <option key={theme.id} value={theme.id}>
                  {theme.label}
                </option>
              ),
            )}
          </select>
        </div>
      </section>

      <section className={ui.card}>
        <header className={ui.cardHeader}>
          <h2 className={ui.cardTitle}>データ</h2>
          <span className={ui.hint}>
            体組成 {Object.keys(data.entries).length}日 / トレ {Object.keys(data.workouts).length}日
          </span>
        </header>

        <p className={ui.note}>
          記録はこの端末のブラウザ内にだけ保存されます。機種変更やブラウザのデータ消去に備えて、
          ときどき JSON を書き出しておくと安全です。
        </p>

        <div className={s.groupLabel}>バックアップ</div>
        <div className={ui.btnRow}>
          <button type="button" className={ui.btn} onClick={() => exportJson(data)}>
            JSONで書き出し
          </button>
          <button type="button" className={ui.btn} onClick={() => fileRef.current?.click()}>
            JSONから読み込み
          </button>
        </div>

        <div className={s.groupLabel}>
          Excel 用に書き出す<small>読み込みには使えません</small>
        </div>
        <div className={ui.btnRow}>
          <button
            type="button"
            className={ui.btn}
            onClick={() => exportCsv(daily, weeks, sessions)}
          >
            CSVで書き出し
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleImport(file);
            e.target.value = '';
          }}
        />

        <div className={s.groupLabel}>削除</div>
        <div className={ui.btnRow}>
          <button
            type="button"
            className={`${ui.btn} ${ui.btnGhost} ${ui.btnDanger}`}
            onClick={() => {
              if (
                confirm('体組成とトレーニングの実績を削除します。種目は残ります。元に戻せません。')
              ) {
                clearRecords();
                onToast('実績データを削除しました');
              }
            }}
          >
            実績データを削除
          </button>
          <button
            type="button"
            className={`${ui.btn} ${ui.btnGhost} ${ui.btnDanger}`}
            onClick={() => {
              if (confirm('種目を含むすべてを削除します。元に戻せません。よろしいですか？')) {
                clearAll();
                onToast('すべて削除しました');
              }
            }}
          >
            すべて削除
          </button>
        </div>

        <p className={ui.note}>
          自分で作った種目は、削除すると JSON バックアップからしか戻せません。
        </p>
      </section>

      <section className={ui.card}>
        <header className={ui.cardHeader}>
          <h2 className={ui.cardTitle}>このアプリについて</h2>
          <span className={ui.hint}>v{__APP_VERSION__}</span>
        </header>

        <div className={ui.formRow}>
          <label>バージョン</label>
          <span>{__APP_VERSION__}</span>
        </div>

        <p className={ui.note}>
          <b>記録はこの端末の中だけに保存されます。</b>
          サーバーへ送信することはなく、作成者を含む第三者が内容を見ることはありません。
          自動で公開・共有されることもありません。外に出るのは、あなたが自分で書き出したファイルだけです。
          <br />
          <br />
          通信なしで動作します。ホーム画面に追加すると、オフラインでもアプリとして起動します。
          <br />
          <br />
          初期データは {SEED_SOURCE} の「日次記録」シートから取り込んだ作成者の実測値です。
          設定の「データ」から消せます。
        </p>
      </section>
    </>
  );
}

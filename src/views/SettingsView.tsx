import { Fragment, useMemo, useRef, useState } from 'react';
import { Modal } from '../components/Modal';
import { CheckSettingsForm } from '../components/training/CheckSettingsForm';
import { ExerciseManager } from '../components/training/ExerciseManager';
import { PresetManager } from '../components/training/PresetManager';
import { exportJson, readImportFile } from '../lib/io';
import { markExported } from '../lib/device';
import { storedBytes } from '../lib/storage';
import { useStorageQuota } from '../hooks/useStorageSafety';
import { fmtBytes } from '../lib/format';
import type { ImportResult } from '../lib/io';
import { DEMO_TODAY, formatMD } from '../lib/date';
import { IS_DEMO } from '../lib/env';
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
  { id: 'training', label: 'トレーニング', hint: 'マイ種目・プリセット' },
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]['id'];

/**
 * トレーニングの中は、扱うものが 2 つある。
 *
 * **マイ種目** … カタログから選んで自分の手元に置いた種目。記録で選べるのはここにあるものだけ。
 * **プリセット** … その種目を組み合わせて名前を付けたもの。
 *
 * 1 枚に積むと、種目の一覧（数十件）の下にプリセットが埋もれる。
 * 段を 1 つ増やすぶんの往復より、目当てのものが件数で見えているほうが速い。
 */
export const TRAINING_PAGES = [
  { id: 'exercises', label: 'マイ種目', hint: '一覧・追加・種目ごとの設定' },
  { id: 'presets', label: 'プリセット', hint: '組み合わせの確認・編集' },
  /*
   * 判定そのもの（何が警告されているか）は記録画面とプリセット画面にある。
   * ここに置くのは滅多に変えない閾値と、押した許容を戻す場所だけ。
   */
  { id: 'checks', label: 'トレーニング種目のレビュー', hint: '有効化・しきい値・許容済み' },
] as const;

export type TrainingPageId = (typeof TRAINING_PAGES)[number]['id'];

export function settingsSectionTitle(id: string): string | null {
  return SETTINGS_SECTIONS.find((sec) => sec.id === id)?.label ?? null;
}

/** 下位画面まで含めた見出し。`#settings/training/presets` は「プリセット」 */
export function settingsTitle(section: string | null, page: string | null): string | null {
  if (section == null) return null;
  const inner = section === 'training' ? TRAINING_PAGES.find((p) => p.id === page) : null;
  return inner?.label ?? settingsSectionTitle(section);
}

interface Props {
  body: BodyData;
  section: string | null;
  /** セクションの中の画面。`#settings/training/presets` の presets */
  page?: string | null;
  onOpen: (section: SettingsSectionId | null, page?: TrainingPageId | null) => void;
  /** マイ種目の行から、その種目の目標へ（目標タブが持つ） */
  onToast: (message: string) => void;
}

export function SettingsView({ body, section, page = null, onOpen, onToast }: Props) {
  const quota = useStorageQuota();
  const {
    data,
    sessions,
    updateSettings,
    importData,
    clearRecords,
    clearAll,
    addExercises,
    upsertExercise,
    removeExercise,
    savePreset,
    updatePreset,
    removePreset,
    updateChecks,
    unsuppressWarning,
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

  /*
   * 読み込み方は 3 択（マージ / 置き換え / やめる）。
   *
   * confirm() は 2 択しか持てないので、以前は [キャンセル] にマージを割り当てていた。
   * 取り消すつもりで押した人のデータが混ざるので、選ばせる面をこちらで持つ。
   */
  const [pending, setPending] = useState<{ result: ImportResult; found: string } | null>(null);

  const handleImport = async (file: File) => {
    try {
      const result = await readImportFile(file);
      const found = [
        result.count > 0 ? `体組成 ${result.count}日ぶん` : null,
        result.exerciseCount > 0 ? `種目 ${result.exerciseCount}件` : null,
        result.sessionCount > 0 ? `トレーニング ${result.sessionCount}日ぶん` : null,
        result.presetCount > 0 ? `プリセット ${result.presetCount}件` : null,
      ].filter(Boolean);

      if (found.length === 0) {
        onToast('読み込める記録がありませんでした');
        return;
      }
      setPending({ result, found: found.join(' / ') });
    } catch {
      onToast('ファイルを読み込めませんでした');
    }
  };

  const runImport = (mode: 'merge' | 'replace') => {
    if (!pending) return;
    importData(pending.result, mode);
    onToast(`${pending.found}を${mode === 'replace' ? '置き換えました' : '読み込みました'}`);
    setPending(null);
  };

  const importModal = pending && (
    <Modal open title="バックアップから読み込む" onClose={() => setPending(null)}>
      <div>
        <p className={ui.note} style={{ marginTop: 0 }}>
          このファイルには {pending.found} が入っています。
        </p>

        <div className={ui.btnRow}>
          <button
            type="button"
            className={`${ui.btn} ${ui.btnPrimary}`}
            onClick={() => runImport('merge')}
          >
            いまの記録に足す
          </button>
        </div>
        <p className={ui.note}>同じ日付は読み込んだファイルの値で上書きし、それ以外は残します。</p>

        <div className={ui.btnRow}>
          <button
            type="button"
            className={`${ui.btn} ${ui.btnGhost} ${ui.btnDanger}`}
            onClick={() => runImport('replace')}
          >
            いまの記録を置き換える
          </button>
        </div>
        <p className={ui.note}>いまの記録は消えます。元に戻せません。</p>

        <div className={ui.btnRow}>
          <button
            type="button"
            className={`${ui.btn} ${ui.btnGhost}`}
            onClick={() => setPending(null)}
          >
            やめる
          </button>
        </div>
      </div>
    </Modal>
  );

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
    const counts: Record<TrainingPageId, number> = {
      exercises: data.exercises.length,
      presets: data.presets.length,
      // 件数として意味があるのは「押した許容」の数。閾値は数えても仕方がない
      checks: data.suppressed.length,
    };

    if (page === 'checks') {
      return (
        <CheckSettingsForm
          checks={data.checks}
          suppressed={data.suppressed}
          exercises={data.exercises}
          onUpdate={updateChecks}
          onUnsuppress={unsuppressWarning}
        />
      );
    }

    if (page === 'presets') {
      return (
        <PresetManager
          presets={data.presets}
          exercises={data.exercises}
          onCreate={savePreset}
          onUpdate={updatePreset}
          onRemove={removePreset}
          onAddExercises={addExercises}
        />
      );
    }

    if (page === 'exercises') {
      return (
        <ExerciseManager
          exercises={data.exercises}
          usage={usage}
          onAdd={addExercises}
          onUpdate={upsertExercise}
          onRemove={removeExercise}
          sessions={sessions}
        />
      );
    }

    return (
      <section className={ui.card}>
        <div className={s.menu}>
          {TRAINING_PAGES.map((p) => (
            <button
              key={p.id}
              type="button"
              className={s.row}
              onClick={() => onOpen('training', p.id)}
            >
              <span className={s.label}>
                {p.label}
                <small className={s.hint}>{p.hint}</small>
              </span>
              <span className={s.count}>
                {p.id === 'checks'
                  ? counts[p.id] === 0
                    ? ''
                    : `許容 ${counts[p.id]}件`
                  : `${counts[p.id]}件`}
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

        {/*
          いま何バイト使っているかを出す。上限は端末の空き容量から決まるので**決め打たない**。
          ブラウザが答えるときだけ、その値を横に添える。
          （記録は 1 日 100 バイト前後で増える。1MB を超えたら保存の作りを見直す合図）
        */}
        <div className={ui.formRow}>
          <label>
            保存サイズ
            <small>
              {quota == null
                ? 'この端末のブラウザ内'
                : `この端末で使える見積もりは ${fmtBytes(quota)}`}
            </small>
          </label>
          <span className={s.size}>{fmtBytes(storedBytes(data))}</span>
        </div>

        <p className={ui.note}>
          記録はこの端末のブラウザ内にだけ保存されます。機種変更やブラウザのデータ消去に備えて、
          ときどき JSON を書き出しておくと安全です。
        </p>

        <div className={s.groupLabel}>バックアップ</div>
        <div className={ui.btnRow}>
          <button
            type="button"
            className={ui.btn}
            onClick={() => {
              exportJson(data);
              // ホームの促し（components/SafetyNotices.tsx）は、この日付を起点にする
              markExported();
            }}
          >
            JSONで書き出し
          </button>
          <button type="button" className={ui.btn} onClick={() => fileRef.current?.click()}>
            JSONから読み込み
          </button>
        </div>

        {importModal}

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
          {IS_DEMO && (
            <>
              <br />
              <br />
              初期データは {SEED_SOURCE}{' '}
              です。体組成も筋トレも、作成者が実際に使っている記録をそのまま入れています。
              <br />
              <br />
              このデモは開き直すたびに初期データへ戻ります。ここで入力した内容は残りません。
              今日は記録の最終日（{formatMD(DEMO_TODAY)}）で止めてあります。
            </>
          )}
        </p>
      </section>
    </>
  );
}

import { useMemo, useRef, useState } from 'react';
import { Modal } from '../components/Modal';
import { useConfirm } from '../components/ConfirmDialog';
import { CheckSettingsForm } from '../components/training/CheckSettingsForm';
import { WeightUnitForm } from '../components/training/WeightUnitForm';
import { ExerciseManager } from '../components/training/ExerciseManager';
import { PresetManager } from '../components/training/PresetManager';
import { WeekMenuManager } from '../components/training/WeekMenuManager';
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
import { useT } from '../lib/i18n';
import type { LocalePref, MessageKey } from '../lib/i18n';
import { WEIGHT_UNIT_LABEL } from '../lib/weight';
import type { BodyData } from '../hooks/useBodyData';
import { CardHeader } from '../components/CardHeader';
import { Button } from '../components/Button';
import { Pill } from '../components/Pill';
import { Select } from '../components/Select';
import { NumericInput } from '../components/NumericInput';
import { HEIGHT_RANGE } from '../lib/storage';
import ui from '../styles/ui.module.scss';
import s from './SettingsView.module.scss';

/**
 * 言語の選択肢。**文言はキーで持つ**——ここで直書きすると、
 * 言語の欄自体が言語で変わらないものになる。
 */
const LOCALE_OPTIONS: { id: LocalePref; key: MessageKey }[] = [
  { id: 'system', key: 'common.followDevice' },
  { id: 'ja', key: 'settings.language.ja' },
  { id: 'en', key: 'settings.language.en' },
];

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
  { id: 'general', key: 'settings.general', hint: 'settings.generalHint' },
  { id: 'body', key: 'nav.body', hint: 'settings.bodyHint' },
  { id: 'training', key: 'nav.training', hint: 'settings.trainingHint' },
] as const satisfies readonly { id: string; key: MessageKey; hint: MessageKey }[];

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
  { id: 'exercises', key: 'settings.exercises', hint: 'settings.exercisesHint', group: 'own' },
  { id: 'presets', key: 'settings.presets', hint: 'settings.presetsHint', group: 'own' },
  /*
   * **曜日を持つプリセットだけを、7 日ぶんの並びとして読む面。**
   * 毎週やるものと、そのとき選ぶものを 1 枚に混ぜると、どちらのつもりで
   * 作ったものか一覧から読めなくなる。持ちものは同じで、面だけ分ける。
   */
  { id: 'week', key: 'settings.week', hint: 'settings.weekHint', group: 'own' },
  /*
   * 判定そのもの（何が警告されているか）は記録画面とプリセット画面にある。
   * ここに置くのは滅多に変えない閾値と、押した許容を戻す場所だけ。
   */
  { id: 'units', key: 'settings.units', hint: 'settings.unitsHint', group: 'config' },
  { id: 'checks', key: 'settings.checks', hint: 'settings.checksHint', group: 'config' },
] as const satisfies readonly {
  id: string;
  key: MessageKey;
  hint: MessageKey;
  group: string;
}[];

/**
 * 一覧の区切り。**性質の違うものが同じ形で並ぶのをやめる。**
 *
 * 5 行が「名前＋件数＋›」の同じ形だったので、どれがどの種類かはラベルを
 * 読むまで分からなかった。種目を足しに来た人は上だけ、単位を直しに来た人は
 * 下だけを見ればよくなる。
 *
 * **見出しは中身の名前にする。**「持ちもの」「設定」と呼んでいた頃は、
 * こちらの造語なうえ `設定 > トレーニング > 設定` と入れ子になっていた。
 * 探しに来た人が使う言葉に寄せる。
 *
 * **段は増やさない。**畳むと、いちばんよく開く 3 つ（マイ種目・プリセット・
 * 週メニュー）が 1 タップ遠くなる。5 行はまだ画面に収まる。
 */
const PAGE_GROUPS = [
  { id: 'own', key: 'settings.groupOwn' },
  { id: 'config', key: 'settings.groupConfig' },
] as const satisfies readonly { id: string; key: MessageKey }[];

export type TrainingPageId = (typeof TRAINING_PAGES)[number]['id'];

export function settingsSectionKey(id: string): MessageKey | null {
  return SETTINGS_SECTIONS.find((sec) => sec.id === id)?.key ?? null;
}

/**
 * 下位画面まで含めた見出しの**キー**。`#settings/training/presets` は「プリセット」。
 *
 * **文言ではなくキーを返す。**ここは画面ではないので `useT` を呼べない
 * （フックは部品の中でしか使えない）。引く場所は呼び出し側にある。
 */
export function settingsTitleKey(section: string | null, page: string | null): MessageKey | null {
  if (section == null) return null;
  const inner = section === 'training' ? TRAINING_PAGES.find((p) => p.id === page) : null;
  return inner?.key ?? settingsSectionKey(section);
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
  const t = useT();

  /*
   * 読み込み方は 3 択（マージ / 置き換え / やめる）。
   *
   * confirm() は 2 択しか持てないので、以前は [キャンセル] にマージを割り当てていた。
   * 取り消すつもりで押した人のデータが混ざるので、選ばせる面をこちらで持つ。
   */
  const [pending, setPending] = useState<{ result: ImportResult; found: string } | null>(null);
  const [ask, confirmDialog] = useConfirm();

  const handleImport = async (file: File) => {
    try {
      const result = await readImportFile(file);
      const found = [
        result.count > 0 ? t('import.body', { n: result.count }) : null,
        result.exerciseCount > 0 ? t('training.exercises', { n: result.exerciseCount }) : null,
        result.sessionCount > 0 ? t('import.training', { n: result.sessionCount }) : null,
        result.presetCount > 0 ? t('import.presets', { n: result.presetCount }) : null,
      ].filter(Boolean);

      if (found.length === 0) {
        onToast(t('import.empty'));
        return;
      }
      setPending({ result, found: found.join(' / ') });
    } catch {
      onToast(t('import.failed'));
    }
  };

  const runImport = (mode: 'merge' | 'replace') => {
    if (!pending) return;
    importData(pending.result, mode);
    onToast(
      mode === 'replace'
        ? t('import.doneReplace', { found: pending.found })
        : t('import.doneMerge', { found: pending.found }),
    );
    setPending(null);
  };

  const importModal = pending && (
    <Modal open title={t('import.title')} onClose={() => setPending(null)}>
      <div>
        <p className={ui.note} style={{ marginTop: 0 }}>
          {t('import.contains', { found: pending.found })}
        </p>

        <div className={ui.btnRow}>
          <Button tone="primary" onClick={() => runImport('merge')}>
            {t('import.merge')}
          </Button>
        </div>
        <p className={ui.note}>{t('import.mergeNote')}</p>

        <div className={ui.btnRow}>
          <Button tone="danger" onClick={() => runImport('replace')}>
            {t('import.replace')}
          </Button>
        </div>
        <p className={ui.note}>{t('import.replaceNote')}</p>

        <div className={ui.btnRow}>
          <Button tone="ghost" onClick={() => setPending(null)}>
            {t('common.stop')}
          </Button>
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
                {t(sec.key)}
                <small className={s.hint}>{t(sec.hint)}</small>
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

  /* ---------------- 体組成 ---------------- */

  /*
   * 測る項目そのものの定義。滅多に変えないので設定タブが持つ。
   * 目標体重のように進捗を見ながら変わる値は目標タブ。
   */
  if (section === 'body') {
    return (
      <section className={ui.card}>
        {/*
          **身長は目標ではなく定義。**伸びも縮みもしないので、進捗を見ながら
          触るものではない（目標タブが持つのは「進捗で変わる値」）。
          目標の面には BMI を読む側だけを残す。
        */}
        <div className={ui.formRow}>
          <label htmlFor="height">
            {t('settings.height')}
            <small>{t('settings.heightHint')}</small>
          </label>
          <span className={ui.inputUnit}>
            <NumericInput
              id="height"
              value={settings.heightCm}
              min={HEIGHT_RANGE[0]}
              max={HEIGHT_RANGE[1]}
              placeholder="—"
              onCommit={(heightCm) => updateSettings({ heightCm })}
            />
            <span>cm</span>
          </span>
        </div>

        <div className={ui.formRow}>
          <label id="waist-enabled">{t('settings.waistToggle')}</label>
          <Pill
            pressed={settings.waistEnabled}
            label={t('settings.waistToggle')}
            onClick={() => updateSettings({ waistEnabled: !settings.waistEnabled })}
          >
            {settings.waistEnabled ? t('settings.on') : t('settings.off')}
          </Pill>
        </div>
        <p className={ui.note}>{t('settings.waistNote')}</p>
      </section>
    );
  }

  /* ---------------- トレーニング ---------------- */

  if (section === 'training') {
    const counts: Record<TrainingPageId, number> = {
      exercises: data.exercises.length,
      presets: data.presets.length,
      // 週メニューは「曜日を持つものを並べ直した見え方」なので、数えるのも曜日で
      week: data.presets.filter((p) => p.weekdays.length > 0 && !p.hidden).length,
      // 件数として意味があるのは「押した許容」の数。閾値は数えても仕方がない
      checks: data.suppressed.length,
      // 件数で語れるものが無い。行には選んでいる単位を出す（下の count のところ）
      units: 0,
    };

    if (page === 'units') {
      return <WeightUnitForm settings={settings} onUpdate={updateSettings} />;
    }

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

    if (page === 'week') {
      return (
        <WeekMenuManager
          presets={data.presets}
          exercises={data.exercises}
          groupGoals={data.groupGoals}
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
          // 記録の移行に使う（workouts と体重が要る）
          body={body}
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
          {PAGE_GROUPS.flatMap((g) => [
            <p key={g.id} className={s.groupLabel}>
              {t(g.key)}
            </p>,
            ...TRAINING_PAGES.filter((p) => p.group === g.id).map((p) => (
              <button
                key={p.id}
                type="button"
                className={s.row}
                onClick={() => onOpen('training', p.id)}
              >
                <span className={s.label}>
                  {t(p.key)}
                  <small className={s.hint}>{t(p.hint)}</small>
                </span>
                <span className={s.count}>
                  {p.id === 'units'
                    ? `${WEIGHT_UNIT_LABEL[settings.inputWeightUnit]} / ${WEIGHT_UNIT_LABEL[settings.displayWeightUnit]}`
                    : p.id === 'checks'
                      ? counts[p.id] === 0
                        ? ''
                        : t('settings.suppressed', { n: counts[p.id]! })
                      : t('settings.count', { n: counts[p.id]! })}
                </span>
                <span className={s.chevron} aria-hidden="true">
                  ›
                </span>
              </button>
            )),
          ])}
        </div>
      </section>
    );
  }

  /* ---------------- 一般 ---------------- */

  return (
    <>
      <section className={ui.card}>
        <CardHeader title={t('settings.display')} />
        {/*
          言語。**テーマの隣**——どちらも「読むときの見え方」で、記録には関わらない。
          文言は辞書から引く（この欄自体が最初の利用者になる）。
        */}
        <div className={ui.formRow}>
          <label htmlFor="locale">{t('settings.language')}</label>
          <Select
            id="locale"
            value={settings.locale}
            options={LOCALE_OPTIONS.map((o) => ({ id: o.id, label: t(o.key) }))}
            dividerAfter="system"
            onChange={(locale) => updateSettings({ locale })}
          />
        </div>

        <div className={ui.formRow}>
          <label htmlFor="theme">{t('settings.theme')}</label>
          {/* 端末に従うものと、配色を名指しで選ぶものの境目に線を引く */}
          <Select
            id="theme"
            value={settings.theme}
            options={THEME_OPTIONS.map((o) => ({
              id: o.id,
              // 配色の名前は訳さない。訳すのは「システムに合わせる」だけ
              label: o.id === 'system' ? t('common.followDevice') : o.label,
            }))}
            dividerAfter="system"
            onChange={(theme) => updateSettings({ theme })}
          />
        </div>
      </section>

      <section className={ui.card}>
        <CardHeader
          title={t('settings.data')}
          hint={
            <>
              {t('settings.dataHint', {
                days: Object.keys(data.entries).length,
                training: Object.keys(data.workouts).length,
              })}
            </>
          }
        />

        {/*
          いま何バイト使っているかを出す。上限は端末の空き容量から決まるので**決め打たない**。
          ブラウザが答えるときだけ、その値を横に添える。
          （記録は 1 日 100 バイト前後で増える。1MB を超えたら保存の作りを見直す合図）
        */}
        <div className={ui.formRow}>
          <label>
            {t('settings.storageSize')}
            <small>
              {quota == null
                ? t('settings.storageLocal')
                : t('settings.storageQuota', { size: fmtBytes(quota) })}
            </small>
          </label>
          <span className={s.size}>{fmtBytes(storedBytes(data))}</span>
        </div>

        <p className={ui.note}>{t('settings.storageNote')}</p>

        <div className={s.groupLabel}>{t('settings.backup')}</div>
        <div className={ui.btnRow}>
          <Button
            onClick={() => {
              exportJson(data);
              // ホームの促し（components/SafetyNotices.tsx）は、この日付を起点にする
              markExported();
            }}
          >
            {t('common.exportJson')}
          </Button>
          <Button onClick={() => fileRef.current?.click()}>{t('settings.importJson')}</Button>
        </div>

        {importModal}

        {/*
          ファイル選択だけは素の input のまま。**見えない的**（`hidden`）で、
          押すのは上のボタン。見た目も打つ作法も持たないので、部品にすると
          包むだけの層が増える。アプリ中でここ 1 か所。
        */}
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

        <div className={s.groupLabel}>{t('settings.delete')}</div>
        <div className={ui.btnRow}>
          <Button
            tone="danger"
            onClick={() =>
              ask({
                title: t('settings.clearRecords'),
                note: t('settings.clearRecordsNote'),
                confirmLabel: t('settings.clearRecordsConfirm'),
                destructive: true,
                onConfirm: () => {
                  clearRecords();
                  onToast(t('settings.clearRecordsDone'));
                },
              })
            }
          >
            {t('settings.clearRecordsConfirm')}
          </Button>
          <Button
            tone="danger"
            onClick={() =>
              ask({
                title: t('settings.clearAll'),
                note: t('settings.clearAllNote'),
                confirmLabel: t('settings.deleteAll'),
                destructive: true,
                onConfirm: () => {
                  clearAll();
                  onToast(t('settings.clearAllDone'));
                },
              })
            }
          >
            {t('settings.deleteAll')}
          </Button>
        </div>

        <p className={ui.note}>{t('settings.deleteNote')}</p>
      </section>

      <section className={ui.card}>
        <CardHeader title={t('settings.about')} hint={<>v{__APP_VERSION__}</>} />

        <div className={ui.formRow}>
          <label>{t('settings.version')}</label>
          <span>{__APP_VERSION__}</span>
        </div>

        <p className={ui.note}>
          <b>{t('about.localOnly')}</b>
          {t('about.noServer')}
          <br />
          <br />
          {t('about.offline')}
          {IS_DEMO && (
            <>
              <br />
              <br />
              {t('about.demoSeed', { source: SEED_SOURCE })}
              <br />
              <br />
              {t('about.demoReset')}
              {t('about.demoToday', { date: formatMD(DEMO_TODAY) })}
            </>
          )}
        </p>
      </section>

      {confirmDialog}
    </>
  );
}

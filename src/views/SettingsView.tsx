import { useRef } from 'react';
import { exportCsv, exportJson, readImportFile } from '../lib/io';
import { SEED_SOURCE } from '../lib/seed';
import { BODYFAT_RANGE, HEIGHT_RANGE, WEIGHT_RANGE } from '../lib/storage';
import { NumericInput } from '../components/NumericInput';
import type { BodyData } from '../hooks/useBodyData';
import type { ThemePref } from '../types';
import ui from '../styles/ui.module.scss';

interface Props {
  body: BodyData;
  onToast: (message: string) => void;
}

const THEMES: { id: ThemePref; label: string }[] = [
  { id: 'system', label: '端末に合わせる' },
  { id: 'light', label: 'ライト' },
  { id: 'dark', label: 'ダーク' },
];

export function SettingsView({ body, onToast }: Props) {
  const { data, daily, weeks, updateSettings, mergeEntries, clearAll } = body;
  const fileRef = useRef<HTMLInputElement>(null);
  const { settings } = data;

  const handleImport = async (file: File) => {
    try {
      const result = await readImportFile(file);
      if (result.count === 0) {
        onToast('読み込める記録がありませんでした');
        return;
      }
      const replace = confirm(
        `${result.count}日ぶんの記録を読み込みます。\n\n[OK] 既存の記録を置き換える\n[キャンセル] 既存に上書きマージする`,
      );
      mergeEntries(result.entries, replace ? 'replace' : 'merge');
      if (result.settings) updateSettings(result.settings);
      onToast(`${result.count}日ぶんを読み込みました`);
    } catch {
      onToast('ファイルを読み込めませんでした');
    }
  };

  return (
    <>
      <section className={ui.card}>
        <header className={ui.cardHeader}>
          <h2 className={ui.cardTitle}>目標</h2>
        </header>

        <div className={ui.formRow}>
          <label htmlFor="target-weight">
            目標体重
            <small>到達予測と進捗バーの基準になります</small>
          </label>
          <NumericInput
            id="target-weight"
            value={settings.targetWeight}
            min={WEIGHT_RANGE[0]}
            max={WEIGHT_RANGE[1]}
            placeholder="kg"
            onCommit={(v) => updateSettings({ targetWeight: v })}
          />
        </div>

        <div className={ui.formRow}>
          <label htmlFor="target-bf">目標体脂肪率</label>
          <NumericInput
            id="target-bf"
            value={settings.targetBodyFat}
            min={BODYFAT_RANGE[0]}
            max={BODYFAT_RANGE[1]}
            placeholder="%"
            onCommit={(v) => updateSettings({ targetBodyFat: v })}
          />
        </div>

        <div className={ui.formRow}>
          <label htmlFor="target-date">
            目標日
            <small>必要ペースを逆算します</small>
          </label>
          <input
            id="target-date"
            type="date"
            value={settings.targetDate ?? ''}
            onChange={(e) => updateSettings({ targetDate: e.target.value || null })}
          />
        </div>

        <div className={ui.formRow}>
          <label htmlFor="height">
            身長
            <small>BMI の計算に使います（任意）</small>
          </label>
          <NumericInput
            id="height"
            value={settings.heightCm}
            min={HEIGHT_RANGE[0]}
            max={HEIGHT_RANGE[1]}
            placeholder="cm"
            onCommit={(v) => updateSettings({ heightCm: v })}
          />
        </div>
      </section>

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
            {THEMES.map((theme) => (
              <option key={theme.id} value={theme.id}>
                {theme.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className={ui.card}>
        <header className={ui.cardHeader}>
          <h2 className={ui.cardTitle}>データ</h2>
          <span className={ui.hint}>{Object.keys(data.entries).length}日ぶん</span>
        </header>

        <p className={ui.note}>
          記録はこの端末のブラウザ内にだけ保存されます。機種変更やブラウザのデータ消去に備えて、
          ときどき JSON を書き出しておくと安全です。
        </p>

        <div className={ui.btnRow}>
          <button type="button" className={ui.btn} onClick={() => exportJson(data)}>
            JSONで書き出し
          </button>
          <button type="button" className={ui.btn} onClick={() => exportCsv(daily, weeks)}>
            CSVで書き出し
          </button>
          <button type="button" className={ui.btn} onClick={() => fileRef.current?.click()}>
            ファイルから読み込み
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".json,.csv,application/json,text/csv"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleImport(file);
            e.target.value = '';
          }}
        />

        <div className={ui.btnRow}>
          <button
            type="button"
            className={`${ui.btn} ${ui.btnGhost} ${ui.btnDanger}`}
            onClick={() => {
              if (confirm('すべての記録を削除します。元に戻せません。よろしいですか？')) {
                clearAll();
                onToast('すべての記録を削除しました');
              }
            }}
          >
            すべての記録を削除
          </button>
        </div>
      </section>

      <section className={ui.card}>
        <header className={ui.cardHeader}>
          <h2 className={ui.cardTitle}>このアプリについて</h2>
        </header>
        <p className={ui.note}>
          初期データは {SEED_SOURCE} の「日次記録」シートから取り込んでいます。
          日平均・週次集計・体脂肪量・除脂肪体重の計算式はエクセルと同じ定義です（週は日曜〜土曜）。
          <br />
          <br />
          ホーム画面に追加するとオフラインでも起動します。
        </p>
      </section>
    </>
  );
}

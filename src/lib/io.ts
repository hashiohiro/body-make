import type {
  AppData,
  CheckSettings,
  Entries,
  Exercise,
  GroupGoals,
  Preset,
  Workouts,
} from '../types';
import { todayISO } from './date';
import { fmt } from './format';
import { sanitizeData, sanitizeEntries } from './storage';

function download(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // revoke を次のタスクに回さないと Safari でダウンロードが中断される
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportJson(data: AppData): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  download(`bodymake-${todayISO()}.json`, blob);
}

/** state へ流し込む中身。null は「このファイルには含まれていない＝現状維持」 */
export interface ImportPayload {
  entries: Entries;
  settings: AppData['settings'] | null;
  exercises: Exercise[] | null;
  workouts: Workouts | null;
  /** 種目の組み合わせ。バックアップに入っていれば戻す */
  presets: Preset[] | null;
  /** 週の部位別セット数の目標 */
  groupGoals: GroupGoals | null;
  /** 構成チェックの閾値 */
  checks: CheckSettings | null;
  /** 許容済みにした警告 */
  suppressed: string[] | null;
}

export interface ImportResult extends ImportPayload {
  /** 取り込んだ日数・種目数・セッション数・プリセット数（確認ダイアログの文言に使う） */
  count: number;
  exerciseCount: number;
  sessionCount: number;
  presetCount: number;
}

/**
 * 取り込めるのは JSON だけ。**書き出す形式も JSON だけ。**
 *
 * 以前は Excel 用に CSV も書き出していたが、廃止した。
 * 書き出し口が 2 つあると、片方が「バックアップ」として使われる。
 * CSV は体組成と明細しか運べないので、それで復元できると思われた時点で
 * 種目・目標・設定が失われる。**戻せる形式だけを出す。**
 */
export async function readImportFile(file: File): Promise<ImportResult> {
  const raw = JSON.parse((await file.text()).trim()) as Record<string, unknown>;

  // アプリ全体のバックアップと、entries だけの JSON の両方を受け付ける
  const looksLikeBackup =
    'entries' in raw ||
    'settings' in raw ||
    'exercises' in raw ||
    'workouts' in raw ||
    'presets' in raw ||
    'groupGoals' in raw ||
    'checks' in raw;
  const data = looksLikeBackup ? sanitizeData(raw) : null;
  const entries = data ? data.entries : sanitizeEntries(raw);
  // キーがあるものだけ取り込む。無いファイルでは現状を残す
  const exercises = data && 'exercises' in raw ? data.exercises : null;
  const workouts = data && 'workouts' in raw ? data.workouts : null;
  const presets = data && 'presets' in raw ? data.presets : null;

  return {
    entries,
    settings: data && 'settings' in raw ? data.settings : null,
    exercises,
    workouts,
    presets,
    groupGoals: data && 'groupGoals' in raw ? data.groupGoals : null,
    checks: data && 'checks' in raw ? data.checks : null,
    suppressed: data && 'suppressed' in raw ? data.suppressed : null,
    count: Object.keys(entries).length,
    exerciseCount: exercises?.length ?? 0,
    sessionCount: workouts ? Object.keys(workouts).length : 0,
    presetCount: presets?.length ?? 0,
  };
}

/** 共有シート用の 1 行サマリ。Web Share API が無い環境ではクリップボードに落とす */
export function buildShareText(
  weight: number | null,
  delta: number | null,
  bodyFat: number | null,
  streak: number,
): string {
  const parts = [`体重 ${fmt(weight)}kg`];
  if (delta != null) parts.push(`開始比 ${delta > 0 ? '+' : '−'}${Math.abs(delta).toFixed(1)}kg`);
  if (bodyFat != null) parts.push(`体脂肪率 ${fmt(bodyFat)}%`);
  if (streak > 0) parts.push(`${streak}日連続記録`);
  return `${parts.join(' / ')} #BodyMake`;
}

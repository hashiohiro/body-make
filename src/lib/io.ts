import type { AppData, DailyPoint, Entries, Exercise, SessionPoint, WeekPoint, Workouts } from '../types';
import { GROUP_LABELS, GROUP_ORDER } from './exerciseCatalog';
import { buildWeeklySets, formatSets } from './training';
import { addDays, todayISO, weekdayJa } from './date';
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

const DAILY_HEADER = [
  '日付',
  '曜日',
  '朝 体重',
  '朝 体脂肪率',
  '夜 体重',
  '夜 体脂肪率',
  '日平均 体重',
  '日平均 体脂肪率',
];

const TRAINING_HEADER = [
  '日付',
  '曜日',
  '種目',
  '部位',
  '補助部位（×係数）',
  'セット',
  '重量',
  '回数',
  '単位',
  '有効重量',
  '挙上量',
];

const WEEKLY_HEADER = [
  '週開始',
  '週終了',
  '週',
  '平均体重',
  '前週差',
  '平均体脂肪率',
  '前週差',
  '体脂肪量',
  '除脂肪体重',
  '記録日数',
];

function cell(value: number | null, digits = 1): string {
  return value == null ? '' : value.toFixed(digits);
}

function toCsv(rows: readonly (readonly string[])[]): string {
  const body = rows
    .map((row) => row.map((v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(','))
    .join('\r\n');
  // BOM を付けないと Excel が UTF-8 と判定せず日本語が化ける
  return `﻿${body}`;
}

/**
 * エクセルの「日次記録」「週次分析」と同じ列構成で出す。
 * 読み戻しはしない一方向の書き出しで、Excel でレポートを作るための出口。
 *
 * 筋トレはセット 1 行ずつの明細で出す。集計済みの数字を並べるより、
 * ピボットテーブルで好きに切れるほうがレポートの材料として使える。
 */
export function exportCsv(
  daily: DailyPoint[],
  weeks: WeekPoint[],
  sessions: readonly SessionPoint[] = [],
): void {
  const rows = buildCsvRows(daily, weeks, sessions);
  download(`bodymake-${todayISO()}.csv`, new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }));
}

/** 行の組み立てだけ分けておく（テストから中身を確かめられるように） */
export function buildCsvRows(
  daily: readonly DailyPoint[],
  weeks: readonly WeekPoint[],
  sessions: readonly SessionPoint[] = [],
): string[][] {
  const weeklySets = sessions.length > 0 ? buildWeeklySets(sessions, sessions[0]!.date) : [];

  const trainingRows = sessions.flatMap((session) =>
    session.exercises.flatMap((point) =>
      point.sets.map((set, i) => [
        session.date,
        weekdayJa(session.date),
        point.name,
        GROUP_LABELS[point.group],
        point.subGroups.map((sub) => `${GROUP_LABELS[sub.group]}×${sub.weight}`).join('・'),
        String(i + 1),
        cell(set.weight),
        set.reps == null ? '' : String(set.reps),
        point.repUnit === 'seconds' ? '秒' : '回',
        cell(set.effectiveWeight),
        cell(set.volume, 0),
      ]),
    ),
  );

  const rows: string[][] = [
    ['# 日次記録'],
    [...DAILY_HEADER],
    ...daily.map((d) => [
      d.date,
      weekdayJa(d.date),
      cell(d.am.weight),
      cell(d.am.bodyFat),
      cell(d.pm.weight),
      cell(d.pm.bodyFat),
      cell(d.weight),
      cell(d.bodyFat),
    ]),
    [],
    ['# 週次分析（週=日曜〜土曜）'],
    [...WEEKLY_HEADER],
    ...weeks.map((w) => [
      w.start,
      w.end,
      w.label,
      cell(w.weight),
      cell(w.weightDelta),
      cell(w.bodyFat),
      cell(w.bodyFatDelta),
      cell(w.fatMass),
      cell(w.leanMass),
      String(w.days),
    ]),
  ];

  if (trainingRows.length > 0) {
    rows.push(
      [],
      ['# 筋トレログ（セット単位）'],
      [...TRAINING_HEADER],
      ...trainingRows,
      [],
      ['# 週次の部位別セット数'],
      ['週開始', '週終了', '実施日数', ...GROUP_ORDER.map((g) => GROUP_LABELS[g]), '合計'],
      ...weeklySets.map((w) => [
        w.start,
        addDays(w.start, 6),
        String(w.days),
        ...GROUP_ORDER.map((g) => formatSets(w.setsByGroup[g])),
        formatSets(w.totalSets),
      ]),
    );
  }

  return rows;
}

/** state へ流し込む中身。null は「このファイルには含まれていない＝現状維持」 */
export interface ImportPayload {
  entries: Entries;
  settings: AppData['settings'] | null;
  exercises: Exercise[] | null;
  workouts: Workouts | null;
}

export interface ImportResult extends ImportPayload {
  /** 取り込んだ日数・種目数・セッション数（確認ダイアログの文言に使う） */
  count: number;
  exerciseCount: number;
  sessionCount: number;
}

/**
 * 復元できるのは JSON だけ。
 * CSV は Excel で開くための一方向の書き出しで、読み戻しには使わない
 * （体組成しか運べないので、CSV で復元できると思われると筋トレと設定が失われる）。
 */
export async function readImportFile(file: File): Promise<ImportResult> {
  const raw = JSON.parse((await file.text()).trim()) as Record<string, unknown>;

  // アプリ全体のバックアップと、entries だけの JSON の両方を受け付ける
  const looksLikeBackup =
    'entries' in raw || 'settings' in raw || 'exercises' in raw || 'workouts' in raw;
  const data = looksLikeBackup ? sanitizeData(raw) : null;
  const entries = data ? data.entries : sanitizeEntries(raw);
  // キーがあるものだけ取り込む。無いファイルでは現状を残す
  const exercises = data && 'exercises' in raw ? data.exercises : null;
  const workouts = data && 'workouts' in raw ? data.workouts : null;

  return {
    entries,
    settings: data && 'settings' in raw ? data.settings : null,
    exercises,
    workouts,
    count: Object.keys(entries).length,
    exerciseCount: exercises?.length ?? 0,
    sessionCount: workouts ? Object.keys(workouts).length : 0,
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

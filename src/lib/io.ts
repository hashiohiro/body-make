import type { AppData, DailyPoint, Entries, WeekPoint } from '../types';
import { todayISO, weekdayJa } from './date';
import { fmt } from './format';
import { parseBodyFat, parseWeight, sanitizeData, sanitizeEntries } from './storage';

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

/** エクセルの「日次記録」「週次分析」と同じ列構成で出す。Excel へ戻す経路を残すため */
export function exportCsv(daily: DailyPoint[], weeks: WeekPoint[]): void {
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
  download(`bodymake-${todayISO()}.csv`, new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }));
}

export interface ImportResult {
  entries: Entries;
  settings: AppData['settings'] | null;
  count: number;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      out.push(field);
      field = '';
    } else field += ch;
  }
  out.push(field);
  return out;
}

/** 自前 CSV（日次記録セクション）を読み戻す。週次セクション以降は導出値なので無視する */
function parseCsv(text: string): Entries {
  const entries: Entries = {};
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim() || line.startsWith('#')) continue;
    const cols = splitCsvLine(line);
    const iso = cols[0]?.trim() ?? '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) continue;
    const day = {
      am: { weight: parseWeight(cols[2]), bodyFat: parseBodyFat(cols[3]) },
      pm: { weight: parseWeight(cols[4]), bodyFat: parseBodyFat(cols[5]) },
    };
    if (day.am.weight == null && day.am.bodyFat == null && day.pm.weight == null && day.pm.bodyFat == null) {
      continue;
    }
    entries[iso] = day;
  }
  return entries;
}

export async function readImportFile(file: File): Promise<ImportResult> {
  const text = await file.text();
  const trimmed = text.trim();

  if (trimmed.startsWith('{')) {
    const raw = JSON.parse(trimmed) as Record<string, unknown>;
    // アプリ全体のバックアップと、entries だけの JSON の両方を受け付ける
    const looksLikeBackup = 'entries' in raw || 'settings' in raw;
    const data = looksLikeBackup ? sanitizeData(raw) : null;
    const entries = data ? data.entries : sanitizeEntries(raw);
    return {
      entries,
      settings: data && looksLikeBackup && 'settings' in raw ? data.settings : null,
      count: Object.keys(entries).length,
    };
  }

  const entries = parseCsv(text);
  return { entries, settings: null, count: Object.keys(entries).length };
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

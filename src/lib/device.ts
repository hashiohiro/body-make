import { addDays, todayISO } from './date';

/**
 * 端末ごとの覚え書き。**記録（AppData）には混ぜない。**
 *
 * 「いつ書き出したか」も「案内を閉じたか」も、その端末のブラウザの都合であって
 * 記録そのものではない。書き出した JSON を別の端末で読んだときに、
 * 向こうの案内まで消える理由がない（`useFabPosition` と同じ理由で別キーに持つ）。
 */
const KEY = 'bodymake.device.v1';

/** 案内を閉じてから、次に出すまでに空ける日数 */
const SNOOZE_DAYS = 30;

export interface DeviceState {
  /** 最後に JSON を書き出した日 'YYYY-MM-DD' */
  exportedAt: string | null;
  /** バックアップの案内を閉じた日 */
  backupClosedAt: string | null;
  /** ホーム画面の案内を閉じた日 */
  installClosedAt: string | null;
}

const EMPTY: DeviceState = { exportedAt: null, backupClosedAt: null, installClosedAt: null };

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

function iso(value: unknown): string | null {
  return typeof value === 'string' && ISO_RE.test(value) ? value : null;
}

export function loadDevice(): DeviceState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    const o = JSON.parse(raw) as Record<string, unknown>;
    return {
      exportedAt: iso(o.exportedAt),
      backupClosedAt: iso(o.backupClosedAt),
      installClosedAt: iso(o.installClosedAt),
    };
  } catch {
    return { ...EMPTY };
  }
}

/**
 * 端末の覚え書きを書き換える。
 *
 * ここが書けない状況（容量超過・プライベートモード）は記録側でも起きているので、
 * 握って進める。案内が出続けるだけで、記録は失われない。
 */
export function patchDevice(patch: Partial<DeviceState>): DeviceState {
  const next = { ...loadDevice(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* 書けなくても案内が出続けるだけ。記録側の失敗は StorageAlert が拾う */
  }
  return next;
}

/** 書き出した事実を残す。促しの起点になるのはこの日付 */
export function markExported(): DeviceState {
  return patchDevice({ exportedAt: todayISO() });
}

/** 閉じてから SNOOZE_DAYS 経つまでは出さない。null（一度も閉じていない）なら出す */
export function snoozeOver(closedAt: string | null): boolean {
  return closedAt == null || todayISO() >= addDays(closedAt, SNOOZE_DAYS);
}

/** ホーム画面に追加された状態で開いているか */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  // iOS Safari は display-mode を持たないので navigator.standalone を見る
  const ios = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios || window.matchMedia?.('(display-mode: standalone)').matches === true;
}

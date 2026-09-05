import { useEffect } from 'react';
import type { ThemePref } from '../types';

/**
 * 最初の描画に間に合わせるための配色の控え。
 *
 * **本体は `Settings.theme`（IndexedDB）で、これはその写し。**
 * 記録の読み出しが非同期になったぶん、React が載るまでの数十ミリ秒だけ
 * 地の色が既定に戻って見える。それを避けるためだけに、同期で読める場所へ 1 つ置く。
 *
 * ずれても実害が無いのが前提の値。ずれた場合は読み込み直後に本体が上書きする。
 */
const THEME_HINT_KEY = 'bodymake.theme.v1';

function applyTheme(pref: ThemePref | null): void {
  const root = document.documentElement;
  if (pref == null || pref === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', pref);

  // ステータスバーの色も追従させる（standalone 表示で地の色がずれると安っぽく見える）。
  // 地の色はトークンから読む。配色ごとの色をこちら側でも持つと、必ずどちらかがずれる
  const plane = getComputedStyle(root).getPropertyValue('--plane').trim();
  if (!plane) return;
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    meta.setAttribute('content', plane);
    meta.removeAttribute('media');
  }
}

/** 記録を読み込む前に、前回の配色を当てておく（main.tsx から呼ぶ） */
export function applyStoredTheme(): void {
  try {
    applyTheme(localStorage.getItem(THEME_HINT_KEY) as ThemePref | null);
  } catch {
    /* 読めない環境では既定の配色で始まる。記録には関わらない */
  }
}

/**
 * 'system' のときは data-theme を外して OS 設定に委ねる。
 * トークン側が :root[data-theme] と prefers-color-scheme の両方を持つので、属性の付け外しだけで足りる。
 */
export function useTheme(pref: ThemePref): void {
  useEffect(() => {
    applyTheme(pref);
    try {
      localStorage.setItem(THEME_HINT_KEY, pref);
    } catch {
      /* 控えが書けないだけ。次の起動で一瞬だけ既定の地の色が見える */
    }
  }, [pref]);
}

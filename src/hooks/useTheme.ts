import { useEffect } from 'react';
import type { ThemePref } from '../types';

/**
 * 'system' のときは data-theme を外して OS 設定に委ねる。
 * トークン側が :root[data-theme] と prefers-color-scheme の両方を持つので、属性の付け外しだけで足りる。
 */
export function useTheme(pref: ThemePref): void {
  useEffect(() => {
    const root = document.documentElement;
    if (pref === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', pref);

    // ステータスバーの色も追従させる（standalone 表示で地の色がずれると安っぽく見える）。
    // 地の色はトークンから読む。配色ごとの色をこちら側でも持つと、必ずどちらかがずれる
    const plane = getComputedStyle(root).getPropertyValue('--plane').trim();
    if (!plane) return;
    for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
      meta.setAttribute('content', plane);
      meta.removeAttribute('media');
    }
  }, [pref]);
}

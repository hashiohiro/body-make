import { useEffect } from 'react';
import type { ThemePref } from '../types';

const THEME_COLOR = { light: '#f9f9f7', dark: '#0d0d0d' } as const;

/**
 * 'system' のときは data-theme を外して OS 設定に委ねる。
 * トークン側が :root[data-theme] と prefers-color-scheme の両方を持つので、属性の付け外しだけで足りる。
 */
export function useTheme(pref: ThemePref): void {
  useEffect(() => {
    const root = document.documentElement;
    if (pref === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', pref);

    // ステータスバーの色も追従させる（standalone 表示で地の色がずれると安っぽく見える）
    const resolved =
      pref === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : pref;
    for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
      meta.setAttribute('content', THEME_COLOR[resolved]);
      meta.removeAttribute('media');
    }
  }, [pref]);
}

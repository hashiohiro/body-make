import type { ThemePref } from '../types';

/**
 * 選べる配色。
 *
 * 'system' / 'light' / 'dark' はこのアプリの地の配色で、それ以外は
 * ReRail（作成者の別アプリ）のプリセットを移したもの。
 * 名前は移植元に揃えて英語で通す（訳すと元がどれか分からなくなる）。
 * 'system' だけは配色の名前ではなく動作の説明なので日本語。
 *
 * 色はここに持たない。トークン（_tokens.scss）が唯一の出どころで、
 * ステータスバーの色も useTheme が --plane から読む。
 */
export interface ThemeOption {
  id: ThemePref;
  label: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  { id: 'system', label: 'システムに合わせる' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'indigo-night', label: 'Indigo Night' },
  { id: 'ocean-blue', label: 'Ocean Blue' },
  { id: 'sakura', label: 'Sakura' },
  { id: 'solarized-light', label: 'Solarized Light' },
];

export const THEME_IDS: ThemePref[] = THEME_OPTIONS.map((t) => t.id);

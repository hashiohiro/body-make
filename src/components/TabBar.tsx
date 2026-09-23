import type { ReactNode } from 'react';
import { useKeyboardOpen } from '../hooks/useKeyboardOpen';
import s from './TabBar.module.scss';
import { useT } from '../lib/i18n';
import type { MessageKey } from '../lib/i18n';

export type TabId = 'home' | 'goals' | 'records' | 'settings';

const ICONS: Record<TabId, ReactNode> = {
  home: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 11.5 12 4l8 7.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 10.5V20h12v-9.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  // 旗。設定の歯車と同じ「丸」の語彙にならないよう、的ではなく旗にする
  goals: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M6 21V4" strokeLinecap="round" />
      <path d="M6 4.8h11l-2.2 3.6L17 12H6z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  records: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M8 9h8M8 13h8M8 17h5" strokeLinecap="round" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="3.2" />
      <path
        d="M12 3.5v2M12 18.5v2M20.5 12h-2M5.5 12h-2M18 6l-1.4 1.4M7.4 16.6 6 18M18 18l-1.4-1.4M7.4 7.4 6 6"
        strokeLinecap="round"
      />
    </svg>
  ),
};

const LABEL_KEYS: Record<TabId, MessageKey> = {
  home: 'nav.homeTab',
  goals: 'nav.goals',
  records: 'nav.records',
  settings: 'common.settings',
};

const ORDER: TabId[] = ['home', 'goals', 'records', 'settings'];

interface Props {
  active: TabId;
  onChange: (tab: TabId) => void;
}

/**
 * 画面下のタブバー。
 *
 * **キーボードが出ているあいだは引っ込める。**iOS はキーボードでレイアウトビューポートを
 * 変えないので、`position: fixed; bottom: 0` のままだとバーがキーボードの上——
 * 見た目には画面の真ん中——に現れる（`useKeyboardOpen`）。
 *
 * 位置を追従させるのではなく消すほうを採った。追従は 1 フレーム遅れてガタつくうえ、
 * **打っている最中に画面を移りたい人はいない。**打ち終えて閉じれば戻ってくる。
 */
export function TabBar({ active, onChange }: Props) {
  const t = useT();
  const typing = useKeyboardOpen();

  return (
    // data-tabbar は高さを測るための目印。＋ボタンをこのバーの上に留めるのに使う
    // （useFabPosition。--tab-h だけだと safe-area のぶんを見落とす）
    <nav
      data-tabbar=""
      className={s.tabs}
      role="tablist"
      aria-label={t('nav.tabs')}
      hidden={typing}
    >
      {ORDER.map((id) => (
        <button
          key={id}
          type="button"
          role="tab"
          className={s.tab}
          aria-selected={active === id}
          aria-controls={`panel-${id}`}
          onClick={() => onChange(id)}
        >
          {ICONS[id]}
          {t(LABEL_KEYS[id])}
        </button>
      ))}
    </nav>
  );
}

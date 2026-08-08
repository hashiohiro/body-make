import type { ReactNode } from 'react';
import s from './TabBar.module.scss';

export type TabId = 'home' | 'charts' | 'records' | 'settings';

const ICONS: Record<TabId, ReactNode> = {
  home: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 11.5 12 4l8 7.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 10.5V20h12v-9.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  charts: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 19h16" strokeLinecap="round" />
      <path d="M5 15l4.5-4.5 3.5 3L19 7" strokeLinecap="round" strokeLinejoin="round" />
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

const LABELS: Record<TabId, string> = {
  home: 'ホーム',
  charts: 'グラフ',
  records: '記録',
  settings: '設定',
};

const ORDER: TabId[] = ['home', 'charts', 'records', 'settings'];

interface Props {
  active: TabId;
  onChange: (tab: TabId) => void;
}

export function TabBar({ active, onChange }: Props) {
  return (
    <nav className={s.tabs} role="tablist" aria-label="画面切り替え">
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
          {LABELS[id]}
        </button>
      ))}
    </nav>
  );
}

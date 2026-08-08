import { useEffect, useState } from 'react';
import { TabBar } from './components/TabBar';
import type { TabId } from './components/TabBar';
import { Toast, useToast } from './components/Toast';
import { useBodyData } from './hooks/useBodyData';
import { useTheme } from './hooks/useTheme';
import { formatMDW, todayISO } from './lib/date';
import { ChartsView } from './views/ChartsView';
import { HomeView } from './views/HomeView';
import { RecordsView } from './views/RecordsView';
import { SettingsView } from './views/SettingsView';
import s from './App.module.scss';

const TITLES: Record<TabId, string> = {
  home: 'BodyMake',
  charts: 'グラフ',
  records: '記録',
  settings: '設定',
};

function tabFromHash(): TabId {
  const id = window.location.hash.replace('#', '');
  return id in TITLES ? (id as TabId) : 'home';
}

export function App() {
  const body = useBodyData();
  const [tab, setTab] = useState<TabId>(tabFromHash);
  const [date, setDate] = useState(todayISO);
  const toast = useToast();

  useTheme(body.data.settings.theme);

  // タブを URL に載せる。standalone 表示の戻る操作とリロードで位置が保たれる
  useEffect(() => {
    if (tabFromHash() !== tab) window.location.hash = tab;
    window.scrollTo({ top: 0 });
  }, [tab]);

  useEffect(() => {
    const onHashChange = () => setTab(tabFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return (
    <div className={s.app}>
      <header className={s.topbar}>
        <h1 className={s.title}>{TITLES[tab]}</h1>
        <span className={s.today}>{formatMDW(todayISO())}</span>
      </header>

      <main id={`panel-${tab}`} role="tabpanel">
        {tab === 'home' && (
          <HomeView body={body} date={date} onDateChange={setDate} onOpenSettings={() => setTab('settings')} />
        )}
        {tab === 'charts' && <ChartsView body={body} />}
        {tab === 'records' && <RecordsView body={body} date={date} onDateChange={setDate} />}
        {tab === 'settings' && <SettingsView body={body} onToast={toast.show} />}
      </main>

      <TabBar active={tab} onChange={setTab} />
      <Toast message={toast.message} />
    </div>
  );
}

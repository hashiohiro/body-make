import { useEffect, useRef, useState } from 'react';
import { TabBar } from './components/TabBar';
import type { TabId } from './components/TabBar';
import { Toast, useToast } from './components/Toast';
import { useBodyData } from './hooks/useBodyData';
import { useTheme } from './hooks/useTheme';
import { formatMDW, todayISO } from './lib/date';
import { ChartsView } from './views/ChartsView';
import { HomeView } from './views/HomeView';
import { RecordsView } from './views/RecordsView';
import { SettingsView, settingsSectionTitle } from './views/SettingsView';
import s from './App.module.scss';

const TITLES: Record<TabId, string> = {
  home: 'BodyMake',
  charts: 'グラフ',
  records: '記録',
  settings: '設定',
};

interface Route {
  tab: TabId;
  /** 設定の下位画面。`#settings/data` のように URL の一部として持つ */
  section: string | null;
}

function routeFromHash(): Route {
  const [tab, section] = window.location.hash.replace(/^#/, '').split('/');
  return {
    tab: tab && tab in TITLES ? (tab as TabId) : 'home',
    section: section || null,
  };
}

function toHash(route: Route): string {
  return `#${route.section ? `${route.tab}/${route.section}` : route.tab}`;
}

function routeTitle(route: Route): string {
  return (route.section ? settingsSectionTitle(route.section) : null) ?? TITLES[route.tab];
}

export function App() {
  const body = useBodyData();
  const [route, setRoute] = useState<Route>(routeFromHash);
  const [date, setDate] = useState(todayISO);
  const toast = useToast();

  useTheme(body.data.settings.theme);

  // このセッションで積んだ履歴の数と、戻り先の表示名
  const pushes = useRef(0);
  const backLabel = useRef(TITLES.home);

  /** 位置を URL に載せる。standalone 表示の戻る操作とリロードで位置が保たれる */
  const go = (next: Route, replace = false) => {
    const hash = toHash(next);
    if (replace) {
      window.history.replaceState(null, '', hash);
    } else {
      backLabel.current = routeTitle(route);
      pushes.current++;
      if (window.location.hash !== hash) window.location.hash = hash;
    }
    setRoute(next);
    window.scrollTo({ top: 0 });
  };

  /**
   * 戻るは「1 階層上」ではなく「遷移元」へ返す。
   * ホームから設定の下位画面へ直接飛べるので、常に設定の一覧へ戻すと来た道と違ってしまう。
   * 直接 URL を開いた場合だけ、履歴を遡らずに一覧へ寄せる。
   */
  const back = () => {
    if (pushes.current > 0) {
      pushes.current--;
      window.history.back();
    } else {
      go({ tab: route.tab, section: null }, true);
    }
  };

  useEffect(() => {
    if (window.location.hash !== toHash(route)) window.location.hash = toHash(route);
  }, []); // 初回だけ URL を実状態にそろえる

  useEffect(() => {
    const onHashChange = () => setRoute(routeFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const sectionTitle = route.section ? settingsSectionTitle(route.section) : null;

  return (
    <div className={s.app}>
      <header className={s.topbar}>
        {sectionTitle ? (
          <>
            <button type="button" className={s.back} onClick={back} aria-label="戻る">
              ‹ {backLabel.current}
            </button>
            <h1 className={s.title}>{sectionTitle}</h1>
          </>
        ) : (
          <>
            <h1 className={s.title}>{TITLES[route.tab]}</h1>
            <span className={s.today}>{formatMDW(todayISO())}</span>
          </>
        )}
      </header>

      <main id={`panel-${route.tab}`} role="tabpanel">
        {route.tab === 'home' && (
          <HomeView
            body={body}
            onOpenSettings={() => go({ tab: 'settings', section: 'body' })}
            onOpenRecords={() => go({ tab: 'records', section: null })}
            onOpenGoals={() => go({ tab: 'settings', section: 'training' })}
          />
        )}
        {route.tab === 'charts' && <ChartsView body={body} />}
        {route.tab === 'records' && <RecordsView body={body} date={date} onDateChange={setDate} />}
        {route.tab === 'settings' && (
          <SettingsView
            body={body}
            section={route.section}
            onOpen={(section) => go({ tab: 'settings', section })}
            onToast={toast.show}
          />
        )}
      </main>

      <TabBar active={route.tab} onChange={(tab) => go({ tab, section: null })} />
      <Toast message={toast.message} />
    </div>
  );
}

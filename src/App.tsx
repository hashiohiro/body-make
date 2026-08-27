import { useEffect, useRef, useState } from 'react';
import { DateNav } from './components/DateNav';
import { TabBar } from './components/TabBar';
import type { TabId } from './components/TabBar';
import type { Domain } from './types';
import { Toast, useToast } from './components/Toast';
import { useBodyData } from './hooks/useBodyData';
import { useTheme } from './hooks/useTheme';
import { formatMDW, todayISO } from './lib/date';
import { ChartsView } from './views/ChartsView';
import { GoalsView } from './views/GoalsView';
import { HomeView } from './views/HomeView';
import { RecordsView } from './views/RecordsView';
import { SETTINGS_SECTIONS, SettingsView, settingsTitle } from './views/SettingsView';
import ui from './styles/ui.module.scss';
import s from './App.module.scss';

const TITLES: Record<TabId, string> = {
  home: 'BodyMake',
  goals: '目標',
  records: '記録',
  settings: '設定',
};

/**
 * 下位画面の登録表。
 *
 * 設定だけが持っていた仕組みを、タブ横断のものにした。
 * 推移はタブではなく、ホームで見ている数字の続き（`#home/trend`）として置く。
 */
const SECTIONS: Partial<Record<TabId, Record<string, string>>> = {
  home: { trend: '推移' },
  settings: Object.fromEntries(SETTINGS_SECTIONS.map((sec) => [sec.id, sec.label])),
};

function sectionTitle(tab: TabId, section: string | null): string | null {
  return section == null ? null : (SECTIONS[tab]?.[section] ?? null);
}

interface Route {
  tab: TabId;
  /** 下位画面。`#home/trend` のように URL の一部として持つ */
  section: string | null;
  /** 下位画面への引き数（種目 ID）。`#home/trend/ex_bench` */
  param: string | null;
}

function routeFromHash(): Route {
  const [rawTab, rawSection, rawParam] = window.location.hash.replace(/^#/, '').split('/');

  // グラフタブは目標タブに置き換わった。古いブックマークと PWA の復帰位置を推移へ寄せる
  if (rawTab === 'charts') return { tab: 'home', section: 'trend', param: null };

  const tab = rawTab && rawTab in TITLES ? (rawTab as TabId) : 'home';
  const section = rawSection && sectionTitle(tab, rawSection) ? rawSection : null;
  return { tab, section, param: section ? rawParam || null : null };
}

function toHash(route: Route): string {
  if (!route.section) return `#${route.tab}`;
  return `#${route.tab}/${route.section}${route.param ? `/${route.param}` : ''}`;
}

export function App() {
  const body = useBodyData();
  const [route, setRoute] = useState<Route>(routeFromHash);
  const [date, setDate] = useState(todayISO);
  // ホーム・記録・目標・推移で共通。タブを移っても保つ
  const [domain, setDomain] = useState<Domain>('body');
  /*
   * マイ種目（設定）から名指しで開く種目の目標。
   *
   * 目標を決める場所は目標タブの 1 か所のままで、連れて行くだけ。
   * URL には載せない。これは「いま押したから開く」ための一度きりの指名で、
   * 位置（どの画面を見ているか）ではない。開いたら捨てる
   */
  const [goalFocus, setGoalFocus] = useState<string | null>(null);

  /*
   * 切り替えると画面の中身が丸ごと入れ替わる。
   * 前の内容に合わせたスクロール位置に留まると、脈絡のない途中に落ちる。
   * タブ遷移（go）と同じ扱いにする。
   */
  const changeDomain = (next: Domain) => {
    setDomain(next);
    window.scrollTo({ top: 0 });
  };
  const toast = useToast();

  useTheme(body.data.settings.theme);

  // 推移は体組成とトレーニングで中身が入れ替わるので、見出しも切り替えの側に従う
  const trendTitle = domain === 'body' ? '体組成の推移' : 'トレーニングの推移';
  const title =
    route.tab === 'home' && route.section === 'trend'
      ? trendTitle
      : // 設定はセクションの中にもう 1 段ある（`#settings/training/presets`）
        route.tab === 'settings'
        ? settingsTitle(route.section, route.param)
        : sectionTitle(route.tab, route.section);

  // このセッションで積んだ履歴の数と、戻り先の表示名
  const pushes = useRef(0);
  const backLabel = useRef(TITLES.home);

  /** 位置を URL に載せる。standalone 表示の戻る操作とリロードで位置が保たれる */
  const go = (next: Route, replace = false) => {
    const hash = toHash(next);
    if (replace) {
      window.history.replaceState(null, '', hash);
    } else {
      backLabel.current = title ?? TITLES[route.tab];
      pushes.current++;
      if (window.location.hash !== hash) window.location.hash = hash;
    }
    setRoute(next);
    window.scrollTo({ top: 0 });
  };

  const open = (tab: TabId, section: string | null = null, param: string | null = null) =>
    go({ tab, section, param });

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
      go({ tab: route.tab, section: null, param: null }, true);
    }
  };

  useEffect(() => {
    // 初回だけ URL を実状態にそろえる。履歴は積まない（戻るで #charts に戻らないように）
    if (window.location.hash !== toHash(route)) {
      window.history.replaceState(null, '', toHash(route));
    }
  }, []);

  useEffect(() => {
    const onHashChange = () => setRoute(routeFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return (
    <div className={s.app}>
      <header className={s.topbar}>
        <div className={s.topbarRow}>
          {title ? (
            <>
              <button type="button" className={s.back} onClick={back} aria-label="戻る">
                ‹ {backLabel.current}
              </button>
              <h1 className={s.title}>{title}</h1>
            </>
          ) : (
            <>
              <h1 className={s.title}>{TITLES[route.tab]}</h1>
              {/* 記録タブでは日付そのものが操作対象なので、日付ナビをヘッダに出す */}
              {route.tab === 'records' ? (
                <DateNav date={date} onChange={setDate} />
              ) : (
                <span className={s.today}>{formatMDW(todayISO())}</span>
              )}
            </>
          )}
        </div>

        {/*
          体組成とトレーニングの切り替えはヘッダに置く。
          画面の中に置くと、タブを移って戻るたびに体組成へ戻ってしまい、
          トレーニングを見続けたい人が毎回押し直すことになる
        */}
        {route.tab !== 'settings' && (
          <div className={ui.segmented} role="group" aria-label="表示する記録">
            {(
              [
                ['body', '体組成'],
                ['training', 'トレーニング'],
              ] as [Domain, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={ui.segment}
                aria-pressed={domain === id}
                onClick={() => changeDomain(id)}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </header>

      <main id={`panel-${route.tab}`} role="tabpanel">
        {route.tab === 'home' && route.section === 'trend' && (
          <ChartsView body={body} domain={domain} exerciseId={route.param} />
        )}
        {route.tab === 'home' && route.section == null && (
          <HomeView
            body={body}
            domain={domain}
            onOpenRecords={() => open('records')}
            onOpenTrend={() => open('home', 'trend')}
          />
        )}

        {route.tab === 'goals' && (
          <GoalsView
            body={body}
            domain={domain}
            onOpenTrend={(exerciseId) => open('home', 'trend', exerciseId)}
            focusExerciseId={goalFocus}
            onFocusDone={() => setGoalFocus(null)}
          />
        )}

        {route.tab === 'records' && (
          <RecordsView body={body} date={date} onDateChange={setDate} domain={domain} />
        )}

        {route.tab === 'settings' && (
          <SettingsView
            body={body}
            section={route.section}
            page={route.param}
            onOpen={(section, page) => open('settings', section, page ?? null)}
            onOpenGoal={(exerciseId) => {
              // 種目の目標はトレーニング側の話。切り替えごと連れて行く
              changeDomain('training');
              setGoalFocus(exerciseId);
              open('goals');
            }}
            onToast={toast.show}
          />
        )}
      </main>

      <TabBar active={route.tab} onChange={(tab) => open(tab)} />
      <Toast message={toast.message} />
    </div>
  );
}

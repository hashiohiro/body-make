// @vitest-environment jsdom
import { useState } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExerciseManager } from '../components/training/ExerciseManager';
import { PresetManager } from '../components/training/PresetManager';
import { App } from '../App';
import { BadgeGrid } from '../components/BadgeGrid';
import { DateNav } from '../components/DateNav';
import { ChartsView } from './ChartsView';
import { GoalsView } from './GoalsView';
import { RecordsView } from './RecordsView';
import {
  SETTINGS_SECTIONS,
  SettingsView,
  TRAINING_PAGES,
  settingsSectionTitle,
  settingsTitle,
} from './SettingsView';
import { HomeView } from './HomeView';
import { TrainingView } from './TrainingView';
import { useBodyData } from '../hooks/useBodyData';
import { useTheme } from '../hooks/useTheme';
import { todayISO } from '../lib/date';
import { CATALOG, fromCatalog } from '../lib/exerciseCatalog';
import type { Domain, ThemePref } from '../types';

/**
 * 導出の正しさは training.test.ts が見ている。ここで見るのは結線
 * （種目を足す → セットを打つ → 集計が出る → 消える）が繋がっているか。
 */
function Harness() {
  const body = useBodyData();
  const [date] = useState(todayISO);
  return <TrainingView body={body} date={date} />;
}

/** 種目マスタは設定タブにあるので、画面を触らず localStorage に用意する */
function seedExercises(...ids: string[]) {
  seedData(ids, {});
}

function seedData(
  ids: string[],
  workouts: Record<string, unknown>,
  entries: Record<string, unknown> = {},
  checks: Record<string, unknown> | null = null,
) {
  const exercises = ids.map((id, i) =>
    fromCatalog(
      CATALOG.find((c) => c.id === id)!,
      i,
    ),
  );
  localStorage.setItem(
    'bodymake.data.v1',
    JSON.stringify({
      version: 2,
      settings: {},
      entries,
      exercises,
      workouts,
      ...(checks ? { checks } : {}),
    }),
  );
}

/** i 番目のセット行の重量・回数を入れる */
function typeSet(row: HTMLElement, weight: string, reps: string) {
  fireEvent.change(within(row).getByLabelText(/重量$/), { target: { value: weight } });
  fireEvent.change(within(row).getByLabelText(/回数$/), { target: { value: reps } });
}

/** モーダルが開いているか。中身は閉じていても DOM に残る */
function pickerOpen(): boolean {
  return document.querySelector('dialog')?.hasAttribute('open') ?? false;
}

const dialogOpen = pickerOpen;

/** テスト内で日付をずらす。lib/date の addDays と同じ（同期で使いたいのでここに置く） */
function isoAdd(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 記録画面の右下の ＋ から種目ピッカーを開く */
function openPicker() {
  fireEvent.click(screen.getByRole('button', { name: '種目を追加' }));
}

function setRows(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('[data-set-row]')];
}

beforeEach(() => {
  localStorage.clear();
  // seed（作者の実測体重）が入ると体重側の初期状態が変わるので、投入済みにしておく
  localStorage.setItem('bodymake.seeded.v1', '1');
});

afterEach(cleanup);

describe('トレ画面', () => {
  it('種目が 1 つも無くても、その場でカタログから追加できる', () => {
    render(<Harness />);
    openPicker();

    // 「設定から追加してください」だけを出す行き止まりにしない
    expect(screen.getByText(/マイ種目がまだ空です/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '＋ マイ種目に追加' }));
    fireEvent.click(screen.getByText('＋ ベンチプレス（バーベル）'));
    // 追加済みになったので、カタログの一覧からは消える
    expect(screen.queryByText('＋ ベンチプレス（バーベル）')).toBeNull();
  });

  it('日付ナビはカードではなくヘッダが持つ', () => {
    seedExercises('ex_bench');
    render(<Harness />);
    expect(screen.queryByLabelText('記録する日付')).toBeNull();
  });

  it('カタログから追加 → 記録 → 集計 が繋がる', () => {
    seedExercises('ex_bench');
    render(<Harness />);

    openPicker();
    fireEvent.click(screen.getByText(/^＋ ベンチプレス/));

    // 1 セット目が用意されている
    let rows = setRows();
    expect(rows).toHaveLength(1);

    typeSet(rows[0]!, '60', '10');
    fireEvent.click(screen.getByText('＋ セットを追加'));

    // 直前のセットが複製されるので、入力は差分だけで済む
    rows = setRows();
    expect(rows).toHaveLength(2);
    expect((within(rows[1]!).getByLabelText(/重量$/) as HTMLInputElement).value).toBe('60');

    typeSet(rows[1]!, '60', '9');

    // 60×10 + 60×9 = 1,140 kg（種目カードの小計）
    expect(screen.getAllByText(/1,140 kg/).length).toBeGreaterThan(0);
    // 推定1RM は種目カードにだけ出す。ベンチは分母 40 なので 60 × (1 + 10/40) = 75.0
    expect(screen.getByText(/推定1RM 75\.0 kg/)).toBeTruthy();
    // 換算元のセットを併記する（外挿の大きさが読めるように）
    expect(screen.getByText(/60×10 から/)).toBeTruthy();
  });

  it('書いたセットはすべて挙上量に数える（ウォームアップの区別を持たない）', () => {
    seedExercises('ex_squat');
    render(<Harness />);
    openPicker();
    fireEvent.click(screen.getByText('＋ スクワット'));

    typeSet(setRows()[0]!, '60', '5');
    fireEvent.click(screen.getByText('＋ セットを追加'));
    typeSet(setRows()[1]!, '100', '5');

    // 60×5 + 100×5 = 800 kg。軽い側を勝手に外したりしない
    expect(screen.getAllByText(/800 kg/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/ウォームアップ/)).toBeNull();
  });

  it('セットを全部消しても、その種目はその日に残る（外すのはカードの ×）', () => {
    seedExercises('ex_bench');
    render(<Harness />);
    openPicker();
    fireEvent.click(screen.getByText(/^＋ ベンチプレス/));

    typeSet(setRows()[0]!, '60', '10');
    fireEvent.click(screen.getByLabelText('1セット目を削除'));

    // 行は消えるが、種目そのものは頼まれていないので消さない
    expect(screen.queryByLabelText(/1セット目の重量/)).toBeNull();
    expect(document.querySelectorAll('[id^="ex-card-"]')).toHaveLength(1);

    // そのまま打ち直せる
    fireEvent.click(screen.getByText('＋ セットを追加'));
    expect(setRows().length).toBe(1);
  });

  it('総重量の下に通算の最高重量・最高挙上量と、そこまでの残りを出す', async () => {
    const { addDays, todayISO } = await import('../lib/date');
    const today = todayISO();
    // 過去最高（600）と前回（500）を別の日にして、前回ではなく通算の最高を見ていることを確かめる
    seedData(['ex_bench'], {
      [addDays(today, -2)]: [{ exerciseId: 'ex_bench', sets: [{ weight: 60, reps: 10 }] }],
      [addDays(today, -1)]: [{ exerciseId: 'ex_bench', sets: [{ weight: 50, reps: 10 }] }],
    });
    render(<Harness />);
    openPicker();
    fireEvent.click(screen.getByText(/^＋ ベンチプレス/));

    // 最高重量は換算後ではなく、バーに載せた数字
    expect(screen.getByText('最高重量 60.0 kg')).toBeTruthy();
    // まだ 1kg も積んでいない時点でも、目安として残り全量を出す
    expect(screen.getByText('最高挙上量 600 kg（あと 600 kg）')).toBeTruthy();

    typeSet(setRows()[0]!, '60', '7');
    expect(screen.getByText('最高挙上量 600 kg（あと 180 kg）')).toBeTruthy();

    // 届いたら残りは出さない。当日を最高値に含めると、入れた瞬間に必ず 0 になる
    typeSet(setRows()[0]!, '60', '10');
    expect(screen.getByText('最高挙上量 600 kg')).toBeTruthy();
    expect(screen.queryByText(/あと /)).toBeNull();
  });

  it('✓ をもう一度押すとその日から外れる', () => {
    seedExercises('ex_bench');
    render(<Harness />);
    openPicker();
    fireEvent.click(screen.getByText(/^＋ ベンチプレス/));
    expect(document.querySelectorAll('[id^="ex-card-"]')).toHaveLength(1);

    // 入れ間違いをその場で取り消せる。閉じてカードの × を探させない
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByText(/✓ ベンチプレス/));
    expect(document.querySelectorAll('[id^="ex-card-"]')).toHaveLength(0);
    // 何も入力していなければ失うものが無いので確認しない
    expect(confirmSpy).not.toHaveBeenCalled();
    // 続けて選べるよう開いたまま
    expect(pickerOpen()).toBe(true);

    // 入力済みなら消えるものがあるので確認する
    fireEvent.click(screen.getByText(/^＋ ベンチプレス/));
    typeSet(setRows()[0]!, '60', '10');
    fireEvent.click(screen.getByText(/✓ ベンチプレス/));
    expect(confirmSpy).toHaveBeenCalledOnce();
    expect(document.querySelectorAll('[id^="ex-card-"]')).toHaveLength(0);

    confirmSpy.mockRestore();
  });

  it('外すのを取り消したらその日に残る', () => {
    seedExercises('ex_bench');
    render(<Harness />);
    openPicker();
    fireEvent.click(screen.getByText(/^＋ ベンチプレス/));
    typeSet(setRows()[0]!, '60', '10');

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(screen.getByText(/✓ ベンチプレス/));
    expect(document.querySelectorAll('[id^="ex-card-"]')).toHaveLength(1);
    confirmSpy.mockRestore();
  });

  it('種目は続けて複数選べる', () => {
    seedExercises('ex_bench', 'ex_squat', 'ex_curl');
    render(<Harness />);
    openPicker();

    // 1 つ選ぶたびに閉じると、種目数ぶん開き直すことになる
    fireEvent.click(screen.getByText(/^＋ ベンチプレス/));
    fireEvent.click(screen.getByText(/^＋ スクワット/));
    fireEvent.click(screen.getByText(/^＋ カール/));

    expect(document.querySelectorAll('[id^="ex-card-"]')).toHaveLength(3);
    // 追加してもカードに押し出されないよう、モーダルのまま開いている
    expect(pickerOpen()).toBe(true);
  });

  it('セットを 1 つ消しても、まだ打っていない行は残る', () => {
    seedExercises('ex_bench');
    render(<Harness />);
    openPicker();
    fireEvent.click(screen.getByText(/^＋ ベンチプレス/));
    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));

    fireEvent.click(screen.getByText('＋ セットを追加'));
    expect(setRows().length).toBe(2);

    // 空欄は「まだ打っていない」であって「消してよい」ではない
    fireEvent.click(screen.getByLabelText('2セット目を削除'));
    expect(setRows().length).toBe(1);
    expect(document.querySelectorAll('[id^="ex-card-"]')).toHaveLength(1);
  });

  it('セットを消しても、まだ打っていない他の種目を巻き添えにしない', () => {
    seedExercises('ex_bench', 'ex_squat', 'ex_curl');
    render(<Harness />);
    openPicker();
    fireEvent.click(screen.getByText(/^＋ ベンチプレス/));
    fireEvent.click(screen.getByText(/^＋ スクワット/));
    fireEvent.click(screen.getByText(/^＋ カール/));
    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));
    expect(document.querySelectorAll('[id^="ex-card-"]')).toHaveLength(3);

    // ベンチの最後の 1 行を消す。消えるのはその行だけで、カードは 3 枚とも残る
    const bench = within(document.getElementById('ex-card-ex_bench')!);
    fireEvent.click(bench.getByLabelText('1セット目を削除'));

    expect(document.getElementById('ex-card-ex_bench')).toBeTruthy();
    expect(bench.queryByLabelText(/1セット目の回数/)).toBeNull();
    expect(document.querySelectorAll('[id^="ex-card-"]')).toHaveLength(3);
  });

  it('その日の種目の並びを、掴んで置き場所をタップで変えられる', () => {
    seedExercises('ex_bench', 'ex_pullup', 'ex_squat');
    render(<Harness />);
    openPicker();
    fireEvent.click(screen.getByText(/^＋ ベンチプレス/));
    fireEvent.click(screen.getByText(/^＋ 懸垂/));
    fireEvent.click(screen.getByText(/^＋ スクワット/));
    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));

    const cardIds = () => [...document.querySelectorAll('[id^="ex-card-"]')].map((el) => el.id);
    const reps = (id: string) =>
      (within(document.getElementById(id)!).getByLabelText(/1セット目の回数/) as HTMLInputElement)
        .value;

    fireEvent.change(
      within(document.getElementById('ex-card-ex_squat')!).getByLabelText(/1セット目の回数/),
      { target: { value: '10' } },
    );
    expect(cardIds()).toEqual(['ex-card-ex_bench', 'ex-card-ex_pullup', 'ex-card-ex_squat']);

    // カードは縦に長いので、掴んでいる間はその日の種目だけの一覧に畳む
    fireEvent.click(screen.getByRole('button', { name: 'スクワットの順番を変える' }));
    expect(cardIds()).toEqual([]);
    expect(screen.getByText('スクワット を移動中')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'スクワットを先頭へ' }));

    // 動くのは並びだけ。打った値はそのまま
    expect(cardIds()).toEqual(['ex-card-ex_squat', 'ex-card-ex_bench', 'ex-card-ex_pullup']);
    expect(reps('ex-card-ex_squat')).toBe('10');
  });

  it('種目が 1 つだけの日には、並べ替えを出さない', () => {
    seedExercises('ex_bench');
    render(<Harness />);
    openPicker();
    fireEvent.click(screen.getByText(/^＋ ベンチプレス/));
    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));

    // 動かしようのない操作を出さない
    expect(screen.queryByRole('button', { name: /の順番を変える$/ })).toBeNull();
  });

  it('記録している最中でも、右下の＋から種目を追加できる', () => {
    seedExercises('ex_bench');
    render(<Harness />);

    // カードの追加ボタンは画面の外へ出ていくので、固定の入口を別に持つ
    fireEvent.click(screen.getByRole('button', { name: '種目を追加' }));
    expect(pickerOpen()).toBe(true);
    expect(screen.getByText('＋ ベンチプレス（バーベル）')).toBeTruthy();
  });

  it('種目を追加のボタンの隣に、この日の種目数を出さない', () => {
    seedExercises('ex_bench');
    render(<Harness />);
    openPicker();
    fireEvent.click(screen.getByText('＋ ベンチプレス（バーベル）'));
    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));

    // 入っている種目はカードとして並んでいる。数だけを添えても読むものが増えるだけ
    expect(screen.queryByText(/この日 \d+種目/)).toBeNull();
  });

  it('記録しながら、その種目の目標を決め直せる', () => {
    seedExercises('ex_bench');
    render(<Harness />);
    openPicker();
    fireEvent.click(screen.getByText(/^＋ ベンチプレス/));
    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));

    // 推移と同じ並びに置く。打っている最中に「どこを目指すか」を決め直したくなる
    fireEvent.click(screen.getByRole('button', { name: /ベンチプレス.*の目標を決める/ }));
    fireEvent.click(screen.getByRole('button', { name: '維持' }));
    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));

    // 決めた立て方は、そのままカードのバッジに出る
    expect(screen.getByText('維持')).toBeTruthy();
    const stored = JSON.parse(localStorage.getItem('bodymake.data.v1')!);
    expect(stored.exercises[0].goal).toEqual({ type: 'maintain', value: null });
  });

  it('自重種目では重量を聞かない。加重した日だけ開く', () => {
    seedExercises('ex_pushup');
    render(<Harness />);
    openPicker();
    fireEvent.click(screen.getByText(/^＋ 腕立て伏せ/));
    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));

    // 体重が負荷なので、既定では回数だけ
    expect(screen.getByLabelText('1セット目の回数')).toBeTruthy();
    expect(screen.queryByLabelText('1セット目の重量')).toBeNull();

    // ベルトで足す人のために、その種目のカードから開ける
    fireEvent.click(screen.getByRole('button', { name: '＋ 加重' }));
    expect(screen.getByLabelText('1セット目の重量')).toBeTruthy();
  });

  it('秒で数える種目では重量を聞かない（挙上量に計上されないため）', () => {
    seedExercises('ex_plank');
    render(<Harness />);
    openPicker();
    fireEvent.click(screen.getByText(/^＋ プランク/));
    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));

    expect(screen.getByLabelText('1セット目の秒数')).toBeTruthy();
    expect(screen.queryByLabelText('1セット目の重量')).toBeNull();
    // 入れても効かないので、開く手段も出さない
    expect(screen.queryByRole('button', { name: /加重/ })).toBeNull();
  });

  it('器具を使わない種目でも重量を聞かない（クランチ・デッドバグなど）', () => {
    // 体重を挙上量に足さない種目（loadMode は standard）でも、器具は要らない
    seedExercises('ex_crunch');
    render(<Harness />);
    openPicker();
    fireEvent.click(screen.getByText(/^＋ クランチ/));
    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));

    expect(screen.getByLabelText('1セット目の回数')).toBeTruthy();
    expect(screen.queryByLabelText('1セット目の重量')).toBeNull();

    // プレートを持って行う人はいるので、開く手段は残す
    fireEvent.click(screen.getByRole('button', { name: '＋ 加重' }));
    expect(screen.getByLabelText('1セット目の重量')).toBeTruthy();
  });

  it('加重の記録がある日は、重量欄を畳まない', () => {
    const today = todayISO();
    seedData(['ex_dips'], {
      [today]: [{ exerciseId: 'ex_dips', sets: [{ weight: 20, reps: 5 }] }],
    });
    render(<Harness />);

    expect((screen.getByLabelText('1セット目の重量') as HTMLInputElement).value).toBe('20');
    expect(screen.queryByRole('button', { name: /加重/ })).toBeNull();
  });

  it('± ボタンを置かない（1 行の幅を数値に回すため）', () => {
    seedExercises('ex_bench');
    render(<Harness />);
    openPicker();
    fireEvent.click(screen.getByText(/^＋ ベンチプレス/));

    expect(screen.queryByLabelText(/を増やす$/)).toBeNull();
    expect(screen.queryByLabelText(/を減らす$/)).toBeNull();
  });

  it('W ボタンを置かない（記録するかどうかは書くかどうかで決まる）', () => {
    seedExercises('ex_bench');
    render(<Harness />);
    openPicker();
    fireEvent.click(screen.getByText(/^＋ ベンチプレス/));

    expect(screen.queryByTitle(/ウォームアップ/)).toBeNull();
    expect(screen.queryByText('W')).toBeNull();
  });
});

describe('記録として数える範囲', () => {
  it('値の無いエントリは記録に数えない（打つ前から実績にしない）', async () => {
    const { buildSessions } = await import('../lib/training');
    const bench = fromCatalog(
      CATALOG.find((c) => c.id === 'ex_bench')!,
      0,
    );

    // 種目を選ぶと空のセットが 1 行できる。これを数えると打つ前から通算回数が増える
    expect(
      buildSessions(
        { '2026-03-01': [{ exerciseId: 'ex_bench', sets: [{ weight: null, reps: null }] }] },
        [bench],
        [],
      ),
    ).toEqual([]);

    // 片方でも入っていれば記録（自重種目は回数だけのことがある）
    expect(
      buildSessions(
        { '2026-03-01': [{ exerciseId: 'ex_bench', sets: [{ weight: null, reps: 8 }] }] },
        [bench],
        [],
      ),
    ).toHaveLength(1);
  });
});

describe('種目管理（設定タブ）', () => {
  function ManagerHarness({ usage = new Map<string, number>() }: { usage?: Map<string, number> }) {
    const body = useBodyData();
    return (
      <ExerciseManager
        exercises={body.data.exercises}
        sessions={body.sessions}
        usage={usage}
        onAdd={body.addExercises}
        onUpdate={body.upsertExercise}
        onRemove={body.removeExercise}
      />
    );
  }

  it('初期状態は空で、追加したぶんだけ増える', () => {
    render(<ManagerHarness />);
    expect(screen.getByText(/^0件 \/ 目標/)).toBeTruthy();
    expect(screen.getByText(/マイ種目はまだ空です/)).toBeTruthy();

    fireEvent.click(screen.getByText('＋ マイ種目に追加'));
    // 器具を選べる種目は、バーベル版とダンベル版が別の行として並ぶ
    fireEvent.click(screen.getByText('＋ ベンチプレス（バーベル）'));
    expect(screen.getByText(/^1件 \/ 目標/)).toBeTruthy();
    fireEvent.click(screen.getByText('＋ ベンチプレス（ダンベル）'));
    expect(screen.getByText(/^2件 \/ 目標/)).toBeTruthy();
  });

  it('1 種目ぶんの形は、目標画面の種目カードと同じ（事実 → 入口の順）', () => {
    seedExercises('ex_bench');
    render(<ManagerHarness usage={new Map([['ex_bench', 12]])} />);

    // 出す事実はこの画面のもの（記録の量と数え方）。形は目標画面のカードと同じ
    expect(screen.getByText('記録 12日')).toBeTruthy();
    expect(screen.getByText(/挙上ウエイト ・ 回で数える/)).toBeTruthy();

    // 目標の値は必ず「目標」と書いてから出す（数字だけだと何の数字か読めない）
    expect(screen.queryByText('100kg')).toBeNull();

    // 入口は下にまとめる（目標画面の「推移を見る／変更」と同じ位置）
    expect(screen.getByRole('button', { name: /ベンチプレス.*の目標を決める/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /ベンチプレス.*の設定/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /ベンチプレス.*を削除/ })).toBeTruthy();
  });

  it('目標の値は「目標」と書いてから出す', async () => {
    const { fromCatalog: from } = await import('../lib/exerciseCatalog');
    const bench = from(
      CATALOG.find((c) => c.id === 'ex_bench')!,
      0,
    );
    bench.goal = { type: 'weight', value: 100 };
    localStorage.setItem(
      'bodymake.data.v1',
      JSON.stringify({ version: 2, settings: {}, entries: {}, exercises: [bench], workouts: {} }),
    );
    render(<ManagerHarness />);

    // 目標画面は「大きい数字＝いま」なので、数字だけ置くと何の数字か読めなくなる。
    // 立て方（重量↑ / 挙上量↑ / 維持）は別のバッジ。目標タブの種目カードと同じ出し方
    expect(screen.getByText('重量↑')).toBeTruthy();
    expect(screen.getByText('目標 100kg')).toBeTruthy();
  });

  it('現状維持は数値を持たず、立て方だけをバッジに出す', async () => {
    const { fromCatalog: from } = await import('../lib/exerciseCatalog');
    const bench = from(
      CATALOG.find((c) => c.id === 'ex_bench')!,
      0,
    );
    bench.goal = { type: 'maintain', value: null };
    localStorage.setItem(
      'bodymake.data.v1',
      JSON.stringify({ version: 2, settings: {}, entries: {}, exercises: [bench], workouts: {} }),
    );
    render(<ManagerHarness />);

    // 維持は数値を持たないので、値のバッジは出ない
    expect(screen.getByText('維持')).toBeTruthy();
    expect(screen.queryByText(/^目標 /)).toBeNull();
  });

  it('カタログを器具と部位の2軸で絞り込める', () => {
    render(<ManagerHarness />);
    fireEvent.click(screen.getByText('＋ マイ種目に追加'));
    expect(screen.getByText(/^＋ スクワット/)).toBeTruthy();

    fireEvent.click(within(screen.getByRole('group', { name: '部位' })).getByText('胸'));
    // 「すべて」は器具でも絞らないので、両方の器具ぶんが出る
    expect(screen.getByText('＋ ベンチプレス（バーベル）')).toBeTruthy();
    expect(screen.getByText('＋ ベンチプレス（ダンベル）')).toBeTruthy();
    expect(screen.queryByText(/^＋ スクワット/)).toBeNull();

    // ダンベルに絞るとダンベル版だけになる
    fireEvent.click(within(screen.getByRole('group', { name: '器具' })).getByText('ダンベル'));
    expect(screen.getByText('＋ ベンチプレス（ダンベル）')).toBeTruthy();
    expect(screen.queryByText('＋ ベンチプレス（バーベル）')).toBeNull();

    // 器具の絞り込みと重ねて効く。腕立て伏せは胸の自重種目
    fireEvent.click(within(screen.getByRole('group', { name: '器具' })).getByText('自重'));
    expect(screen.getByText(/^＋ 腕立て伏せ/)).toBeTruthy();
    expect(screen.queryByText(/^＋ ベンチプレス/)).toBeNull();

    // 両方に合う種目が無ければ、追加済みだからではないと分かる文言を出す
    // （自重はどの部位にもあるので、ダンベル × 体幹で見る）
    fireEvent.click(within(screen.getByRole('group', { name: '器具' })).getByText('ダンベル'));
    fireEvent.click(within(screen.getByRole('group', { name: '部位' })).getByText('体幹'));
    expect(screen.getByText('この絞り込みに合う種目はありません。')).toBeTruthy();
  });

  it('計算方法は設定のさらに内側に畳む', () => {
    render(<ManagerHarness />);
    fireEvent.click(screen.getByText('＋ マイ種目に追加'));
    fireEvent.click(screen.getByText('＋ ベンチプレス（バーベル）'));
    fireEvent.click(screen.getByText('閉じる'));
    // 目標が抜けたので、「設定」は詳細をそのまま開く
    fireEvent.click(screen.getByText('設定'));

    // カタログから入れれば埋まっている項目なので、開いた時点では出さない
    expect(screen.getByLabelText('部位')).toBeTruthy();
    expect(screen.queryByLabelText(/^負荷の数え方/)).toBeNull();

    fireEvent.click(screen.getByText('計算方法を変える'));
    expect(screen.getByLabelText(/^負荷の数え方/)).toBeTruthy();
    expect(screen.getByLabelText(/^回数の単位/)).toBeTruthy();
  });

  it('主部位を補助部位と同じ部位に変えたら、補助から落とす', () => {
    render(<ManagerHarness />);
    fireEvent.click(screen.getByText('＋ マイ種目に追加'));
    fireEvent.click(screen.getByText('＋ ベンチプレス（バーベル）'));
    fireEvent.click(screen.getByText('閉じる'));

    // 主部位は見出しが持つので、行のタグは補助部位だけ
    const row = () => screen.getByText('ベンチプレス（バーベル）').closest('div')!;
    expect(within(row()).getByText('肩·腕')).toBeTruthy();

    fireEvent.click(screen.getByText('設定'));
    // 補助部位に肩を持ったまま主部位を肩にすると、肩を二重に数えてしまう
    fireEvent.change(screen.getByLabelText('部位'), { target: { value: 'shoulders' } });

    expect(within(row()).getByText('腕')).toBeTruthy();
    expect(within(row()).queryByText('肩·腕')).toBeNull();
  });

  it('一覧は部位ごとに並べ、上下の並び替えは持たない', () => {
    render(<ManagerHarness />);
    fireEvent.click(screen.getByText('＋ マイ種目に追加'));
    fireEvent.click(screen.getByText('＋ ベンチプレス（バーベル）'));
    fireEvent.click(screen.getByText(/^＋ スクワット/));
    fireEvent.click(screen.getByText('閉じる'));

    // 見出しは主部位で切る。順番ではなく部位で探す
    const headings = [...document.querySelectorAll('[class*="manageGroup"]')].map(
      (el) => el.textContent,
    );
    expect(headings).toEqual(['胸', '脚']);

    expect(screen.queryByLabelText(/を上へ$/)).toBeNull();
    expect(screen.queryByLabelText(/を下へ$/)).toBeNull();
  });

  it('記録の無い種目は確認せずに削除する', () => {
    render(<ManagerHarness />);
    fireEvent.click(screen.getByText('＋ マイ種目に追加'));
    fireEvent.click(screen.getByText('＋ ベンチプレス（バーベル）'));
    fireEvent.click(screen.getByText(/^＋ スクワット/));
    expect(screen.getByText(/^2件 \/ 目標/)).toBeTruthy();

    // 記録の無い種目は失うものが無いので確認しない
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByLabelText('ベンチプレス（バーベル）を削除'));
    expect(screen.getByText(/^1件 \/ 目標/)).toBeTruthy();
    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});

describe('設定（カテゴリ別の画面遷移）', () => {
  function SettingsHarness({
    section,
    page = null,
  }: {
    section: string | null;
    page?: string | null;
  }) {
    const body = useBodyData();
    const [route, setRoute] = useState({ section, page });
    return (
      <SettingsView
        body={body}
        section={route.section}
        page={route.page}
        onOpen={(sec, p) => setRoute({ section: sec, page: p ?? null })}
        onToast={() => {}}
      />
    );
  }

  it('カテゴリは 一般 と トレーニング の 2 つ', () => {
    // 目標体重も週のセット数も種目の目標も、目標タブへ移した
    expect(SETTINGS_SECTIONS.map((sec) => sec.id)).toEqual(['general', 'training']);
    render(<SettingsHarness section="general" />);
    expect(screen.queryByLabelText(/目標体重/)).toBeNull();
    expect(screen.queryByLabelText(/身長/)).toBeNull();
  });
  it('カテゴリ一覧から選ぶと、その設定だけが出る', () => {
    render(<SettingsHarness section={null} />);

    // 一覧の時点では中身のフォームは出ていない
    expect(screen.queryByLabelText('テーマ')).toBeNull();
    SETTINGS_SECTIONS.forEach((sec) => expect(screen.getByText(sec.label)).toBeTruthy());

    fireEvent.click(screen.getByText('一般'));
    expect(screen.getByLabelText('テーマ')).toBeTruthy();
    expect(screen.getByText('データ')).toBeTruthy();
  });

  it('トレーニングは マイ種目 / プリセット / レビュー に分かれる', () => {
    seedExercises('ex_bench');
    render(<SettingsHarness section="training" />);

    // 何件あるかは開く前に見える。空の画面を開きに行かせない
    expect(TRAINING_PAGES.map((p) => p.id)).toEqual(['exercises', 'presets', 'checks']);
    expect(screen.getByText('マイ種目')).toBeTruthy();
    expect(screen.getByText('プリセット')).toBeTruthy();
    expect(screen.getByText('トレーニング種目のレビュー')).toBeTruthy();
    expect(screen.getByText('1件')).toBeTruthy();
    expect(screen.getByText('0件')).toBeTruthy();
    // 一覧の時点では中身は出ていない
    expect(screen.queryByText('＋ マイ種目に追加')).toBeNull();

    fireEvent.click(screen.getByText('マイ種目'));
    expect(screen.getByText('＋ マイ種目に追加')).toBeTruthy();
  });

  it('マイ種目は種目の追加と詳細設定を扱う（目標はここに置かない）', () => {
    seedExercises('ex_bench');
    render(<SettingsHarness section="training" page="exercises" />);

    expect(screen.getByText('＋ マイ種目に追加')).toBeTruthy();
    expect(screen.queryByLabelText(/ベンチプレス.*の目標の種類/)).toBeNull();

    // 行の「設定」は詳細設定を直接開く（目標の 1 段下に埋もれていない）
    fireEvent.click(screen.getByRole('button', { name: /ベンチプレス.*の設定/ }));
    expect(screen.getByText('補助的に使う部位')).toBeTruthy();
    expect(screen.queryByLabelText(/ベンチプレス.*の目標の種類/)).toBeNull();
  });

  it('一般に表示・データ・このアプリについてがまとまる', () => {
    render(<SettingsHarness section="general" />);
    expect(screen.getByLabelText('テーマ')).toBeTruthy();
    expect(screen.getByText('データ')).toBeTruthy();
    expect(screen.getByText('このアプリについて')).toBeTruthy();
  });

  it('遷移先のタイトルは URL のセクション名から引ける', () => {
    expect(settingsSectionTitle('general')).toBe('一般');
    expect(settingsSectionTitle('training')).toBe('トレーニング');
    expect(settingsSectionTitle('unknown')).toBeNull();
    // 体組成のカテゴリは無くなった（目標タブへ移した）
    expect(settingsSectionTitle('body')).toBeNull();

    // セクションの中の画面まで含めた見出し（`#settings/training/presets`）
    expect(settingsTitle('training', 'presets')).toBe('プリセット');
    expect(settingsTitle('training', 'exercises')).toBe('マイ種目');
    // 知らない画面はセクションの見出しに落とす（URL を直接開かれても壊れない）
    expect(settingsTitle('training', 'unknown')).toBe('トレーニング');
    expect(settingsTitle('training', null)).toBe('トレーニング');
    expect(settingsTitle('general', 'presets')).toBe('一般');
    expect(settingsTitle(null, null)).toBeNull();
  });
});

describe('記録タブ', () => {
  function RecordsHarness({ domain = 'body' as Domain }) {
    const body = useBodyData();
    const [date, setDate] = useState(todayISO);
    return <RecordsView body={body} date={date} onDateChange={setDate} domain={domain} />;
  }

  it('ヘッダの切り替えに従って体組成とトレーニングを出し分ける', () => {
    // どちらの側にも記録一覧があるので、入力カードの見出しと種目の＋で区別する
    const { unmount } = render(<RecordsHarness domain="body" />);
    expect(screen.getByRole('heading', { name: '体組成' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '種目を追加' })).toBeNull();
    unmount();

    render(<RecordsHarness domain="training" />);
    expect(screen.queryByRole('heading', { name: '体組成' })).toBeNull();
    expect(screen.getByRole('button', { name: '種目を追加' })).toBeTruthy();
  });
});

describe('推移（ホームの下位画面）', () => {
  function ChartsHarness({ domain = 'training' as Domain }) {
    const body = useBodyData();
    return <ChartsView body={body} domain={domain} />;
  }

  function seedTraining() {
    seedData(['ex_bench', 'ex_lateral_raise'], {
      '2026-03-01': [{ exerciseId: 'ex_bench', sets: [{ weight: 60, reps: 10 }] }],
      '2026-03-08': [
        { exerciseId: 'ex_bench', sets: [{ weight: 65, reps: 8 }] },
        { exerciseId: 'ex_lateral_raise', sets: [{ weight: 10, reps: 15 }] },
      ],
    });
  }

  it('ヘッダの切り替えに従って体組成とトレーニングを出し分ける', () => {
    seedTraining();
    const { unmount } = render(<ChartsHarness domain="body" />);
    expect(screen.getByText('体重の推移')).toBeTruthy();
    expect(screen.queryByText('種目別の推移')).toBeNull();
    unmount();

    render(<ChartsHarness domain="training" />);
    expect(screen.queryByText('体重の推移')).toBeNull();
    expect(screen.getByText('種目別の推移')).toBeTruthy();
  });

  it('記録のある種目だけを選べて、指標を切り替えられる', () => {
    seedTraining();
    render(<ChartsHarness />);

    // 「挙上量」は部位別の配分カードにもあるので、推移カードの中で探す
    const card = within(screen.getByText('種目別の推移').closest('section')!);

    // 一覧には記録のある種目だけが並ぶ
    expect(card.getByRole('button', { name: /ベンチプレス/ })).toBeTruthy();
    expect(card.getByRole('button', { name: /サイドレイズ/ })).toBeTruthy();
    expect(card.queryByRole('button', { name: /スクワット/ })).toBeNull();
    expect(card.getByRole('button', { name: '挙上量', pressed: true })).toBeTruthy();

    fireEvent.click(card.getByRole('button', { name: '推定1RM' }));
    expect(card.getByRole('button', { name: '推定1RM', pressed: true })).toBeTruthy();
    // レップ数に依存しない最大重量も選べる
    expect(card.getByRole('button', { name: '最大重量' })).toBeTruthy();
  });

  it('一覧の行を選ぶと、詳細のグラフと元データをダイアログで出す', () => {
    seedTraining();
    render(<ChartsHarness />);
    // 詳細は画面に常駐させない。一覧を見比べる邪魔になる
    expect(screen.queryByText('元データ')).toBeNull();
    expect(dialogOpen()).toBe(false);

    const card = within(screen.getByText('種目別の推移').closest('section')!);
    fireEvent.click(card.getByRole('button', { name: /ベンチプレス/ }));
    expect(dialogOpen()).toBe(true);
    expect(screen.getByText('元データ')).toBeTruthy();
    // 見出しの数値は通算の最高
    expect(screen.getByText('過去最大')).toBeTruthy();
    // 週のセット数へこの種目がどれだけ効いたか
    expect(screen.getByText('週のセット数への貢献')).toBeTruthy();
  });

  it('種目別の推移を部位で絞れる', () => {
    seedTraining();
    render(<ChartsHarness />);

    const card = within(screen.getByText('種目別の推移').closest('section')!);
    expect(card.getByRole('button', { name: /ベンチプレス/ })).toBeTruthy();
    expect(card.getByRole('button', { name: /サイドレイズ/ })).toBeTruthy();

    // 補助部位は拾わない（腕にベンチプレスが並ぶと、種目の推移として読めない）
    fireEvent.click(within(card.getByRole('group', { name: '部位' })).getByText('肩'));
    expect(card.queryByRole('button', { name: /ベンチプレス/ })).toBeNull();
    expect(card.getByRole('button', { name: /サイドレイズ/ })).toBeTruthy();

    fireEvent.click(within(card.getByRole('group', { name: '部位' })).getByText('すべて'));
    expect(card.getByRole('button', { name: /ベンチプレス/ })).toBeTruthy();
  });

  it('グラフ画面は種目別の推移だけを出す', () => {
    seedTraining();
    render(<ChartsHarness />);

    const titles = [...document.querySelectorAll('h2')].map((h) => h.textContent);
    // 部位ごとの話はホームへ移した。ここは種目の推移だけ
    expect(titles).toEqual(['種目別の推移']);
  });

  it('秒で数える種目しか無ければ、重量の指標そのものを出さない', () => {
    seedData(['ex_plank'], {
      '2026-03-08': [{ exerciseId: 'ex_plank', sets: [{ weight: null, reps: 60 }] }],
    });
    render(<ChartsHarness />);

    const card = within(screen.getByText('種目別の推移').closest('section')!);
    expect(card.queryByRole('button', { name: '推定1RM' })).toBeNull();
    expect(card.queryByRole('button', { name: '挙上量' })).toBeNull();
    expect(card.getByRole('button', { name: '最大回数', pressed: true })).toBeTruthy();
  });

  it('重量の種目と混ざっているときは、秒の種目を選ぶと出せない理由を出す', () => {
    // 指標は一覧ぜんぶに効くので、挙上量のまま秒の種目を選べてしまう。
    // 「記録がありません」だと、記録はあるのに無いように読める
    seedData(['ex_bench', 'ex_plank'], {
      '2026-03-01': [{ exerciseId: 'ex_bench', sets: [{ weight: 60, reps: 10 }] }],
      '2026-03-08': [{ exerciseId: 'ex_plank', sets: [{ weight: null, reps: 60 }] }],
    });
    render(<ChartsHarness />);

    const card = within(screen.getByText('種目別の推移').closest('section')!);
    fireEvent.click(card.getByRole('button', { name: /プランク/ }));
    // ダイアログ側は種目 1 つぶんなので、秒の種目では重量系の指標そのものを出さない
    const dialog = within(document.querySelector('dialog')!);
    expect(dialog.queryByRole('button', { name: '挙上量' })).toBeNull();
    expect(dialog.queryByRole('button', { name: '推定1RM' })).toBeNull();
    expect(dialog.getByRole('button', { name: '最大回数', pressed: true })).toBeTruthy();
  });

  it('記録が無ければ空状態を出す', () => {
    seedExercises('ex_bench');
    render(<ChartsHarness />);
    expect(screen.getByText(/まだトレーニングの記録がありません/)).toBeTruthy();
  });
});

describe('種目の目標', () => {
  it('目標は推定1RMではなく最大重量で判定する', async () => {
    const { exerciseGoals } = await import('../lib/training');
    const { buildSessions } = await import('../lib/training');

    const bench = fromCatalog(
      CATALOG.find((c) => c.id === 'ex_bench')!,
      0,
    );
    bench.goal = { type: 'weight', value: 100 };
    const sessions = buildSessions(
      {
        '2026-03-01': [{ exerciseId: 'ex_bench', sets: [{ weight: 60, reps: 10 }] }],
        '2026-03-04': [{ exerciseId: 'ex_bench', sets: [{ weight: 60, reps: 10 }] }],
        '2026-03-08': [{ exerciseId: 'ex_bench', sets: [{ weight: 60, reps: 10 }] }],
        '2026-03-11': [{ exerciseId: 'ex_bench', sets: [{ weight: 80, reps: 5 }] }],
      },
      [bench],
      [],
    );

    const [goal] = exerciseGoals(sessions, [bench]);
    // 推定1RM は 80 × (1 + 5/40) = 90 だが、判定に使うのは実際に挙げた 80kg
    expect(goal!.current).toBe(80);
    expect(goal!.baseline).toBe(60);
    expect(goal!.delta).toBe(20);
    expect(goal!.progress).toBeCloseTo((80 - 60) / (100 - 60), 6);
    expect(goal!.reached).toBe(false);
  });

  it('到達していればバーは満杯（目標が開始値より下でも空にしない）', async () => {
    const { exerciseGoals, buildSessions } = await import('../lib/training');

    const bench = fromCatalog(
      CATALOG.find((c) => c.id === 'ex_bench')!,
      0,
    );
    // 開始値（60）より下に目標を決めた場合。比率だけで出すと分母が負になって 0 になる
    bench.goal = { type: 'weight', value: 6 };
    const sessions = buildSessions(
      {
        '2026-03-01': [{ exerciseId: 'ex_bench', sets: [{ weight: 60, reps: 10 }] }],
        '2026-03-04': [{ exerciseId: 'ex_bench', sets: [{ weight: 60, reps: 10 }] }],
        '2026-03-08': [{ exerciseId: 'ex_bench', sets: [{ weight: 60, reps: 10 }] }],
        '2026-03-11': [{ exerciseId: 'ex_bench', sets: [{ weight: 66, reps: 5 }] }],
      },
      [bench],
      [],
    );

    const [goal] = exerciseGoals(sessions, [bench]);
    expect(goal!.reached).toBe(true);
    expect(goal!.progress).toBe(1);
  });

  it('記録が 3 セッションに満たなくても、到達していれば満杯', async () => {
    const { exerciseGoals, buildSessions } = await import('../lib/training');

    const bench = fromCatalog(
      CATALOG.find((c) => c.id === 'ex_bench')!,
      0,
    );
    bench.goal = { type: 'weight', value: 60 };
    const sessions = buildSessions(
      { '2026-03-01': [{ exerciseId: 'ex_bench', sets: [{ weight: 60, reps: 10 }] }] },
      [bench],
      [],
    );

    const [goal] = exerciseGoals(sessions, [bench]);
    // 開始値はまだ出せない（3 セッション必要）が、到達したという事実は出せる
    expect(goal!.baseline).toBeNull();
    expect(goal!.reached).toBe(true);
    expect(goal!.progress).toBe(1);
  });

  it('目標を設定していない種目は出てこない', async () => {
    const { exerciseGoals } = await import('../lib/training');
    const bench = fromCatalog(
      CATALOG.find((c) => c.id === 'ex_bench')!,
      0,
    );
    expect(exerciseGoals([], [bench])).toEqual([]);
  });
});

describe('目標の種類', () => {
  it('回数目標は最大レップ数で判定する', async () => {
    const { exerciseGoals, buildSessions } = await import('../lib/training');
    const pullup = fromCatalog(
      CATALOG.find((c) => c.id === 'ex_pullup')!,
      0,
    );
    pullup.goal = { type: 'reps', value: 10 };
    const sessions = buildSessions(
      {
        '2026-03-01': [{ exerciseId: 'ex_pullup', sets: [{ weight: null, reps: 4 }] }],
        '2026-03-04': [{ exerciseId: 'ex_pullup', sets: [{ weight: null, reps: 4 }] }],
        '2026-03-08': [{ exerciseId: 'ex_pullup', sets: [{ weight: null, reps: 4 }] }],
        '2026-03-11': [
          {
            exerciseId: 'ex_pullup',
            sets: [
              { weight: null, reps: 5 },
              { weight: null, reps: 7 },
            ],
          },
        ],
      },
      [pullup],
      [],
    );

    const [goal] = exerciseGoals(sessions, [pullup]);
    expect(goal!.type).toBe('reps');
    expect(goal!.unit).toBe('回');
    expect(goal!.current).toBe(7); // セット内の最大レップ
    expect(goal!.baseline).toBe(4);
    expect(goal!.progress).toBeCloseTo((7 - 4) / (10 - 4), 6);
  });

  it('重量固定で持っていた古いデータを読み替える', async () => {
    const { sanitizeData } = await import('../lib/storage');
    const data = sanitizeData({
      exercises: [{ id: 'ex_bench', name: 'ベンチプレス', targetWeight: 100 }],
    });
    expect(data.exercises[0]!.goal).toEqual({ type: 'weight', value: 100 });
  });
});

describe('重量の数え方', () => {
  it('左右に1つずつ持つ種目だけ2倍で計上する', async () => {
    const { buildExercisePoint } = await import('../lib/training');
    const base = fromCatalog(
      CATALOG.find((c) => c.id === 'ex_curl')!,
      0,
      'dumbbell',
    );
    const entry = { exerciseId: base.id, sets: [{ weight: 20, reps: 10 }] };

    // ダンベル20kg×2 と バーベル40kg を同じ負荷として扱う
    expect(buildExercisePoint(base, entry, null).volume).toBe(400);
    // 片手ずつ・両手で1つの種目は等倍
    expect(buildExercisePoint({ ...base, loadMode: 'standard' }, entry, null).volume).toBe(200);
  });

  it('秒で計る種目は目標も秒で判定する', async () => {
    const { exerciseGoals, buildSessions } = await import('../lib/training');
    const plank = fromCatalog(
      CATALOG.find((c) => c.id === 'ex_plank')!,
      0,
    );
    plank.goal = { type: 'reps', value: 120 };
    expect(plank.repUnit).toBe('seconds');

    const sessions = buildSessions(
      {
        '2026-03-01': [{ exerciseId: 'ex_plank', sets: [{ weight: null, reps: 30 }] }],
        '2026-03-04': [{ exerciseId: 'ex_plank', sets: [{ weight: null, reps: 30 }] }],
        '2026-03-08': [{ exerciseId: 'ex_plank', sets: [{ weight: null, reps: 30 }] }],
        '2026-03-11': [{ exerciseId: 'ex_plank', sets: [{ weight: null, reps: 75 }] }],
      },
      [plank],
      [],
    );

    const [goal] = exerciseGoals(sessions, [plank]);
    expect(goal!.unit).toBe('秒');
    expect(goal!.current).toBe(75);
    expect(goal!.progress).toBeCloseTo((75 - 30) / (120 - 30), 6);
  });
});

describe('目標と負荷の数え方', () => {
  it('重量目標は記録した数字で判定する（左右2つ持つ種目でも2倍しない）', async () => {
    const { exerciseGoals, buildSessions } = await import('../lib/training');
    const curl = fromCatalog(
      CATALOG.find((c) => c.id === 'ex_curl')!,
      0,
      'dumbbell',
    );
    curl.goal = { type: 'weight', value: 30 };
    expect(curl.loadMode).toBe('perSide');

    const sessions = buildSessions(
      {
        '2026-03-01': [{ exerciseId: curl.id, sets: [{ weight: 20, reps: 10 }] }],
        '2026-03-04': [{ exerciseId: curl.id, sets: [{ weight: 20, reps: 10 }] }],
        '2026-03-08': [{ exerciseId: curl.id, sets: [{ weight: 20, reps: 10 }] }],
        '2026-03-11': [{ exerciseId: curl.id, sets: [{ weight: 25, reps: 8 }] }],
      },
      [curl],
      [],
    );

    const [goal] = exerciseGoals(sessions, [curl]);
    // 打った数字は 25。有効重量の 50 と比べない
    expect(goal!.current).toBe(25);
    expect(goal!.baseline).toBe(20);
    expect(goal!.progress).toBeCloseTo((25 - 20) / (30 - 20), 6);

    // 挙上量のほうは 2 倍で計上される
    expect(sessions[3]!.exercises[0]!.volume).toBe(25 * 2 * 8);
  });
});

describe('秒で数える種目', () => {
  it('挙上量に計上せず、重量の指標も出さない（種目側のフラグを持たない）', async () => {
    const { buildExercisePoint } = await import('../lib/training');
    const plank = fromCatalog(
      CATALOG.find((c) => c.id === 'ex_plank')!,
      0,
    );
    // 挙上量に計上しないのは「秒だから」であって、種目側の設定によるものではない
    expect(plank.repUnit).toBe('seconds');
    expect(plank.loadMode).toBe('standard');

    const point = buildExercisePoint(
      plank,
      { exerciseId: plank.id, sets: [{ weight: null, reps: 60 }] },
      70,
    );
    expect(point.volume).toBe(0);
    expect(point.workSets).toBe(1);
    expect(point.metric).toBe(60);
  });

  it('回で数えるが重量を記録しない種目は、そのままでも挙上量が0になる', async () => {
    const { buildExercisePoint } = await import('../lib/training');
    const roller = fromCatalog(
      CATALOG.find((c) => c.id === 'ex_ab_roller')!,
      0,
    );
    expect(roller.loadMode).toBe('standard');

    const point = buildExercisePoint(
      roller,
      { exerciseId: roller.id, sets: [{ weight: null, reps: 12 }] },
      70,
    );
    expect(point.volume).toBe(0);
    expect(point.workSets).toBe(1);
  });
});

describe('CSV 書き出し', () => {
  it('筋トレはセット単位の明細と週次の部位別セット数を出す', async () => {
    const { buildCsvRows } = await import('../lib/io');
    const { buildSessions } = await import('../lib/training');
    const bench = fromCatalog(
      CATALOG.find((c) => c.id === 'ex_bench')!,
      0,
    );
    const sessions = buildSessions(
      {
        '2026-03-10': [
          {
            exerciseId: 'ex_bench',
            sets: [
              { weight: 60, reps: 10 },
              { weight: 60, reps: 8 },
            ],
          },
        ],
      },
      [bench],
      [],
    );

    const csv = buildCsvRows([], [], sessions).map((r) => r.join(','));
    expect(csv).toContain('# 筋トレログ（セット単位）');
    // 主部位と補助部位は別の列に出す（ピボットの軸を壊さないため）。
    // 係数は種目ごとに違うので、部位名だけだと Excel 側で挙上量を割り戻せない
    expect(
      csv.some((r) => r.includes('ベンチプレス（バーベル）,胸,肩×0.5・腕×0.5,1,60.0,10,回')),
    ).toBe(true);
    expect(
      csv.some((r) => r.includes('ベンチプレス（バーベル）,胸,肩×0.5・腕×0.5,2,60.0,8,回')),
    ).toBe(true);
    expect(csv).toContain('# 週次の部位別セット数');

    // 部位別セット数は係数ぶんの端数が出る。胸 2 / 肩 1 / 腕 1、合計 4
    const header = csv.indexOf('# 週次の部位別セット数');
    expect(csv[header + 2]!.endsWith(',2,0,0,1,1,0,4')).toBe(true);
  });
});

describe('全体状況の指標', () => {
  it('今週の部位別セット数を出し、やっていない部位は空き日数で示す', async () => {
    const { buildSessions, computeTrainingStats } = await import('../lib/training');
    const { startOfWeek, todayISO, addDays } = await import('../lib/date');

    // 今週の中の日と、それより前の日を用意する
    const thisWeek = startOfWeek(todayISO());
    const past = addDays(thisWeek, -20);

    const bench = fromCatalog(
      CATALOG.find((c) => c.id === 'ex_bench')!,
      0,
    ); // 胸
    const squat = fromCatalog(
      CATALOG.find((c) => c.id === 'ex_squat')!,
      1,
    ); // 脚
    const sessions = buildSessions(
      {
        [thisWeek]: [
          {
            exerciseId: 'ex_bench',
            sets: [
              { weight: 60, reps: 10 },
              { weight: 60, reps: 8 },
            ],
          },
        ],
        [past]: [{ exerciseId: 'ex_squat', sets: [{ weight: 100, reps: 5 }] }],
      },
      [bench, squat],
      [],
    );

    const stats = computeTrainingStats(sessions);
    expect(stats.thisWeekSetsByGroup.chest).toBe(2);
    expect(stats.thisWeekSetsByGroup.legs).toBe(0); // 今週はやっていない
    expect(stats.daysSinceGroup.legs).toBeGreaterThan(0); // 何日空いているかは出せる
    expect(stats.daysSinceGroup.back).toBeNull(); // 記録なし
  });

  it('自己最高は「窓の外の最高を超えたとき」だけ数える', async () => {
    const { buildSessions, computeTrainingStats, RECENT_DAYS } = await import('../lib/training');
    const iso = (back: number) => {
      const d = new Date();
      d.setDate(d.getDate() - back);
      return d.toISOString().slice(0, 10);
    };
    const bench = fromCatalog(
      CATALOG.find((c) => c.id === 'ex_bench')!,
      0,
    );
    const stats = (workouts: Record<string, unknown>) =>
      computeTrainingStats(buildSessions(workouts as never, [bench], []));

    // セットを足しただけ。挙上量は最高でも強さは伸びていないので数えない
    expect(
      stats({
        [iso(RECENT_DAYS + 10)]: [{ exerciseId: 'ex_bench', sets: [{ weight: 60, reps: 10 }] }],
        [iso(3)]: [
          {
            exerciseId: 'ex_bench',
            sets: [
              { weight: 60, reps: 10 },
              { weight: 60, reps: 10 },
            ],
          },
        ],
      }).recentBests,
    ).toBe(0);

    // 重量が伸びていれば数える
    expect(
      stats({
        [iso(RECENT_DAYS + 10)]: [{ exerciseId: 'ex_bench', sets: [{ weight: 60, reps: 10 }] }],
        [iso(3)]: [{ exerciseId: 'ex_bench', sets: [{ weight: 65, reps: 8 }] }],
      }).recentBests,
    ).toBe(1);

    // 窓の外に記録がない（始めたばかりの）種目は数えない
    expect(
      stats({
        [iso(10)]: [{ exerciseId: 'ex_bench', sets: [{ weight: 60, reps: 10 }] }],
        [iso(3)]: [{ exerciseId: 'ex_bench', sets: [{ weight: 70, reps: 8 }] }],
      }).recentBests,
    ).toBe(0);
  });
});

describe('部位別セット数の目標', () => {
  it('値域外は保存されず、範囲内は丸めて保存される', async () => {
    const { sanitizeData, GROUP_GOAL_RANGE } = await import('../lib/storage');
    const data = sanitizeData({
      groupGoals: { chest: 12, back: 12.6, legs: 0, shoulders: GROUP_GOAL_RANGE[1] + 1, arms: 'x' },
    });
    expect(data.groupGoals.chest).toBe(12);
    expect(data.groupGoals.back).toBe(13); // 整数に丸める
    expect(data.groupGoals.legs).toBeNull(); // 下限未満
    expect(data.groupGoals.shoulders).toBeNull(); // 上限超え
    expect(data.groupGoals.arms).toBeNull();
    expect(data.groupGoals.core).toBeNull(); // 未指定
  });

  it('目標はバックアップに含まれて往復する', async () => {
    const { sanitizeData } = await import('../lib/storage');
    const original = sanitizeData({ groupGoals: { chest: 12, back: 15 } });
    const roundTripped = sanitizeData(JSON.parse(JSON.stringify(original)));
    expect(roundTripped.groupGoals).toEqual(original.groupGoals);
  });
});

describe('補助部位', () => {
  it('補助部位は0.5セットとして数える', async () => {
    const { buildSessions, buildWeeklySets } = await import('../lib/training');
    const bench = fromCatalog(
      CATALOG.find((c) => c.id === 'ex_bench')!,
      0,
    );
    expect(bench.group).toBe('chest');
    expect(bench.subGroups).toEqual([
      { group: 'shoulders', weight: 0.5 },
      { group: 'arms', weight: 0.5 },
    ]);

    const sessions = buildSessions(
      {
        '2026-03-10': [
          {
            exerciseId: 'ex_bench',
            sets: [
              { weight: 60, reps: 10 },
              { weight: 60, reps: 10 },
            ],
          },
        ],
      },
      [bench],
      [],
    );

    const [week] = buildWeeklySets(sessions, '2026-03-10');
    // 主部位は 2 セット、補助部位は半分の 1 セット。
    // 等倍にすると、押す日のベンチだけで腕の目標が埋まってしまう
    expect(week!.setsByGroup.chest).toBe(2);
    expect(week!.setsByGroup.shoulders).toBe(1);
    expect(week!.setsByGroup.arms).toBe(1);
    expect(week!.setsByGroup.back).toBe(0);
    // 挙上量も同じ割合で分かれる（60×10×2 = 1200）
    expect(week!.volumeByGroup.chest).toBe(1200);
    expect(week!.volumeByGroup.shoulders).toBe(600);
  });

  it('1セット相当に満たない部位は「やった部位」に数えない', async () => {
    const { buildSessions, sessionGroups } = await import('../lib/training');
    const { CATALOG, fromCatalog } = await import('../lib/exerciseCatalog');
    const raise = fromCatalog(
      CATALOG.find((c) => c.id === 'ex_front_raise')!,
      0,
    );
    expect(raise.subGroups).toEqual([{ group: 'chest', weight: 0.25 }]);

    const day = (sets: number) => ({
      '2026-03-10': [
        {
          exerciseId: 'ex_front_raise',
          sets: Array.from({ length: sets }, () => ({ weight: 8, reps: 12 })),
        },
      ],
    });

    // フロントレイズ 3 セットの胸は 0.75 セット相当。肩だけの日を「胸」と呼ばない
    expect(sessionGroups(buildSessions(day(3), [raise], [])[0]!)).toEqual(['shoulders']);
    // 4 セットで 1 セット相当に届く
    expect(sessionGroups(buildSessions(day(4), [raise], [])[0]!)).toEqual(['chest', 'shoulders']);
  });

  it('補助部位の係数は種目ごとに設定でき、値域を外れたら既定に戻す', async () => {
    const { sanitizeData } = await import('../lib/storage');
    const { buildSessions, buildWeeklySets } = await import('../lib/training');
    const { CATALOG, fromCatalog } = await import('../lib/exerciseCatalog');

    // デッドリフトの脚は主働筋なので既定より重く、グリップは実感の割に小さい
    const dead = fromCatalog(
      CATALOG.find((c) => c.id === 'ex_deadlift')!,
      0,
    );
    expect(dead.subGroups).toEqual([
      { group: 'legs', weight: 1 },
      { group: 'arms', weight: 0.25 },
      { group: 'core', weight: 0.5 },
    ]);

    const sessions = buildSessions(
      { '2026-03-10': [{ exerciseId: 'ex_deadlift', sets: [{ weight: 100, reps: 5 }] }] },
      [dead],
      [],
    );
    const [week] = buildWeeklySets(sessions, '2026-03-10');
    expect(week!.setsByGroup.back).toBe(1);
    expect(week!.setsByGroup.legs).toBe(1);
    expect(week!.setsByGroup.arms).toBe(0.25); // 0.25 刻みを丸めで潰さない
    expect(week!.setsByGroup.core).toBe(0.5);

    const data = sanitizeData({
      exercises: [
        {
          id: 'a',
          name: 'A',
          group: 'chest',
          subGroups: [
            { group: 'arms', weight: 0.3 },
            { group: 'shoulders', weight: 9 },
          ],
        },
      ],
    });
    expect(data.exercises[0]!.subGroups).toEqual([
      { group: 'arms', weight: 0.3 },
      { group: 'shoulders', weight: 0.5 },
    ]);
  });

  it('主部位と同じ部位や未知の部位は補助部位から落とす', async () => {
    const { sanitizeData } = await import('../lib/storage');
    const data = sanitizeData({
      exercises: [
        {
          id: 'a',
          name: 'A',
          group: 'chest',
          // 係数を持たせる前のバックアップ形式（部位名の配列）も読める
          subGroups: ['chest', 'arms', 'arms', 'nope'],
        },
      ],
    });
    expect(data.exercises[0]!.subGroups).toEqual([{ group: 'arms', weight: 0.5 }]);
  });
});

describe('テーマ', () => {
  function ThemeHarness({ pref }: { pref: ThemePref }) {
    useTheme(pref);
    return null;
  }

  it('名前つきの配色を選ぶと data-theme が切り替わり、system では外れる', () => {
    // jsdom には matchMedia が無い。'system' の解決で使う経路だけ塞ぐ
    vi.stubGlobal('matchMedia', () => ({ matches: false }));

    const { rerender } = render(<ThemeHarness pref="indigo-night" />);
    expect(document.documentElement.getAttribute('data-theme')).toBe('indigo-night');

    rerender(<ThemeHarness pref="sakura" />);
    expect(document.documentElement.getAttribute('data-theme')).toBe('sakura');

    // 端末に合わせるへ戻すと属性ごと外れる（OS 設定へ委ねる）
    rerender(<ThemeHarness pref="system" />);
    expect(document.documentElement.getAttribute('data-theme')).toBeNull();

    vi.unstubAllGlobals();
  });

  it('ステータスバーの色はトークンから読む（配色ごとの色を二重に持たない）', async () => {
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    meta.setAttribute('content', '#000000');
    meta.setAttribute('media', '(prefers-color-scheme: dark)');
    document.head.appendChild(meta);

    // jsdom はスタイルシートを解決しないので、--plane の読み出しだけ差し替える
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      getPropertyValue: () => ' #1e1b4b ',
    } as unknown as CSSStyleDeclaration);

    render(<ThemeHarness pref="indigo-night" />);
    expect(meta.getAttribute('content')).toBe('#1e1b4b');
    // media 付きのままだと片方の配色でしか効かない
    expect(meta.hasAttribute('media')).toBe(false);

    vi.restoreAllMocks();
    meta.remove();
  });

  it('選択肢の id が重複していない', async () => {
    const { THEME_OPTIONS, THEME_IDS } = await import('../lib/themes');
    expect(new Set(THEME_IDS).size).toBe(THEME_OPTIONS.length);
  });

  it('知らないテーマを持つバックアップは system に落とす', async () => {
    const { sanitizeData } = await import('../lib/storage');
    expect(sanitizeData({ settings: { theme: 'sakura' } }).settings.theme).toBe('sakura');
    expect(sanitizeData({ settings: { theme: 'chartreuse' } }).settings.theme).toBe('system');
  });
});

describe('バックアップの読み込み', () => {
  function SettingsHarness() {
    const body = useBodyData();
    return <SettingsView body={body} section="general" onOpen={() => {}} onToast={() => {}} />;
  }

  async function choose(json: unknown) {
    const file = new File([JSON.stringify(json)], 'backup.json', { type: 'application/json' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    // 読み込みは非同期。選ばせる面の中身が出るまで待つ（見出しは開く前から DOM にある）
    await screen.findByRole('button', { name: 'いまの記録に足す' });
  }

  const backup = {
    version: 2,
    settings: {},
    entries: { '2026-03-01': { am: { weight: 70, bodyFat: 20 } } },
    exercises: [],
    workouts: {},
  };

  it('置き換えかマージかを、キャンセルとは別に選ばせる', async () => {
    render(<SettingsHarness />);
    await choose(backup);

    // confirm の [キャンセル] にマージを割り当てない。3 つとも別のボタンにする
    expect(screen.getByRole('button', { name: 'いまの記録に足す' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'いまの記録を置き換える' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'やめる' })).toBeTruthy();
  });

  it('取り込んでも、いまのプリセットと部位別の目標を消さない', async () => {
    // 取り込み側でキーを書き忘れると、sanitizeData が渡されなかったキーを空にしてしまう
    seedData(['ex_bench'], {});
    const stored = JSON.parse(localStorage.getItem('bodymake.data.v1')!);
    stored.presets = [{ id: 'p1', name: '押す日', exerciseIds: ['ex_bench'] }];
    stored.groupGoals = { chest: 12 };
    localStorage.setItem('bodymake.data.v1', JSON.stringify(stored));

    render(<SettingsHarness />);
    await choose(backup);
    fireEvent.click(screen.getByRole('button', { name: 'いまの記録に足す' }));

    const after = JSON.parse(localStorage.getItem('bodymake.data.v1')!);
    expect(after.presets).toHaveLength(1);
    expect(after.groupGoals.chest).toBe(12);
    expect(after.entries['2026-03-01']).toBeDefined();
  });

  it('バックアップのプリセットと部位別の目標を戻せる', async () => {
    render(<SettingsHarness />);
    await choose({
      ...backup,
      exercises: [{ id: 'ex_bench', name: 'ベンチプレス', group: 'chest' }],
      presets: [{ id: 'p1', name: '押す日', exerciseIds: ['ex_bench'] }],
      groupGoals: { chest: 15 },
    });

    // 何が入っているかを、取り込む前に読ませる
    expect(screen.getByText(/プリセット 1件/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'いまの記録に足す' }));
    const after = JSON.parse(localStorage.getItem('bodymake.data.v1')!);
    expect(after.presets[0].name).toBe('押す日');
    expect(after.groupGoals.chest).toBe(15);
  });

  it('やめるを押したら、何も取り込まない', async () => {
    render(<SettingsHarness />);
    await choose(backup);

    fireEvent.click(screen.getByRole('button', { name: 'やめる' }));
    expect(screen.queryByText('バックアップから読み込む')).toBeNull();

    const stored = JSON.parse(localStorage.getItem('bodymake.data.v1') ?? '{"entries":{}}');
    expect(Object.keys(stored.entries ?? {})).toHaveLength(0);
  });

  it('足すを押したら取り込む', async () => {
    render(<SettingsHarness />);
    await choose(backup);

    fireEvent.click(screen.getByRole('button', { name: 'いまの記録に足す' }));
    const stored = JSON.parse(localStorage.getItem('bodymake.data.v1')!);
    expect(stored.entries['2026-03-01']).toBeDefined();
  });
});

describe('実績バッジ', () => {
  it('体組成とトレーニングで分かれ、混ざらない', async () => {
    const { computeBadges } = await import('../lib/badges');
    const { computeTrainingStats, buildSessions } = await import('../lib/training');
    const { computeStats, buildDaily, buildWeeks } = await import('../lib/derive');
    const { DEFAULT_SETTINGS } = await import('../lib/storage');

    const daily = buildDaily({});
    const stats = computeStats(daily, buildWeeks(daily), DEFAULT_SETTINGS);
    const badges = computeBadges(stats, computeTrainingStats(buildSessions({}, [], [])));

    // ホームは切り替えに従って出し分けるので、どちらの側かを必ず持つ
    expect(badges.every((b) => b.domain === 'body' || b.domain === 'training')).toBe(true);
    // どちらの側も同じ数だけ用意する（片側だけ埋まらないと、切り替えが痩せて見える）
    expect(badges.filter((b) => b.domain === 'training')).toHaveLength(30);
    expect(badges.filter((b) => b.domain === 'body')).toHaveLength(30);

    // 段階は「はじめの1回」から始める。始めたばかりでも次に届くものがある
    const first = badges.find((b) => b.id === 'train-1');
    expect(first).toBeTruthy();
  });

  it('押すと獲得の条件が読める（title はスマホで出ない）', async () => {
    const { computeBadges } = await import('../lib/badges');
    const { computeTrainingStats, buildSessions } = await import('../lib/training');
    const { computeStats, buildDaily, buildWeeks } = await import('../lib/derive');
    const { DEFAULT_SETTINGS } = await import('../lib/storage');

    const daily = buildDaily({});
    const stats = computeStats(daily, buildWeeks(daily), DEFAULT_SETTINGS);
    const badges = computeBadges(stats, computeTrainingStats(buildSessions({}, [], [])));

    render(<BadgeGrid badges={badges.filter((b) => b.domain === 'body')} />);
    expect(screen.getByText(/バッジを押すと/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '質の高い減量の条件' }));
    expect(screen.getByText(/除脂肪体重の減少が0.5kg以内/)).toBeTruthy();

    // 段階のあるバッジは、いまの値と条件も出す
    fireEvent.click(screen.getByRole('button', { name: '3日連続の条件' }));
    expect(screen.getByText('いま 0 / 3')).toBeTruthy();
  });

  it('「次の目標」は出さない（並び順が同じことを言っている）', async () => {
    const { computeBadges } = await import('../lib/badges');
    const { computeTrainingStats, buildSessions } = await import('../lib/training');
    const { computeStats, buildDaily, buildWeeks } = await import('../lib/derive');
    const { DEFAULT_SETTINGS } = await import('../lib/storage');

    const daily = buildDaily({});
    const stats = computeStats(daily, buildWeeks(daily), DEFAULT_SETTINGS);
    const badges = computeBadges(stats, computeTrainingStats(buildSessions({}, [], [])));

    render(<BadgeGrid badges={badges.filter((b) => b.domain === 'training')} />);
    expect(screen.queryByText('次の目標')).toBeNull();
  });
});

describe('ダイアログの戻り方', () => {
  it('面を差し替えているあいだは、右上が「‹ 戻る」になる', () => {
    seedExercises('ex_bench');

    function Harness() {
      const body = useBodyData();
      const [date] = useState(todayISO);
      return <TrainingView body={body} date={date} />;
    }

    render(<Harness />);
    openPicker();

    // 種目を選ぶ面では「閉じる」（ここで閉じれば記録画面に戻るだけ）
    expect(screen.getByRole('button', { name: '閉じる' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /マイ種目を増やす/ }));
    expect(screen.getByText(/^カタログから追加/)).toBeTruthy();

    // カタログの面では「‹ 戻る」。閉じるとダイアログごと消えて、選ぶ作業まで失われる
    expect(screen.queryByRole('button', { name: '閉じる' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '‹ 戻る' }));
    expect(screen.getByRole('button', { name: '閉じる' })).toBeTruthy();
  });
});

describe('初期データ（シード）', () => {
  it('デモ向けビルドでなければ投入しない', async () => {
    const { loadData } = await import('../lib/storage');

    // 投入済みフラグごと消して、初回起動と同じ状態にする
    localStorage.clear();
    expect(Object.keys(loadData().entries)).toHaveLength(0);

    // 自分の記録として使う側に他人の数字を入れない。フラグも立てない
    expect(localStorage.getItem('bodymake.seeded.v1')).toBeNull();
  });
});

describe('カタログの整合性', () => {
  it('種目 ID から器具を引ける（自作種目は分からない）', async () => {
    const { catalogEquipment } = await import('../lib/exerciseCatalog');

    expect(catalogEquipment('ex_lat_pulldown')).toBeUndefined(); // マシンは器具を書かない
    expect(catalogEquipment('ex_bench')).toBe('barbell'); // 器具を選べる種目の既定
    expect(catalogEquipment('ex_crunch')).toBe('bodyweight');
    expect(catalogEquipment('ex_one_arm_row')).toBe('dumbbell');
    // 器具を選べる種目は接尾辞から決まる
    expect(catalogEquipment('ex_lunge')).toBe('barbell');
    expect(catalogEquipment('ex_lunge_db')).toBe('dumbbell');
    expect(catalogEquipment('ex_lunge_bw')).toBe('bodyweight');
    expect(catalogEquipment(crypto.randomUUID())).toBeUndefined();
  });

  it('自重の種目が 6 部位すべてに揃っている', async () => {
    const { CATALOG, GROUP_ORDER } = await import('../lib/exerciseCatalog');

    // 器具が無い人がカタログを開いたとき、選べない部位があると献立が組めない
    const missing = GROUP_ORDER.filter(
      (group) => !CATALOG.some((c) => c.equipment === 'bodyweight' && c.group === group),
    );
    expect(missing).toEqual([]);
  });

  it('ID と名前が重複せず、補助部位の設定も値域に収まっている', async () => {
    const { CATALOG, SUB_GROUP_WEIGHT_RANGE } = await import('../lib/exerciseCatalog');

    // ID は過去ログの参照先。重複すると別種目の記録が混ざる
    const ids = CATALOG.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    const names = CATALOG.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);

    for (const entry of CATALOG) {
      for (const sub of entry.subGroups ?? []) {
        const [group, weight] = Array.isArray(sub) ? sub : [sub, 0.5];
        // 主部位と同じ部位を補助にも入れると二重に数えてしまう
        expect(group).not.toBe(entry.group);
        expect(weight).toBeGreaterThanOrEqual(SUB_GROUP_WEIGHT_RANGE[0]);
        expect(weight).toBeLessThanOrEqual(SUB_GROUP_WEIGHT_RANGE[1]);
      }
      // 体重係数を持つのは自重で行う種目だけ。自重を選べる種目（ランジなど）も含む
      const usesBodyweight =
        entry.loadMode === 'bodyweight' || (entry.implements?.includes('bodyweight') ?? false);
      expect(entry.bodyweightFactor != null).toBe(usesBodyweight);
    }
  });

  it('絞り込みは器具だけで決まり、どの行もちょうど1つに入る', async () => {
    const { CATALOG } = await import('../lib/exerciseCatalog');

    // 画面と同じく、器具を選べる種目は器具ごとの行に展開してから判定する。
    // 種目単位で見ると「すべて」で片方しか出せなかった不具合を拾えない
    const choices = CATALOG.flatMap((entry) =>
      entry.implements
        ? entry.implements.map((implement) => ({ entry, implement }))
        : [{ entry, implement: 'barbell' as const }],
    );

    // loadMode は重量の換算方法であって器具ではないので、判定に混ぜない
    for (const { entry, implement } of choices) {
      const buckets = [
        entry.implements ? implement === 'barbell' : entry.equipment == null,
        entry.implements ? implement === 'dumbbell' : entry.equipment === 'dumbbell',
        entry.implements ? implement === 'bodyweight' : entry.equipment === 'bodyweight',
      ].filter(Boolean).length;
      expect(buckets).toBe(1);
    }

    // ワンハンドロウは片手ずつ持つので standard だが、器具はダンベル
    expect(CATALOG.find((c) => c.id === 'ex_one_arm_row')!.equipment).toBe('dumbbell');
    // クランチは体重を挙上量に足さないので standard だが、器具は要らない
    expect(CATALOG.find((c) => c.id === 'ex_crunch')!.equipment).toBe('bodyweight');
  });

  it('器具を選べる種目は、ダンベル版が必ず左右1つずつ持つ動作になる', async () => {
    const { CATALOG, fromCatalog } = await import('../lib/exerciseCatalog');

    // implements に dumbbell を入れると、その版は無条件で perSide（2倍で計上）になる。
    // プリーチャーカールのように片手ずつ持つ種目に付けると、挙上量が倍になってしまう
    for (const entry of CATALOG.filter((c) => c.implements?.includes('dumbbell'))) {
      expect(fromCatalog(entry, 0, 'dumbbell').loadMode).toBe('perSide');
      expect(fromCatalog(entry, 0, 'barbell').loadMode).toBe(entry.loadMode);
    }

    // 自重版は体重を係数ぶん乗せる。加重版には係数を残さない（効かない値が設定に出る）
    for (const entry of CATALOG.filter((c) => c.implements?.includes('bodyweight'))) {
      const bw = fromCatalog(entry, 0, 'bodyweight');
      expect(bw.loadMode).toBe('bodyweight');
      expect(bw.bodyweightFactor).toBe(entry.bodyweightFactor);
      expect(fromCatalog(entry, 0, 'barbell').bodyweightFactor).toBeNull();
      // ID は器具ごとに分ける。同じ 1 種目に混ぜると体重とバーベルが同じ線に並ぶ
      expect(bw.id).toBe(`${entry.id}_bw`);
    }
    expect(CATALOG.find((c) => c.id === 'ex_preacher_curl')!.implements).toBeUndefined();
  });

  it('補助部位は表示順に並べる', async () => {
    const { CATALOG, GROUP_ORDER } = await import('../lib/exerciseCatalog');
    for (const entry of CATALOG) {
      const groups = (entry.subGroups ?? []).map((sub) => (Array.isArray(sub) ? sub[0] : sub));
      const indexes = groups.map((g) => GROUP_ORDER.indexOf(g));
      expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
    }
  });
});

describe('バーベル／ダンベルの切り替え', () => {
  it('器具ごとに別の種目として登録され、ダンベルは2倍で計上される', async () => {
    const { CATALOG, fromCatalog, catalogId } = await import('../lib/exerciseCatalog');
    const bench = CATALOG.find((c) => c.id === 'ex_bench')!;
    expect(bench.implements).toEqual(['barbell', 'dumbbell']);

    const bb = fromCatalog(bench, 0, 'barbell');
    const db = fromCatalog(bench, 1, 'dumbbell');

    // 同じ 1 種目に混ぜない。混ぜるとバーベル100kgとダンベル35kgが同じ線に並ぶ
    expect(bb.id).not.toBe(db.id);
    expect(bb.name).toBe('ベンチプレス（バーベル）');
    expect(db.name).toBe('ベンチプレス（ダンベル）');
    expect(bb.loadMode).toBe('standard');
    expect(db.loadMode).toBe('perSide');
    expect(catalogId(bench, 'dumbbell')).toBe('ex_bench_db');
  });

  it('器具が決まっている種目には選択肢を出さない', async () => {
    const { CATALOG } = await import('../lib/exerciseCatalog');
    const byId = (id: string) => CATALOG.find((c) => c.id === id)!;

    // マシン・自重・ダンベル固有・器具を替えると別動作になるもの
    expect(byId('ex_lat_pulldown').implements).toBeUndefined();
    expect(byId('ex_pullup').implements).toBeUndefined();
    expect(byId('ex_lateral_raise').implements).toBeUndefined();
    expect(byId('ex_squat').implements).toBeUndefined();
    expect(byId('ex_deadlift').implements).toBeUndefined();
  });
});

describe('種目の削除', () => {
  it('記録がある種目は、消える日数を伝えてから消す', async () => {
    const { ExerciseManager } = await import('../components/training/ExerciseManager');
    const bench = fromCatalog(
      CATALOG.find((c) => c.id === 'ex_bench')!,
      0,
    );
    const onRemove = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(
      <ExerciseManager
        exercises={[bench]}
        sessions={[]}
        usage={new Map([[bench.id, 12]])}
        onAdd={() => {}}
        onUpdate={() => {}}
        onRemove={onRemove}
      />,
    );

    fireEvent.click(screen.getByLabelText('ベンチプレス（バーベル）を削除'));
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('12日ぶんも一緒に消えます'));
    expect(onRemove).not.toHaveBeenCalled(); // キャンセルしたので消えない
    confirmSpy.mockRestore();
  });
});

describe('ホームの部位別の配分', () => {
  function HomeHarness() {
    const body = useBodyData();
    return (
      <HomeView body={body} domain="training" onOpenRecords={() => {}} onOpenTrend={() => {}} />
    );
  }

  function seedWeek() {
    seedData(['ex_bench', 'ex_lateral_raise'], {
      '2026-03-01': [{ exerciseId: 'ex_bench', sets: [{ weight: 60, reps: 10 }] }],
      '2026-03-08': [
        { exerciseId: 'ex_bench', sets: [{ weight: 65, reps: 8 }] },
        { exerciseId: 'ex_lateral_raise', sets: [{ weight: 10, reps: 15 }] },
      ],
    });
  }

  it('週ごとの部位別の数字と実施日数を出す', () => {
    seedWeek();
    render(<HomeHarness />);

    const card = within(screen.getByText('部位別の配分').closest('section')!);
    expect(card.getByText('実施日数')).toBeTruthy();
    expect(card.getByRole('button', { name: 'セット数', pressed: true })).toBeTruthy();

    fireEvent.click(card.getByRole('button', { name: '挙上量' }));
    // 3/8 のベンチは 65×8 = 520 kg。補助部位（肩・腕）には半分の 260 kg が入る
    // 肩はさらにサイドレイズ 20×15 = 300 kg が乗って 560 kg
    expect(card.getAllByText('520').length).toBe(1);
    expect(card.getAllByText('260').length).toBe(1);
    expect(card.getAllByText('560').length).toBe(1);
  });

  it('推移はダイアログで開き、値の選択は表と連動する', () => {
    seedWeek();
    render(<HomeHarness />);
    expect(dialogOpen()).toBe(false);

    const card = within(screen.getByText('部位別の配分').closest('section')!);
    fireEvent.click(card.getByRole('button', { name: '挙上量' }));
    fireEvent.click(card.getByRole('button', { name: '推移をグラフで見る' }));
    expect(dialogOpen()).toBe(true);

    // 表で挙上量を選んでいたら、線も挙上量から始まる
    const dialog = within(document.querySelector('dialog')!);
    expect(dialog.getByRole('button', { name: '挙上量', pressed: true })).toBeTruthy();

    // ダイアログ側で戻すと表にも効く
    fireEvent.click(dialog.getByRole('button', { name: 'セット数' }));
    expect(card.getByRole('button', { name: 'セット数', pressed: true })).toBeTruthy();
  });

  it('今週の部位別セット数のカードは持たない', () => {
    seedWeek();
    render(<HomeHarness />);
    // 部位別の配分に置き換えた。同じ数字を 2 か所で見せない
    expect(screen.queryByText('今週の部位別セット数')).toBeNull();
  });
});

describe('目標画面', () => {
  function GoalsHarness({ domain = 'body' as Domain }) {
    const body = useBodyData();
    return <GoalsView body={body} domain={domain} />;
  }

  it('目標体重は目標画面の中で決められる（設定タブへ飛ばさない）', () => {
    render(<GoalsHarness />);
    expect(screen.getByText(/目標体重を決めると/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '目標を決める' }));
    fireEvent.change(screen.getByLabelText(/目標体重/), { target: { value: '70' } });
    expect((screen.getByLabelText(/目標体重/) as HTMLInputElement).value).toBe('70');

    // 目標は入ったが体重の記録がまだ無い、という状態を正直に出す
    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));
    expect(screen.getByText(/体重を記録すると/)).toBeTruthy();
  });

  it('身長と目標日も同じ面に置く（BMI と目標体重は同じ話題）', () => {
    render(<GoalsHarness />);
    fireEvent.click(screen.getByRole('button', { name: '目標を決める' }));
    expect(screen.getByLabelText(/身長/)).toBeTruthy();
    expect(screen.getByLabelText(/目標日/)).toBeTruthy();
  });

  it('目安のチップは、開いている部位にだけ効く', () => {
    render(<GoalsHarness domain="training" />);

    // 一覧には出さない。決めるのは部位を開いた先
    expect(screen.queryByRole('button', { name: '標準 12' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '胸の目標' }));
    // 決めるのは 1 段先の面。表示部と押す場所を分ける
    fireEvent.click(screen.getByRole('button', { name: '部位目標を設定' }));
    fireEvent.click(screen.getByRole('button', { name: '標準 12' }));
    expect((screen.getByLabelText('胸') as HTMLInputElement).value).toBe('12');

    // 打つ前の目安。そのあと手で変えられる
    fireEvent.change(screen.getByLabelText('胸'), { target: { value: '6' } });
    fireEvent.blur(screen.getByLabelText('胸'));
    // 深い面では右上が「‹ 戻る」。閉じるとダイアログごと消えて元の面まで失われる
    fireEvent.click(screen.getByRole('button', { name: '‹ 戻る' }));
    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));

    // ほかの部位は動かさない（1 か所を開いているのに 6 か所が変わると驚く）
    expect(screen.getByText('0 / 6 セット')).toBeTruthy();
    // 目標を決めていない部位は、数値の横に「目標なし」と書く（一覧にバーは置かない）
    expect(screen.getAllByText('0 セット（目標なし）')).toHaveLength(5);

    fireEvent.click(screen.getByRole('button', { name: '胸の目標' }));
    fireEvent.click(screen.getByRole('button', { name: '部位目標を設定' }));
    fireEvent.click(screen.getByRole('button', { name: '決めない' }));
    fireEvent.click(screen.getByRole('button', { name: '‹ 戻る' }));
    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));
    expect(screen.getAllByText('0 セット（目標なし）')).toHaveLength(6);
  });

  it('種目の目標は目標画面で決め、その場から推移も見られる', () => {
    seedData(['ex_bench'], {
      '2026-03-01': [{ exerciseId: 'ex_bench', sets: [{ weight: 60, reps: 10 }] }],
    });

    function Harness() {
      const body = useBodyData();
      return <GoalsView body={body} domain="training" />;
    }

    render(<Harness />);

    // 決めるのも見るのも、その部位を開いた先で完結する
    fireEvent.click(screen.getByRole('button', { name: '胸の目標' }));
    expect(screen.getByText(/この部位の種目には、まだ目標がありません/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '＋ 種目の目標を追加' }));
    fireEvent.click(screen.getByRole('button', { name: /^ベンチプレス/ }));
    fireEvent.change(screen.getByLabelText(/ベンチプレス.*の目標$/), { target: { value: '100' } });

    // その部位の目標として、同じダイアログの中に並ぶ。数字にはラベルを付ける
    expect(screen.getByText('目標 100.0 kg')).toBeTruthy();
    // カードの事実と、決めるときの材料の両方に「いま」が出る
    expect(screen.getAllByText(/^いま /).length).toBeGreaterThan(0);
    // 到達率が出せないときも、何の値が出ていないのかは書く（記録が 3 セッション未満）
    expect(screen.getByText('到達率 —')).toBeTruthy();

    /*
     * 入口はマイ種目と同じ並び。開くときはカードの中で展開せず、
     * 同じダイアログの面を差し替える（展開すると下の種目が押し下げられる）
     */
    fireEvent.click(screen.getByRole('button', { name: /ベンチプレス.*の設定/ }));
    expect(screen.getByText('補助的に使う部位')).toBeTruthy();
    const dlg = () => within(document.querySelector('dialog')!);
    expect(dlg().queryByText('今週のセット数')).toBeNull();

    // 深い面では、右上が「閉じる」ではなく「‹ 戻る」になる（閉じるとダイアログごと消えてしまう）
    fireEvent.click(screen.getByRole('button', { name: '‹ 戻る' }));
    expect(dlg().getByText('今週のセット数')).toBeTruthy();

    // 推移は重ねて出す。画面ごと移ると、閉じたときに開いていた部位へ戻れない
    fireEvent.click(screen.getByRole('button', { name: /ベンチプレス.*の推移を見る/ }));
    expect(screen.getByText('元データ')).toBeTruthy();

    // 閉じると、開いていた部位の面がそのまま残っている
    const trend = [...document.querySelectorAll('dialog')].find((d) =>
      d.textContent?.includes('元データ'),
    )!;
    fireEvent.click(within(trend).getByRole('button', { name: '閉じる' }));
    expect(screen.queryByText('元データ')).toBeNull();
    expect(dlg().getByText('今週のセット数')).toBeTruthy();
  });

  it('部位の行に、今週のセット数と種目の目標が名前つきで並ぶ', async () => {
    const { todayISO } = await import('../lib/date');
    seedData(['ex_bench'], {
      [todayISO()]: [
        {
          exerciseId: 'ex_bench',
          sets: [
            { weight: 60, reps: 10 },
            { weight: 60, reps: 10 },
          ],
        },
      ],
    });

    function Harness() {
      const body = useBodyData();
      return <GoalsView body={body} domain="training" />;
    }
    render(<Harness />);

    // 同じ行に、その部位の量と種目の状態がそろう（2 枚のカードを往復しない）
    // ベンチは補助部位（肩・腕）にも積むので、前回の日はその 3 部位が今日になる
    expect(screen.getByRole('button', { name: '胸の目標' }).textContent).toContain('2 セット');
    // 「0日空き」は余裕があるようにも読めるので、いつやったかをそのまま書く
    expect(screen.getAllByText('前回 今日')).toHaveLength(3);

    // **時間軸の違うものは名前で見分けられるようにする。**
    // 今週のセット数は日曜に 0 へ戻り、種目の目標は週をまたいで積み上がる
    const chestRow = screen.getByRole('button', { name: '胸の目標' });
    expect(chestRow.textContent).toContain('今週のセット数');
    expect(chestRow.textContent).toContain('種目の目標');
    // 目標を決めていない種目しかない部位は「未設定」（0/0 到達 とは書かない）
    expect(chestRow.textContent).toContain('未設定');
    // **一覧にゲージは置かない。**幅 0 のバーは、決めていないのか壊れているのか読めない
    expect(chestRow.querySelector('[class*="meterFill"]')).toBeNull();

    // ゲージは決める場所（部位のダイアログ）にだけ置く
    fireEvent.click(screen.getByRole('button', { name: '胸の目標' }));
    // 決めるのは 1 段先の面。表示部と押す場所を分ける
    fireEvent.click(screen.getByRole('button', { name: '部位目標を設定' }));
    fireEvent.click(screen.getByRole('button', { name: '標準 12' }));
    expect((document.querySelector('dialog [class*="meterFill"]') as HTMLElement).style.width).toBe(
      `${(2 / 12) * 100}%`,
    );
    fireEvent.click(screen.getByRole('button', { name: '‹ 戻る' }));

    fireEvent.click(screen.getByRole('button', { name: '＋ 種目の目標を追加' }));
    fireEvent.click(screen.getByRole('button', { name: /^ベンチプレス/ }));
    fireEvent.change(screen.getByLabelText(/ベンチプレス.*の目標$/), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));

    expect(screen.getByText('0 / 1 到達')).toBeTruthy();
  });

  it('週が替わって今週が 0 のときは、先週を添えて壊れていないことを示す', () => {
    const today = todayISO();
    const thisStart = isoAdd(today, -new Date(`${today}T12:00:00`).getDay());
    // 先週やって、今週はまだ 0
    seedData(['ex_bench'], {
      [isoAdd(thisStart, -3)]: [{ exerciseId: 'ex_bench', sets: [{ weight: 60, reps: 10 }] }],
    });

    function Harness() {
      const body = useBodyData();
      return <GoalsView body={body} domain="training" />;
    }
    render(<Harness />);

    const chest = screen.getByRole('button', { name: '胸の目標' });
    expect(chest.textContent).toContain('0 セット');
    expect(chest.textContent).toContain('先週 1');
  });
});

describe('プリセット（種目の組み合わせ）', () => {
  /** 日を指定して記録画面を出す。プリセットは日をまたいで使うもの */
  function DayHarness({ day }: { day: string }) {
    const body = useBodyData();
    const [date] = useState(day);
    return <TrainingView body={body} date={date} />;
  }

  function addTwo() {
    openPicker();
    fireEvent.click(screen.getByText(/^＋ ベンチプレス/));
    fireEvent.click(screen.getByText(/^＋ 懸垂/));
    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));
  }

  /** カードから、いまの組み合わせを保存する */
  function save(name: string) {
    fireEvent.click(screen.getByRole('button', { name: 'いまの組み合わせをプリセットに保存' }));
    fireEvent.change(screen.getByLabelText('プリセットの名前'), { target: { value: name } });
    fireEvent.click(screen.getByRole('button', { name: 'この名前で保存' }));
  }

  it('カードの中身が、その日の状態で入れ替わる', () => {
    seedExercises('ex_bench', 'ex_pullup');
    render(<Harness />);

    // まだ何も入れていない日は、呼び出す場所（1 件も無ければその案内）
    expect(screen.getByRole('heading', { name: 'プリセット' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'いまの組み合わせをプリセットに保存' })).toBeNull();

    // 種目を入れると、同じ場所が保存する場所になる
    addTwo();
    expect(screen.getByRole('heading', { name: 'プリセット' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'いまの組み合わせをプリセットに保存' })).toBeTruthy();

    // 保存済みの組み合わせなら、することが無いのでカードごと出さない
    save('押す日');
    expect(screen.queryByRole('heading', { name: 'プリセット' })).toBeNull();
  });

  it('カードで保存し、別の日にカードから呼び出せる', () => {
    seedExercises('ex_bench', 'ex_pullup', 'ex_squat');
    render(<Harness />);
    addTwo();

    // 名前の下書きは部位から作る。書き換えてもいい
    fireEvent.click(screen.getByRole('button', { name: 'いまの組み合わせをプリセットに保存' }));
    expect((screen.getByLabelText('プリセットの名前') as HTMLInputElement).value).toBe(
      '胸・背中の日',
    );
    fireEvent.change(screen.getByLabelText('プリセットの名前'), { target: { value: '押す日' } });
    fireEvent.click(screen.getByRole('button', { name: 'この名前で保存' }));
    cleanup();

    // 別の日に、同じ組み合わせを呼び出す
    render(<DayHarness day={isoAdd(todayISO(), -1)} />);
    expect(document.querySelectorAll('[id^="ex-card-"]')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: '押す日をこの日に入れる' }));
    expect(document.querySelectorAll('[id^="ex-card-"]')).toHaveLength(2);
  });

  it('同じ名前で保存すると、確認してから中身を上書きする', () => {
    seedExercises('ex_bench', 'ex_pullup', 'ex_squat');
    render(<Harness />);
    addTwo();
    save('押す日');
    cleanup();

    // 別の日に、違う組み合わせを同じ名前で保存しようとする
    render(<DayHarness day={isoAdd(todayISO(), -1)} />);
    openPicker();
    fireEvent.click(screen.getByText(/^＋ スクワット/));
    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(screen.getByRole('button', { name: 'いまの組み合わせをプリセットに保存' }));
    fireEvent.change(screen.getByLabelText('プリセットの名前'), { target: { value: '押す日' } });
    fireEvent.click(screen.getByRole('button', { name: 'この名前で保存' }));

    // 消えるのは前の中身なので、先に伝える。断ったら何も変わらない
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('上書き'));
    let stored = JSON.parse(localStorage.getItem('bodymake.data.v1')!);
    expect(stored.presets).toHaveLength(1);
    expect(stored.presets[0].exerciseIds).toEqual(['ex_bench', 'ex_pullup']);

    confirmSpy.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'この名前で保存' }));

    // 同じ名前が 2 つ並ばず、中身だけが入れ替わる
    stored = JSON.parse(localStorage.getItem('bodymake.data.v1')!);
    expect(stored.presets).toHaveLength(1);
    expect(stored.presets[0].name).toBe('押す日');
    expect(stored.presets[0].exerciseIds).toEqual(['ex_squat']);
    confirmSpy.mockRestore();
  });

  it('削除は確認してから消す', () => {
    seedExercises('ex_bench', 'ex_pullup');
    render(<Harness />);
    addTwo();
    save('押す日');
    cleanup();

    render(<DayHarness day={isoAdd(todayISO(), -1)} />);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    // 記録は消えないが、付けた名前と組み合わせは戻せない
    fireEvent.click(screen.getByRole('button', { name: '押す日を削除' }));
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('元に戻せません'));
    expect(screen.getByText('押す日')).toBeTruthy();

    confirmSpy.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: '押す日を削除' }));
    expect(screen.queryByText('押す日')).toBeNull();
    confirmSpy.mockRestore();
  });

  it('入るのは種目だけ。重量と回数は持たない', () => {
    seedExercises('ex_bench');
    render(<Harness />);

    openPicker();
    fireEvent.click(screen.getByText(/^＋ ベンチプレス/));
    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));
    typeSet(setRows()[0]!, '60', '10');

    // 値を打ってから保存しても、持つのは種目だけ
    save('押す日');

    const stored = JSON.parse(localStorage.getItem('bodymake.data.v1')!);
    expect(stored.presets).toHaveLength(1);
    // ID は UUID なので中身を見ない（"60" を含むことがある）。持ち物そのものを見る
    const { id, ...preset } = stored.presets[0];
    expect(typeof id).toBe('string');
    expect(preset).toEqual({ name: '押す日', exerciseIds: ['ex_bench'] });
  });

  it('消した種目は組み合わせから抜け、空になった組み合わせは残さない', async () => {
    const { sanitizeData } = await import('../lib/storage');
    const bench = fromCatalog(
      CATALOG.find((c) => c.id === 'ex_bench')!,
      0,
    );

    const data = sanitizeData({
      exercises: [bench],
      presets: [
        { id: 'p1', name: '押す日', exerciseIds: [bench.id, 'ex_gone'] },
        { id: 'p2', name: '引く日', exerciseIds: ['ex_gone'] },
        { id: 'p3', name: '', exerciseIds: [bench.id] },
      ],
    });

    expect(data.presets).toHaveLength(1);
    expect(data.presets[0]).toEqual({ id: 'p1', name: '押す日', exerciseIds: [bench.id] });
  });

  it('プリセットはバックアップに含まれて往復する', async () => {
    const { sanitizeData } = await import('../lib/storage');
    const bench = fromCatalog(
      CATALOG.find((c) => c.id === 'ex_bench')!,
      0,
    );
    const original = sanitizeData({
      exercises: [bench],
      presets: [{ id: 'p1', name: '押す日', exerciseIds: [bench.id] }],
    });
    const roundTripped = sanitizeData(JSON.parse(JSON.stringify(original)));
    expect(roundTripped.presets).toEqual(original.presets);
  });
});

describe('レビュー（記録画面）', () => {
  /**
   * その日に置いた種目と、前の日の実績をまとめて用意する。
   * レビューは**既定で無効**なので、明示的に有効にしてから確かめる
   */
  function seedChecks(ids: string[], workouts: Record<string, unknown>) {
    seedData(ids, workouts, {}, { enabled: true });
  }

  const setsOf = (n: number) => Array.from({ length: n }, () => ({ weight: 60, reps: 5 }));

  it('有効にしていなければ、何も出さない（既定は無効）', () => {
    const today = todayISO();
    // seedChecks と違い checks を渡さない ＝ 既定のまま
    seedData(['ex_deadlift', 'ex_squat', 'ex_rdl'], {
      [today]: [
        { exerciseId: 'ex_deadlift', sets: setsOf(1) },
        { exerciseId: 'ex_squat', sets: setsOf(1) },
        { exerciseId: 'ex_rdl', sets: setsOf(1) },
      ],
    });
    render(<Harness />);
    expect(screen.queryByText('レビュー')).toBeNull();
    expect(screen.queryByText(/見積もり時間/)).toBeNull();
    // 回復はレビューとは別の機能なので、有効化に関係なく出る
    expect(screen.getByLabelText('回復の状態を見る')).toBeTruthy();
  });

  it('種目が無い日はカードごと出ない', () => {
    seedExercises('ex_deadlift');
    render(<Harness />);
    expect(screen.queryByText('レビュー')).toBeNull();
  });

  it('種目を置くと、今日の負荷・前日までの疲れ・見積もり時間が出る', () => {
    const today = todayISO();
    seedChecks(['ex_deadlift'], { [today]: [{ exerciseId: 'ex_deadlift', sets: setsOf(3) }] });
    render(<Harness />);

    // 見積もり時間は常に出す。3 セット × 4.5 分（デッドリフトはカタログで上書きされている）
    expect(screen.getByText(/見積もり時間 13\.5分/)).toBeTruthy();

    // 警告が無ければカードごと出さない。枠だけが毎日あると読み飛ばされる
    expect(screen.queryByText('レビュー')).toBeNull();
    // 負担のゲージも内訳も置かない
    expect(screen.queryByText('1日の腰椎への負担')).toBeNull();
  });

  it('指摘が出るとカードが現れ、消せば また隠れる', () => {
    const today = todayISO();
    seedChecks(['ex_deadlift', 'ex_squat'], {
      [isoAdd(today, -1)]: [{ exerciseId: 'ex_deadlift', sets: setsOf(3) }],
      [today]: [{ exerciseId: 'ex_squat', sets: setsOf(3) }],
    });
    render(<Harness />);

    expect(screen.getByText('レビュー')).toBeTruthy();
    expect(screen.getByText('1件')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('軸荷重種目が連日になっていますを許容済みにする'));
    expect(screen.queryByText('レビュー')).toBeNull();
    // 時間は指摘と無関係に残る
    expect(screen.getByText(/見積もり時間/)).toBeTruthy();
  });

  it('値を打つ前でも、並べた時点で検算できる', () => {
    const today = todayISO();
    // セット行はあるが値は空。実績としては数えないが、設計としては置かれている
    seedChecks(['ex_deadlift', 'ex_squat'], {
      [isoAdd(today, -1)]: [{ exerciseId: 'ex_deadlift', sets: setsOf(3) }],
      [today]: [{ exerciseId: 'ex_squat', sets: [{ weight: null, reps: null }] }],
    });
    render(<Harness />);
    expect(screen.getByText('軸荷重種目が連日になっています')).toBeTruthy();
  });

  it('過去の日は「やった事実」だけを数える（並べただけの日は数えない）', () => {
    const today = todayISO();
    seedChecks(['ex_deadlift'], {
      [isoAdd(today, -1)]: [{ exerciseId: 'ex_deadlift', sets: [{ weight: null, reps: null }] }],
      [today]: [{ exerciseId: 'ex_deadlift', sets: setsOf(3) }],
    });
    render(<Harness />);
    expect(screen.queryByText('軸荷重種目が連日になっています')).toBeNull();
  });
});

describe('プリセット（設定から見る・編集する）', () => {
  function PresetHarness() {
    const body = useBodyData();
    return (
      <PresetManager
        presets={body.data.presets}
        exercises={body.data.exercises}
        onCreate={body.savePreset}
        onUpdate={body.updatePreset}
        onRemove={body.removePreset}
        onAddExercises={body.addExercises}
      />
    );
  }

  /** 記録画面を経由せずに、プリセットを持った状態から始める */
  function seedPresets(...presets: { id: string; name: string; exerciseIds: string[] }[]) {
    const ids = ['ex_bench', 'ex_pullup', 'ex_squat'];
    const exercises = ids.map((id, i) =>
      fromCatalog(
        CATALOG.find((c) => c.id === id)!,
        i,
      ),
    );
    localStorage.setItem(
      'bodymake.data.v1',
      JSON.stringify({
        version: 2,
        settings: {},
        entries: {},
        exercises,
        workouts: {},
        presets,
      }),
    );
  }

  it('空から新しいプリセットを作れる', () => {
    seedPresets();
    render(<PresetHarness />);
    expect(screen.getByText(/まだプリセットがありません/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '＋ プリセットを作る' }));
    fireEvent.change(screen.getByLabelText('新しいプリセットの名前'), {
      target: { value: '押す日' },
    });

    // 名前だけでは作れない（種目 0 件のプリセットは持てない）
    expect(
      (screen.getByRole('button', { name: 'このプリセットを作る' }) as HTMLButtonElement).disabled,
    ).toBe(true);

    fireEvent.click(screen.getByText('＋ ベンチプレス（バーベル）'));
    fireEvent.click(screen.getByText('＋ スクワット'));
    fireEvent.click(screen.getByRole('button', { name: 'このプリセットを作る' }));

    const stored = JSON.parse(localStorage.getItem('bodymake.data.v1')!);
    expect(stored.presets).toHaveLength(1);
    expect(stored.presets[0].name).toBe('押す日');
    // 足した順がそのまま並び（＝呼び出したときのカードの順）になる
    expect(stored.presets[0].exerciseIds).toEqual(['ex_bench', 'ex_squat']);
  });

  it('すでにある名前では作れない（この画面では上書きしない）', () => {
    seedPresets({ id: 'p1', name: '押す日', exerciseIds: ['ex_bench'] });
    render(<PresetHarness />);

    fireEvent.click(screen.getByRole('button', { name: '＋ プリセットを作る' }));
    fireEvent.click(screen.getByText('＋ スクワット'));
    const field = screen.getByLabelText('新しいプリセットの名前');

    // 直したい相手が一覧に見えているので、上書きではなく決定させない
    fireEvent.change(field, { target: { value: '押す日' } });
    expect(
      (screen.getByRole('button', { name: 'このプリセットを作る' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(screen.getByText('同じ名前のプリセットがあります。')).toBeTruthy();

    fireEvent.change(field, { target: { value: '脚の日' } });
    fireEvent.click(screen.getByRole('button', { name: 'このプリセットを作る' }));

    const stored = JSON.parse(localStorage.getItem('bodymake.data.v1')!);
    expect(stored.presets.map((p: { name: string }) => p.name)).toEqual(['押す日', '脚の日']);
  });

  it('種目を選ぶ面はダイアログで出し、選んでも位置が動かない', () => {
    seedPresets();
    render(<PresetHarness />);

    fireEvent.click(screen.getByRole('button', { name: '＋ プリセットを作る' }));
    const dialog = () => within(document.querySelector('dialog')!);

    // 入っている種目も ✓ で残す。消すと後ろが詰まって、押す場所が動く
    fireEvent.click(dialog().getByText(/^＋ ベンチプレス/));
    expect(dialog().getByText(/^✓ ベンチプレス/)).toBeTruthy();

    // 最後の 1 つを外すのは削除と同じ意味なので、ここでは受け付けない
    expect(
      dialog()
        .getByText(/^✓ ベンチプレス/)
        .closest('button')!.disabled,
    ).toBe(true);

    fireEvent.click(dialog().getByText(/^＋ スクワット/));
    expect(
      dialog()
        .getByText(/^✓ ベンチプレス/)
        .closest('button')!.disabled,
    ).toBe(false);
  });

  it('作りながら、カタログからマイ種目を増やせる', () => {
    seedPresets();
    render(<PresetHarness />);

    fireEvent.click(screen.getByRole('button', { name: '＋ プリセットを作る' }));
    fireEvent.change(screen.getByLabelText('新しいプリセットの名前'), {
      target: { value: '押す日' },
    });

    // マイ種目に無い種目を入れたくなったとき、ここで行き止まらせない
    // （作りかけは画面を離れると消えるので、マイ種目の画面へ往復させられない）
    expect(screen.queryByText('＋ ディップス')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '＋ マイ種目を増やす' }));

    // ダイアログは重ねず、同じ面を差し替える。戻ると元の選ぶ面に戻る
    fireEvent.click(screen.getByText('＋ ディップス'));
    fireEvent.click(screen.getByRole('button', { name: '‹ 戻る' }));

    // 増えた種目はそのまま一覧に出る。プリセットに入れるのは選んでから
    fireEvent.click(screen.getByText('＋ ディップス'));
    fireEvent.click(screen.getByRole('button', { name: 'このプリセットを作る' }));

    const stored = JSON.parse(localStorage.getItem('bodymake.data.v1')!);
    expect(stored.presets[0].exerciseIds).toEqual(['ex_dips']);
    expect(stored.exercises.map((e: { id: string }) => e.id)).toContain('ex_dips');
  });

  it('作りかけでも並びを入れ替えられる（作ったあとと同じ操作）', () => {
    seedPresets();
    render(<PresetHarness />);

    fireEvent.click(screen.getByRole('button', { name: '＋ プリセットを作る' }));
    fireEvent.change(screen.getByLabelText('新しいプリセットの名前'), {
      target: { value: '押す日' },
    });
    fireEvent.click(screen.getByText('＋ ベンチプレス（バーベル）'));
    fireEvent.click(screen.getByText('＋ スクワット'));

    // 足した順は ベンチ → スクワット。保存する前に入れ替えられる
    fireEvent.click(screen.getByRole('button', { name: '新しいプリセットのスクワットを移動' }));
    fireEvent.click(screen.getByRole('button', { name: 'スクワットを先頭へ' }));
    fireEvent.click(screen.getByRole('button', { name: 'このプリセットを作る' }));

    const stored = JSON.parse(localStorage.getItem('bodymake.data.v1')!);
    expect(stored.presets[0].exerciseIds).toEqual(['ex_squat', 'ex_bench']);
  });

  it('一覧と中身の種目まで見られる', () => {
    seedPresets({ id: 'p1', name: '押す日', exerciseIds: ['ex_bench', 'ex_pullup'] });
    render(<PresetHarness />);

    expect(screen.getByText('押す日')).toBeTruthy();
    expect(screen.getByText('胸・背中')).toBeTruthy();
    expect(screen.getByText('2種目')).toBeTruthy();
    // 名前と部位だけでは、どの種目が入っているかまでは思い出せない
    expect(screen.getByText('ベンチプレス（バーベル）')).toBeTruthy();
    expect(screen.getByText('懸垂')).toBeTruthy();
  });

  it('名前を変えられる。すでにある名前には変えられない', () => {
    seedPresets(
      { id: 'p1', name: '押す日', exerciseIds: ['ex_bench'] },
      { id: 'p2', name: '引く日', exerciseIds: ['ex_pullup'] },
    );
    render(<PresetHarness />);

    fireEvent.click(screen.getByRole('button', { name: '押す日の名前を変更' }));
    const field = screen.getByLabelText('押す日の新しい名前') as HTMLInputElement;

    // 同名を 2 つ作らせない（同じ名前で保存したときの行き先が決まらなくなる）
    fireEvent.change(field, { target: { value: '引く日' } });
    expect(
      (screen.getByRole('button', { name: 'この名前にする' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(screen.getByText('同じ名前のプリセットがあります。')).toBeTruthy();

    fireEvent.change(field, { target: { value: '胸の日' } });
    fireEvent.click(screen.getByRole('button', { name: 'この名前にする' }));
    expect(screen.getByText('胸の日')).toBeTruthy();
    expect(screen.queryByText('押す日')).toBeNull();
  });

  it('中身の種目を出し入れできる', () => {
    seedPresets({ id: 'p1', name: '押す日', exerciseIds: ['ex_bench'] });
    render(<PresetHarness />);

    fireEvent.click(screen.getByRole('button', { name: '押す日に種目を足す' }));
    fireEvent.click(screen.getByText('＋ スクワット'));
    expect(screen.getByText('2種目')).toBeTruthy();
    expect(screen.getByText('スクワット')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '押す日からスクワットを外す' }));
    expect(screen.getByText('1種目')).toBeTruthy();
    expect(screen.queryByText('スクワット')).toBeNull();
  });

  it('中の並びを、掴んで置き場所をタップで変えられる', () => {
    seedPresets({ id: 'p1', name: '押す日', exerciseIds: ['ex_bench', 'ex_pullup', 'ex_squat'] });
    render(<PresetHarness />);

    fireEvent.click(screen.getByRole('button', { name: '押す日のスクワットを移動' }));

    // 置き場所は「いまと違う並びになる位置」だけ。押しても何も起きないボタンを置かない
    // （末尾と「懸垂の後ろ」は、どちらもいまの位置）
    expect(screen.getAllByText('ここへ')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'スクワットを先頭へ' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'スクワットをベンチプレス（バーベル）の後ろへ' }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'スクワットを先頭へ' }));

    // 呼び出したときのカードの順になるので、並びはそのまま保存する
    const stored = JSON.parse(localStorage.getItem('bodymake.data.v1')!);
    expect(stored.presets[0].exerciseIds).toEqual(['ex_squat', 'ex_bench', 'ex_pullup']);
    // 置いたら掴んだ状態は解ける
    expect(screen.queryByText('ここへ')).toBeNull();
  });

  it('移動中は置き場所を選ぶこと以外を出さず、やめれば元のまま', () => {
    seedPresets({ id: 'p1', name: '押す日', exerciseIds: ['ex_bench', 'ex_pullup', 'ex_squat'] });
    render(<PresetHarness />);

    fireEvent.click(screen.getByRole('button', { name: '押す日の懸垂を移動' }));
    expect(screen.getByText('懸垂 を移動中')).toBeTruthy();
    // 外す・足す・他の種目を掴む、はこの間しまう（狙いを外して消してしまわない）
    expect(screen.queryByRole('button', { name: /を外す$/ })).toBeNull();
    expect(screen.queryByRole('button', { name: '押す日に種目を足す' })).toBeNull();
    expect(screen.queryByRole('button', { name: '押す日のスクワットを移動' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '移動をやめる' }));
    expect(screen.queryByText('ここへ')).toBeNull();
    expect(screen.getByRole('button', { name: '押す日に種目を足す' })).toBeTruthy();
    const stored = JSON.parse(localStorage.getItem('bodymake.data.v1')!);
    expect(stored.presets[0].exerciseIds).toEqual(['ex_bench', 'ex_pullup', 'ex_squat']);
  });

  it('最後の 1 種目を外すのは、プリセットごとの削除として確認する', () => {
    seedPresets({ id: 'p1', name: '押す日', exerciseIds: ['ex_bench'] });
    render(<PresetHarness />);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    // 種目 0 件のプリセットは持てない。空にすることは消すことと同じ
    fireEvent.click(
      screen.getByRole('button', { name: '押す日からベンチプレス（バーベル）を外す' }),
    );
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('ごと削除'));
    expect(screen.getByText('押す日')).toBeTruthy();

    confirmSpy.mockReturnValue(true);
    fireEvent.click(
      screen.getByRole('button', { name: '押す日からベンチプレス（バーベル）を外す' }),
    );
    expect(screen.queryByText('押す日')).toBeNull();
    expect(screen.getByText(/まだプリセットがありません/)).toBeTruthy();
    confirmSpy.mockRestore();
  });
});

describe('日付ナビ', () => {
  it('今日を見ているときは「今日」ボタンを出さず、先へも進めない', () => {
    render(<DateNav date={todayISO()} onChange={() => {}} />);
    expect(screen.queryByRole('button', { name: '今日' })).toBeNull();
    expect((screen.getByLabelText('次の日') as HTMLButtonElement).disabled).toBe(true);
  });

  it('過去を見ているときだけ「今日」で戻れる', async () => {
    const { addDays } = await import('../lib/date');
    const onChange = vi.fn();
    render(<DateNav date={addDays(todayISO(), -3)} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: '今日' }));
    expect(onChange).toHaveBeenCalledWith(todayISO());
  });
});

describe('画面の位置（タブと下位画面）', () => {
  beforeEach(() => {
    window.location.hash = '';
    // jsdom はスクロールを実装していない。位置を URL に載せる筋道だけを見る
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  });

  it('タブは ホーム / 目標 / 記録 / 設定 の 4 つ', () => {
    render(<App />);
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'ホーム',
      '目標',
      '記録',
      '設定',
    ]);
  });

  it('グラフの古い URL は推移へ寄せる', () => {
    window.location.hash = '#charts';
    render(<App />);

    expect(screen.getByRole('heading', { name: '体組成の推移' })).toBeTruthy();
    // 履歴は積まない。戻るで #charts に戻らないようにする
    expect(window.location.hash).toBe('#home/trend');
  });

  it('推移の見出しは体組成／トレーニングの切り替えに従う', () => {
    window.location.hash = '#home/trend';
    render(<App />);
    expect(screen.getByRole('heading', { name: '体組成の推移' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'トレーニング' }));
    expect(screen.getByRole('heading', { name: 'トレーニングの推移' })).toBeTruthy();
  });

  it('ホームの入口から推移へ入り、遷移元へ戻る', () => {
    seedData([], {}, { '2026-03-07': { am: { weight: 70, bodyFat: 20 } } });
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /体重・体脂肪率の推移/ }));

    expect(window.location.hash).toBe('#home/trend');
    expect(screen.getByRole('button', { name: '戻る' }).textContent).toContain('BodyMake');
  });

  it('記録タブのヘッダが日付ナビになる', () => {
    render(<App />);
    expect(screen.queryByLabelText('記録する日付')).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: '記録' }));
    expect(window.location.hash).toBe('#records');
    expect(screen.getByLabelText('記録する日付')).toBeTruthy();
  });

  it('マイ種目の目標は、マイ種目のまま決められる', () => {
    seedExercises('ex_bench');
    render(<App />);

    fireEvent.click(screen.getByRole('tab', { name: '設定' }));
    fireEvent.click(screen.getByText('トレーニング'));
    fireEvent.click(screen.getByText('マイ種目'));

    // 目標タブへ連れて行かない。見ていた画面のまま、ダイアログで決める
    fireEvent.click(screen.getByRole('button', { name: /ベンチプレス.*の目標を決める/ }));
    expect(window.location.hash).toBe('#settings/training/exercises');
    expect(screen.getByText(/ベンチプレス.*の目標$/)).toBeTruthy(); // ダイアログの見出し
    expect(screen.getByLabelText(/ベンチプレス.*の目標$/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/ベンチプレス.*の目標$/), { target: { value: '100' } });
    expect(screen.getByText('重量↑')).toBeTruthy();
    expect(screen.getByText('目標 100kg')).toBeTruthy();

    // 閉じると一覧に戻る（行の中で展開しない）
    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));
    expect(screen.queryByLabelText(/ベンチプレス.*の目標$/)).toBeNull();
  });

  it('目標タブも体組成／トレーニングの切り替えに従う', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: '目標' }));
    expect(window.location.hash).toBe('#goals');
    expect(screen.getByText(/目標体重を決めると/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'トレーニング' }));
    expect(screen.getByText('トレーニングの目標')).toBeTruthy();
  });
});

describe('モーダル', () => {
  it('開いている間は背面をスクロールさせない', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    seedExercises('ex_bench');
    render(<Harness />);
    expect(document.body.style.position).toBe('');

    // showModal が止めるのは操作だけで、外をなぞると地のほうが動く
    openPicker();
    expect(document.body.style.position).toBe('fixed');

    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));
    expect(document.body.style.position).toBe('');
  });

  it('開いたまま外されても、地の固定が残らない', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    render(<Harness />);
    openPicker();
    // 種目が無いときのカタログは、開いているときだけ置く形
    fireEvent.click(screen.getByRole('button', { name: '＋ マイ種目に追加' }));
    expect(document.body.style.position).toBe('fixed');

    cleanup();
    expect(document.body.style.position).toBe('');
  });
});

describe('種目の目標を決める', () => {
  function GoalsHarness() {
    const body = useBodyData();
    return <GoalsView body={body} domain="training" />;
  }

  /** 部位を開いてから、その部位の種目に目標を足す（決める場所は部位の中） */
  function openEditor(group = '胸', exercise = /^ベンチプレス/) {
    fireEvent.click(screen.getByRole('button', { name: `${group}の目標` }));
    fireEvent.click(screen.getByRole('button', { name: '＋ 種目の目標を追加' }));
    fireEvent.click(screen.getByRole('button', { name: exercise }));
  }

  it('種類は 1 タップで切り替わり、単位もそれに従う', () => {
    seedExercises('ex_bench');
    render(<GoalsHarness />);
    openEditor();

    const type = within(screen.getByRole('group', { name: /ベンチプレス.*の目標の種類/ }));
    expect(type.getByRole('button', { name: '重量', pressed: true })).toBeTruthy();

    fireEvent.click(type.getByRole('button', { name: '回数' }));
    expect(type.getByRole('button', { name: '回数', pressed: true })).toBeTruthy();
    expect(screen.getByText('回')).toBeTruthy();
    expect(screen.getByText(/最大レップ数で判定/)).toBeTruthy();
  });

  it('決める材料として「いま」と「過去最大」を添える（値は入れない）', () => {
    seedData(['ex_bench'], {
      '2026-03-01': [{ exerciseId: 'ex_bench', sets: [{ weight: 65, reps: 8 }] }],
      '2026-03-08': [{ exerciseId: 'ex_bench', sets: [{ weight: 60, reps: 10 }] }],
    });
    render(<GoalsHarness />);
    openEditor();

    // いまは直近の 60、過去最大は 65。目標そのものは空のまま
    expect(screen.getByText('60.0 kg')).toBeTruthy();
    expect(screen.getByText('65.0 kg')).toBeTruthy();
    expect((screen.getByLabelText(/ベンチプレス.*の目標$/) as HTMLInputElement).value).toBe('');
  });

  it('立て方を選べる（維持 / 重量 / 挙上量 / 回数）', () => {
    seedExercises('ex_bench');
    render(<GoalsHarness />);
    openEditor();

    const types = within(screen.getByRole('group', { name: /ベンチプレス.*の目標の種類/ }));
    ['維持', '重量', '挙上量', '回数'].forEach((label) =>
      expect(types.getByRole('button', { name: label })).toBeTruthy(),
    );

    // 維持は数値を持たない。選んだ時点で目標として成立する
    fireEvent.click(types.getByRole('button', { name: '維持' }));
    expect(screen.queryByLabelText(/ベンチプレス.*の目標$/)).toBeNull();

    const stored = JSON.parse(localStorage.getItem('bodymake.data.v1')!);
    expect(stored.exercises[0].goal).toEqual({ type: 'maintain', value: null });

    // 挙上量に切り替えると、また数値を決める形に戻る
    fireEvent.click(types.getByRole('button', { name: '挙上量' }));
    expect(screen.getByLabelText(/ベンチプレス.*の目標$/)).toBeTruthy();
    expect(screen.getByText(/総挙上量（有効重量 × レップ数の合計）/)).toBeTruthy();
  });

  it('秒で数える種目には、重量の目標を出さない', () => {
    seedExercises('ex_plank');
    render(<GoalsHarness />);
    openEditor('体幹', /^プランク/);

    // 重量を記録できない種目に、届きようのない目標を出さない
    const types = within(screen.getByRole('group', { name: /プランクの目標の種類/ }));
    expect(types.queryByRole('button', { name: '重量' })).toBeNull();
    expect(types.queryByRole('button', { name: '挙上量' })).toBeNull();
    expect(types.getByRole('button', { name: '秒数' })).toBeTruthy();
    expect(types.getByRole('button', { name: '維持' })).toBeTruthy();
    expect(screen.getByText('秒')).toBeTruthy();
    expect(screen.getByText(/最大レップ数で判定/)).toBeTruthy();
  });

  it('記録が無ければ、その事実だけを出す', () => {
    seedExercises('ex_bench');
    render(<GoalsHarness />);
    openEditor();
    expect(screen.getByText('この種目の記録はまだありません。')).toBeTruthy();
  });

  it('欄を空にしても目標は消えない（外すのは「目標を外す」だけ）', () => {
    seedExercises('ex_bench');
    render(<GoalsHarness />);
    openEditor();

    const field = () => screen.getByLabelText(/ベンチプレス.*の目標$/) as HTMLInputElement;
    fireEvent.change(field(), { target: { value: '100' } });
    expect(screen.getByRole('button', { name: '目標を外す' })).toBeTruthy();

    // 打ち直すために一度消しただけで、目標ごと落とさない
    fireEvent.change(field(), { target: { value: '' } });
    expect(screen.getByRole('button', { name: '目標を外す' })).toBeTruthy();
    // フォーカスを外せば、確定済みの値に戻る
    fireEvent.blur(field());
    expect(field().value).toBe('100');

    fireEvent.click(screen.getByRole('button', { name: '目標を外す' }));
    expect(screen.queryByRole('button', { name: '目標を外す' })).toBeNull();
  });
});

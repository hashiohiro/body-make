// @vitest-environment jsdom
import { useState } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExerciseManager } from '../components/training/ExerciseManager';
import { ChartsView } from './ChartsView';
import { RecordsView } from './RecordsView';
import { SETTINGS_SECTIONS, SettingsView, settingsSectionTitle } from './SettingsView';
import { TrainingView } from './TrainingView';
import { useBodyData } from '../hooks/useBodyData';
import { useTheme } from '../hooks/useTheme';
import { todayISO } from '../lib/date';
import { CATALOG, fromCatalog } from '../lib/exerciseCatalog';
import type { ThemePref } from '../types';

/**
 * 導出の正しさは training.test.ts が見ている。ここで見るのは結線
 * （種目を足す → セットを打つ → 集計が出る → 消える）が繋がっているか。
 */
function Harness() {
  const body = useBodyData();
  const [date, setDate] = useState(todayISO);
  return <TrainingView body={body} date={date} onDateChange={setDate} />;
}

/** 種目マスタは設定タブにあるので、画面を触らず localStorage に用意する */
function seedExercises(...ids: string[]) {
  seedData(ids, {});
}

function seedData(ids: string[], workouts: Record<string, unknown>) {
  const exercises = ids.map((id, i) =>
    fromCatalog(
      CATALOG.find((c) => c.id === id)!,
      i,
    ),
  );
  localStorage.setItem(
    'bodymake.data.v1',
    JSON.stringify({ version: 2, settings: {}, entries: {}, exercises, workouts }),
  );
}

/** i 番目のセット行の重量・回数を入れる */
function typeSet(row: HTMLElement, weight: string, reps: string) {
  fireEvent.change(within(row).getByLabelText(/重量$/), { target: { value: weight } });
  fireEvent.change(within(row).getByLabelText(/回数$/), { target: { value: reps } });
}

/** 種目を選ぶモーダルが開いているか。中身は閉じていても DOM に残る */
function pickerOpen(): boolean {
  return document.querySelector('dialog')?.hasAttribute('open') ?? false;
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
  it('種目が 1 つも無いときは、種目管理へ誘導する', () => {
    render(<Harness />);
    expect(screen.getByText(/設定 > トレーニング から追加/)).toBeTruthy();
  });

  it('カタログから追加 → 記録 → 集計 が繋がる', () => {
    seedExercises('ex_bench');
    render(<Harness />);

    fireEvent.click(screen.getByText('＋ 種目を追加'));
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

  it('記録一覧は日付・部位・種目数を出し、タップで種目ごとの内訳を開く', () => {
    seedExercises('ex_bench');
    render(<Harness />);
    fireEvent.click(screen.getByText('＋ 種目を追加'));
    fireEvent.click(screen.getByText(/^＋ ベンチプレス/));
    typeSet(setRows()[0]!, '60', '10');

    // 一覧行: 部位と種目数だけ。種目をまたいだ合計は出さない
    const row = screen.getByRole('button', { expanded: false });
    // 1 セットでは肩と腕は 0.5 セット相当にしかならないので、部位としては出さない
    expect(within(row).getByText('胸')).toBeTruthy();
    expect(within(row).getByText('1種目')).toBeTruthy();

    // 3 セットまで積むと肩と腕も 1 セット相当を超える
    fireEvent.click(screen.getByText('＋ セットを追加'));
    typeSet(setRows()[1]!, '60', '10');
    fireEvent.click(screen.getByText('＋ セットを追加'));
    typeSet(setRows()[2]!, '60', '10');
    expect(
      within(screen.getByRole('button', { expanded: false })).getByText('胸・肩・腕'),
    ).toBeTruthy();

    fireEvent.click(row);
    const table = screen.getByRole('table');
    expect(within(table).getByText(/ベンチプレス/)).toBeTruthy();
    expect(within(table).getByText('1,800 kg')).toBeTruthy();
  });

  it('書いたセットはすべて挙上量に数える（ウォームアップの区別を持たない）', () => {
    seedExercises('ex_squat');
    render(<Harness />);
    fireEvent.click(screen.getByText('＋ 種目を追加'));
    fireEvent.click(screen.getByText('＋ スクワット'));

    typeSet(setRows()[0]!, '60', '5');
    fireEvent.click(screen.getByText('＋ セットを追加'));
    typeSet(setRows()[1]!, '100', '5');

    // 60×5 + 100×5 = 800 kg。軽い側を勝手に外したりしない
    expect(screen.getAllByText(/800 kg/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/ウォームアップ/)).toBeNull();
  });

  it('セットを全部消すと、その種目がその日から消える', () => {
    seedExercises('ex_bench');
    render(<Harness />);
    fireEvent.click(screen.getByText('＋ 種目を追加'));
    fireEvent.click(screen.getByText(/^＋ ベンチプレス/));

    typeSet(setRows()[0]!, '60', '10');
    fireEvent.click(screen.getByLabelText('1セット目を削除'));

    expect(screen.queryByLabelText(/1セット目の重量/)).toBeNull();
    expect(screen.getByText(/の記録はまだありません/)).toBeTruthy();
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
    fireEvent.click(screen.getByText('＋ 種目を追加'));
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

  it('同じ種目は 1 日に 2 つ作られない', () => {
    seedExercises('ex_bench');
    render(<Harness />);
    fireEvent.click(screen.getByText('＋ 種目を追加'));
    fireEvent.click(screen.getByText(/^＋ ベンチプレス/));

    // 続けて選べるように開いたまま。すでにある種目は ✓ 付きで出て、押しても増えない
    fireEvent.click(screen.getByText(/✓ ベンチプレス/));

    expect(document.querySelectorAll('[id^="ex-card-"]')).toHaveLength(1);
    // ✓ を押したときだけ「そのカードへ行く」操作なので閉じる
    expect(pickerOpen()).toBe(false);
  });

  it('種目は続けて複数選べる', () => {
    seedExercises('ex_bench', 'ex_squat', 'ex_curl');
    render(<Harness />);
    fireEvent.click(screen.getByText('＋ 種目を追加'));

    // 1 つ選ぶたびに閉じると、種目数ぶん開き直すことになる
    fireEvent.click(screen.getByText(/^＋ ベンチプレス/));
    fireEvent.click(screen.getByText(/^＋ スクワット/));
    fireEvent.click(screen.getByText(/^＋ カール/));

    expect(document.querySelectorAll('[id^="ex-card-"]')).toHaveLength(3);
    // 追加してもカードに押し出されないよう、モーダルのまま開いている
    expect(pickerOpen()).toBe(true);
  });

  it('± ボタンを置かない（1 行の幅を数値に回すため）', () => {
    seedExercises('ex_bench');
    render(<Harness />);
    fireEvent.click(screen.getByText('＋ 種目を追加'));
    fireEvent.click(screen.getByText(/^＋ ベンチプレス/));

    expect(screen.queryByLabelText(/を増やす$/)).toBeNull();
    expect(screen.queryByLabelText(/を減らす$/)).toBeNull();
  });

  it('W ボタンを置かない（記録するかどうかは書くかどうかで決まる）', () => {
    seedExercises('ex_bench');
    render(<Harness />);
    fireEvent.click(screen.getByText('＋ 種目を追加'));
    fireEvent.click(screen.getByText(/^＋ ベンチプレス/));

    expect(screen.queryByTitle(/ウォームアップ/)).toBeNull();
    expect(screen.queryByText('W')).toBeNull();
  });
});

describe('種目管理（設定タブ）', () => {
  function ManagerHarness() {
    const body = useBodyData();
    return (
      <ExerciseManager
        exercises={body.data.exercises}
        usage={new Map()}
        onAdd={body.addExercises}
        onUpdate={body.upsertExercise}
        onRemove={body.removeExercise}
        onMove={body.moveExercise}
      />
    );
  }

  it('初期状態は空で、追加したぶんだけ増える', () => {
    render(<ManagerHarness />);
    expect(screen.getByText(/^0件 \/ 目標/)).toBeTruthy();
    expect(screen.getByText(/まだ種目がありません/)).toBeTruthy();

    fireEvent.click(screen.getByText('＋ 種目を追加'));
    // 器具を選べる種目は、バーベル版とダンベル版が別の行として並ぶ
    fireEvent.click(screen.getByText('＋ ベンチプレス（バーベル）'));
    expect(screen.getByText(/^1件 \/ 目標/)).toBeTruthy();
    fireEvent.click(screen.getByText('＋ ベンチプレス（ダンベル）'));
    expect(screen.getByText(/^2件 \/ 目標/)).toBeTruthy();
  });

  it('カタログを器具と部位の2軸で絞り込める', () => {
    render(<ManagerHarness />);
    fireEvent.click(screen.getByText('＋ 種目を追加'));
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
    fireEvent.click(within(screen.getByRole('group', { name: '部位' })).getByText('腕'));
    expect(screen.getByText('この絞り込みに合う種目はありません。')).toBeTruthy();
  });

  it('主部位を補助部位と同じ部位に変えたら、補助から落とす', () => {
    render(<ManagerHarness />);
    fireEvent.click(screen.getByText('＋ 種目を追加'));
    fireEvent.click(screen.getByText('＋ ベンチプレス（バーベル）'));
    fireEvent.click(screen.getByText('閉じる'));

    const row = screen.getByText('ベンチプレス（バーベル）').closest('div')!;
    expect(within(row).getByText('胸·肩·腕')).toBeTruthy();

    fireEvent.click(screen.getByText('設定'));
    fireEvent.click(screen.getByText('詳細設定'));
    // 補助部位に肩を持ったまま主部位を肩にすると、肩を二重に数えてしまう
    fireEvent.change(screen.getByLabelText('部位'), { target: { value: 'shoulders' } });

    expect(screen.getByText('肩·腕')).toBeTruthy();
    expect(screen.queryByText('肩·肩·腕')).toBeNull();
  });

  it('記録の無い種目は確認せずに削除する', () => {
    render(<ManagerHarness />);
    fireEvent.click(screen.getByText('＋ 種目を追加'));
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
  function SettingsHarness({ section }: { section: string | null }) {
    const body = useBodyData();
    const [current, setCurrent] = useState<string | null>(section);
    return <SettingsView body={body} section={current} onOpen={setCurrent} onToast={() => {}} />;
  }

  it('カテゴリ一覧から選ぶと、その設定だけが出る', () => {
    render(<SettingsHarness section={null} />);

    // 一覧の時点では中身のフォームは出ていない
    expect(screen.queryByLabelText('目標体重')).toBeNull();
    SETTINGS_SECTIONS.forEach((sec) => expect(screen.getByText(sec.label)).toBeTruthy());

    fireEvent.click(screen.getByText('体組成'));
    // 目標と身長が同じ画面にまとまる
    expect(screen.getByLabelText(/目標体重/)).toBeTruthy();
    expect(screen.getByLabelText(/身長/)).toBeTruthy();
    // 他カテゴリの中身は同居しない
    expect(screen.queryByLabelText('テーマ')).toBeNull();
  });

  it('トレーニングは種目の追加と目標を1つの一覧で扱う', () => {
    seedExercises('ex_bench');
    render(<SettingsHarness section="training" />);

    expect(screen.getByText('＋ 種目を追加')).toBeTruthy();
    // 目標は行の「設定」ボタンを開いてから入力する
    expect(screen.queryByLabelText(/ベンチプレス.*の目標の種類/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '設定' }));
    expect(screen.getByLabelText(/ベンチプレス.*の目標の種類/)).toBeTruthy();
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
  });
});

describe('記録タブ', () => {
  function RecordsHarness() {
    const body = useBodyData();
    const [date, setDate] = useState(todayISO);
    return <RecordsView body={body} date={date} onDateChange={setDate} />;
  }

  it('体重とトレーニングを同じタブの中で切り替えられる', () => {
    render(<RecordsHarness />);
    // 既定は体組成側

    expect(screen.getByRole('heading', { name: '体組成' })).toBeTruthy();

    // どちらの側にも記録一覧があるので、入力カードの見出しで区別する
    fireEvent.click(screen.getByRole('button', { name: 'トレーニング' }));
    expect(screen.queryByRole('heading', { name: '体組成' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'トレーニング' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '体組成' }));
    expect(screen.getByRole('heading', { name: '体組成' })).toBeTruthy();
  });
});

describe('グラフタブ', () => {
  function ChartsHarness() {
    const body = useBodyData();
    return <ChartsView body={body} />;
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

  it('体組成とトレーニングを切り替えられる', () => {
    seedTraining();
    render(<ChartsHarness />);
    expect(screen.getByText('体重の推移')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'トレーニング' }));
    expect(screen.queryByText('体重の推移')).toBeNull();
    expect(screen.getByText('種目別の推移')).toBeTruthy();
  });

  it('記録のある種目だけを選べて、指標を切り替えられる', () => {
    seedTraining();
    render(<ChartsHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'トレーニング' }));

    // 「挙上量」は部位別の配分カードにもあるので、推移カードの中で探す
    const card = within(screen.getByText('種目別の推移').closest('section')!);

    // 一覧には記録のある種目だけが並び、既定は記録数の多いベンチプレス
    expect(card.getByRole('button', { name: /ベンチプレス/, pressed: true })).toBeTruthy();
    expect(card.getByRole('button', { name: /サイドレイズ/, pressed: false })).toBeTruthy();
    expect(card.queryByRole('button', { name: /スクワット/ })).toBeNull();
    expect(card.getByRole('button', { name: '挙上量', pressed: true })).toBeTruthy();

    // 一覧から直接切り替えられる（開く・閉じるが要らない）
    fireEvent.click(card.getByRole('button', { name: /サイドレイズ/ }));
    expect(card.getByRole('button', { name: /サイドレイズ/, pressed: true })).toBeTruthy();

    fireEvent.click(card.getByRole('button', { name: '推定1RM' }));
    expect(card.getByRole('button', { name: '推定1RM', pressed: true })).toBeTruthy();
    // レップ数に依存しない最大重量も選べる
    expect(card.getByRole('button', { name: '最大重量' })).toBeTruthy();
  });

  it('種目別の推移を部位で絞れる', () => {
    seedTraining();
    render(<ChartsHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'トレーニング' }));

    const card = within(screen.getByText('種目別の推移').closest('section')!);
    expect(card.getByRole('button', { name: /ベンチプレス/ })).toBeTruthy();
    expect(card.getByRole('button', { name: /サイドレイズ/ })).toBeTruthy();

    // 補助部位は拾わない（腕にベンチプレスが並ぶと、種目の推移として読めない）
    fireEvent.click(within(card.getByRole('group', { name: '部位' })).getByText('肩'));
    expect(card.queryByRole('button', { name: /ベンチプレス/ })).toBeNull();
    // 絞り込みで選択中の種目が消えたら、残っているほうへ移る
    expect(card.getByRole('button', { name: /サイドレイズ/, pressed: true })).toBeTruthy();

    fireEvent.click(within(card.getByRole('group', { name: '部位' })).getByText('すべて'));
    expect(card.getByRole('button', { name: /ベンチプレス/ })).toBeTruthy();
  });

  it('部位別の配分はセット数と挙上量を切り替えられ、実施日数も出す', () => {
    seedTraining();
    render(<ChartsHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'トレーニング' }));

    const card = within(screen.getByText('部位別の配分').closest('section')!);
    expect(card.getByText('実施日数')).toBeTruthy();
    expect(card.getByRole('button', { name: 'セット数', pressed: true })).toBeTruthy();

    fireEvent.click(card.getByRole('button', { name: '挙上量' }));
    expect(card.getByRole('button', { name: '挙上量', pressed: true })).toBeTruthy();
    // 3/8 のベンチは 65×8 = 520 kg。補助部位（肩・腕）には半分の 260 kg が入る
    // 肩はさらにサイドレイズ 20×15 = 300 kg が乗って 560 kg
    expect(card.getAllByText('520').length).toBe(1);
    expect(card.getAllByText('260').length).toBe(1);
    expect(card.getAllByText('560').length).toBe(1);
  });

  it('秒で数える種目しか無ければ、重量の指標そのものを出さない', () => {
    seedData(['ex_plank'], {
      '2026-03-08': [{ exerciseId: 'ex_plank', sets: [{ weight: null, reps: 60 }] }],
    });
    render(<ChartsHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'トレーニング' }));

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
    fireEvent.click(screen.getByRole('button', { name: 'トレーニング' }));

    const card = within(screen.getByText('種目別の推移').closest('section')!);
    expect(card.getByRole('button', { name: '挙上量', pressed: true })).toBeTruthy();
    fireEvent.click(card.getByRole('button', { name: /プランク/ }));
    expect(card.getByText('秒で数える種目なので、この指標は出せません')).toBeTruthy();
  });

  it('記録が無ければ空状態を出す', () => {
    seedExercises('ex_bench');
    render(<ChartsHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'トレーニング' }));
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

describe('カタログの整合性', () => {
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
      // 自重種目だけが体重係数を持つ
      expect(entry.bodyweightFactor != null).toBe(entry.loadMode === 'bodyweight');
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
        entry.equipment === 'bodyweight',
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

    // implements を付けると、ダンベル版は無条件で perSide（2倍で計上）になる。
    // プリーチャーカールのように片手ずつ持つ種目に付けると、挙上量が倍になってしまう
    for (const entry of CATALOG.filter((c) => c.implements != null)) {
      expect(fromCatalog(entry, 0, 'dumbbell').loadMode).toBe('perSide');
      expect(fromCatalog(entry, 0, 'barbell').loadMode).toBe(entry.loadMode);
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
        usage={new Map([[bench.id, 12]])}
        onAdd={() => {}}
        onUpdate={() => {}}
        onRemove={onRemove}
        onMove={() => {}}
      />,
    );

    fireEvent.click(screen.getByLabelText('ベンチプレス（バーベル）を削除'));
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('12日ぶんも一緒に消えます'));
    expect(onRemove).not.toHaveBeenCalled(); // キャンセルしたので消えない
    confirmSpy.mockRestore();
  });
});

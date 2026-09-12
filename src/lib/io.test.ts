// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { readImportFile } from './io';
import { emptyData } from './storage';
import type { AppData } from '../types';

/*
 * 書き出し → 読み込みの往復。**ここが唯一の復元経路。**
 *
 * 記録は端末のブラウザにしか無く、バックアップは JSON の書き出しだけ。
 * つまり**往復で落ちた項目は、その人にとって失われたのと同じ**。
 * 版を上げたときに `sanitizeData` が新しい項目を拾い忘れても、
 * 書き出しは JSON.stringify なのでファイルには入っていて、気づけない。
 * `AppData` の全項目を埋めて、戻ることを 1 本で押さえる。
 */
function fullData(): AppData {
  const base = emptyData();
  return {
    ...base,
    settings: { ...base.settings, targetWeight: 68, heightCm: 172, theme: 'indigo-night' },
    // 保存する形は 1 日 = 朝 / 夕の 2 枠で、入れていない枠も null で持つ
    entries: {
      '2026-03-10': {
        am: { weight: 70.2, bodyFat: 18.4 },
        pm: { weight: null, bodyFat: null },
      },
    },
    exercises: [
      {
        id: 'ex_bench',
        name: 'ベンチプレス',
        group: 'chest',
        subGroups: [{ group: 'arms', weight: 0.25 }],
        loadMode: 'standard',
        repUnit: 'reps',
        bodyweightFactor: null,
        rmDivisor: 40,
        goal: { type: 'weight', value: 100 },
        order: 0,
        shelf: 'listed',
        axial: false,
        minutesPerSet: 2.5,
        repeated: true,
      },
    ],
    workouts: {
      '2026-03-10': [{ exerciseId: 'ex_bench', sets: [{ weight: 60, reps: 10 }] }],
    },
    // 部位目標は全部位のキーを持つ（決めていない部位は null）
    groupGoals: { ...base.groupGoals, chest: { type: 'sets', value: 12 } },
    presets: [{ id: 'p1', name: '押す日', exerciseIds: ['ex_bench'] }],
    checks: { ...base.checks, enabled: true, sessionMinutes: 90 },
    suppressed: ['axial|2026-03-10'],
  };
}

/** `exportJson` が書くのと同じ形（`JSON.stringify(data, null, 2)`）で渡す */
function asFile(data: unknown): File {
  return new File([JSON.stringify(data, null, 2)], 'bodymake-2026-03-10.json', {
    type: 'application/json',
  });
}

describe('書き出したものを読み込み直す', () => {
  it('全項目が往復で戻る', async () => {
    const data = fullData();
    const back = await readImportFile(asFile(data));

    expect(back.entries).toEqual(data.entries);
    expect(back.settings).toEqual(data.settings);
    expect(back.exercises).toEqual(data.exercises);
    expect(back.workouts).toEqual(data.workouts);
    expect(back.presets).toEqual(data.presets);
    expect(back.groupGoals).toEqual(data.groupGoals);
    expect(back.checks).toEqual(data.checks);
    expect(back.suppressed).toEqual(data.suppressed);
  });

  it('確認の面に出す件数を数える', async () => {
    const back = await readImportFile(asFile(fullData()));
    expect(back.count).toBe(1); // 体組成の日数
    expect(back.exerciseCount).toBe(1);
    expect(back.sessionCount).toBe(1);
    expect(back.presetCount).toBe(1);
  });

  /*
   * **入っていない項目は「現状維持」。**null で返して、呼び出し側が触らない。
   * 空の値で返すと、体組成だけの JSON を読み込んだ人の種目が消える。
   */
  it('入っていない項目は現状維持（null）で返す', async () => {
    const back = await readImportFile(
      asFile({ entries: { '2026-03-10': { am: { weight: 70 } } } }),
    );

    expect(Object.keys(back.entries)).toEqual(['2026-03-10']);
    expect(back.exercises).toBeNull();
    expect(back.workouts).toBeNull();
    expect(back.presets).toBeNull();
    expect(back.groupGoals).toBeNull();
    expect(back.checks).toBeNull();
    expect(back.settings).toBeNull();
  });

  /** 古い形（entries だけを裸で持つ JSON）も読める */
  it('体組成だけの裸の JSON も読める', async () => {
    const back = await readImportFile(asFile({ '2026-03-10': { am: { weight: 70.2 } } }));
    expect(back.count).toBe(1);
    expect(back.exercises).toBeNull();
  });

  /*
   * 値域外や壊れた項目は落とす。**1 つも値の残らない日は日ごと落とす**——
   * 空の日が並ぶと、記録した日と見分けが付かなくなる。
   * 落ちたことは件数に出るので、確認の面で「体組成 0日ぶん」と読めば気づける。
   */
  it('値域を外れた記録は落とし、空になった日は残さない', async () => {
    const back = await readImportFile(
      asFile({
        entries: {
          '2026-03-10': { am: { weight: 9999, bodyFat: -5 } },
          '2026-03-11': { am: { weight: 9999, bodyFat: 18.4 } },
        },
      }),
    );
    // 全部落ちた日は消える
    expect(back.entries['2026-03-10']).toBeUndefined();
    // 片方だけ残った日は、落ちた値を null にして残す
    expect(back.entries['2026-03-11']?.am).toEqual({ weight: null, bodyFat: 18.4 });
    expect(back.count).toBe(1);
  });

  it('JSON でないファイルは失敗させる（呼び出し側が案内を出す）', async () => {
    const file = new File(['これは JSON ではない'], 'x.txt', { type: 'text/plain' });
    await expect(readImportFile(file)).rejects.toThrow();
  });
});

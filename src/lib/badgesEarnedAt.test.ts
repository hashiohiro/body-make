import { describe, expect, it } from 'vitest';
import { computeBadges } from './badges';
import { computeStats, buildDaily, buildWeeks } from './derive';
import { computeTrainingStats, buildSessions } from './training';
import { DEFAULT_SETTINGS, sanitizeBadgesEarnedAt } from './storage';

const emptyStats = () => {
  const daily = buildDaily({});
  return computeStats(daily, buildWeeks(daily), DEFAULT_SETTINGS);
};
const emptyTraining = () => computeTrainingStats(buildSessions({}, [], []));

/*
 * 獲得日は**このアプリで唯一、保存する導出値**（`AppData.badgesEarnedAt`）。
 * ほかの数字は記録から何度でも出し直せるが、いつ取ったかは合計からは戻らない。
 */
describe('実績の獲得日', () => {
  it('保存してある日をそのまま載せる', () => {
    const badges = computeBadges(emptyStats(), emptyTraining(), { 'streak-1': '2026-03-01' });
    expect(badges.find((b) => b.id === 'streak-1')?.earnedAt).toBe('2026-03-01');
  });

  it('持っていないものは null（この仕組みより前に獲ったぶん）', () => {
    const badges = computeBadges(emptyStats(), emptyTraining());
    expect(badges.every((b) => b.earnedAt === null)).toBe(true);
  });

  /** 読めない形は落とす。入れ直しは効かないので、残すのは読めるものだけ */
  it('日付の形が違うものは読み捨てる', () => {
    expect(
      sanitizeBadgesEarnedAt({
        'streak-1': '2026-03-01',
        'streak-3': '2026/03/01',
        'streak-7': 123,
        'streak-14': null,
      }),
    ).toEqual({ 'streak-1': '2026-03-01' });
  });

  it('object でなければ空', () => {
    expect(sanitizeBadgesEarnedAt(null)).toEqual({});
    expect(sanitizeBadgesEarnedAt([1, 2])).toEqual({});
  });
});

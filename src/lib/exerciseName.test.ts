import { describe, expect, it } from 'vitest';
import { CATALOG, catalogId, exerciseName, fromCatalog, otherLocaleNames } from './exerciseCatalog';
import { makeT } from './i18n';
import type { Exercise } from '../types';

const ja = makeT('ja');
const en = makeT('en');

const entry = (id: string) => CATALOG.find((c) => c.id === id)!;
const made = (id: string, implement: 'barbell' | 'dumbbell' | 'bodyweight' = 'barbell') =>
  fromCatalog(entry(id), 0, implement);

/*
 * 種目名は辞書ではなく ID → 英名の表から引く（`docs/design-i18n.md` §4）。
 * 保存されているのは日本語名なので、**読むときに引き直せているか**を見る。
 */
describe('種目名', () => {
  it('カタログ由来なら、いまの言語で読む', () => {
    const squat = made('ex_squat');
    expect(squat.name).toBe('スクワット');
    expect(exerciseName(ja, squat)).toBe('スクワット');
    expect(exerciseName(en, squat)).toBe('Squat');
  });

  it('器具を選んだ種目は、括弧の中まで訳す', () => {
    const db = made('ex_bench', 'dumbbell');
    expect(db.id).toBe(catalogId(entry('ex_bench'), 'dumbbell'));
    expect(exerciseName(ja, db)).toBe('ベンチプレス（ダンベル）');
    expect(exerciseName(en, db)).toBe('Bench Press (Dumbbell)');
  });

  it('本人が改名していれば、その名前のまま', () => {
    const renamed: Exercise = { ...made('ex_squat'), name: 'ワイドスクワット' };
    expect(exerciseName(ja, renamed)).toBe('ワイドスクワット');
    expect(exerciseName(en, renamed)).toBe('ワイドスクワット');
  });

  it('英語の名前で保存されていても、日本語に戻せる', () => {
    const asEnglish: Exercise = { ...made('ex_squat'), name: 'Squat' };
    expect(exerciseName(ja, asEnglish)).toBe('スクワット');
  });

  it('自作種目はカタログに無いので、そのまま出す', () => {
    expect(exerciseName(en, { id: 'made-up-id', name: '謎のマシン' })).toBe('謎のマシン');
  });

  it('探すときは、もう一方の言語の名前でも当たる', () => {
    expect(otherLocaleNames('ex_squat')).toContain('Squat');
    expect(otherLocaleNames('ex_squat')).toContain('スクワット');
    expect(otherLocaleNames('made-up-id')).toEqual([]);
  });
});

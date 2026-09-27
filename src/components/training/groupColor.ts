import type { ExerciseGroup } from '../../types';

/**
 * 部位の色（`_tokens.scss` の g-*）。今週の量の棒と、種目の目標の見出しで同じ色を使う。
 * 有酸素は部位ではないので色を持たない。
 */
export function groupColor(group: ExerciseGroup): string {
  return group === 'cardio' ? 'var(--ink-muted)' : `var(--g-${group})`;
}

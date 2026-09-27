import { volumeBarStyle } from './volumeBar';

/**
 * 今週の量の棒の見本（凡例と、目標の欄の見出しで使う）。
 * **セット数は塗り、挙上量は斜線。**色ではなく模様で分ける（色は部位が使っている）。
 */
export function VolumeSwatch({ kind }: { kind: 'sets' | 'volume' }) {
  return (
    <i
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: 10,
        height: 10,
        marginRight: 5,
        borderRadius: 2,
        verticalAlign: '-1px',
        ...volumeBarStyle(kind, 'var(--ink-2)'),
      }}
    />
  );
}

import type { CSSProperties } from 'react';

/**
 * 今週の量の棒の塗り。**セット数は塗りつぶし、挙上量は同じ色の斜線と枠。**
 * 色は部位が使っているので、何を数えたかは模様で分ける。
 */
export function volumeBarStyle(kind: 'sets' | 'volume', color: string): CSSProperties {
  return kind === 'sets'
    ? { background: color }
    : {
        background: `repeating-linear-gradient(135deg, ${color} 0 2px, transparent 2px 5px)`,
        boxShadow: `inset 0 0 0 1.5px ${color}`,
      };
}

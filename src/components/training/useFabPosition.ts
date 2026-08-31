import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';

/** 置き場所。**端末ごとの都合**なので記録には混ぜず、別のキーで持つ */
const KEY = 'bodymake.fab.v1';

/** 画面の端からの余白。ワイド画面では中央寄せの本文に合わせる（.fab の CSS と同じ式） */
function inset(): number {
  return Math.max(16, window.innerWidth / 2 - 360 + 16);
}

/** タブバーの高さ。トークンから引く（値を 2 か所に書かない） */
function tabHeight(): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--tab-h');
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : 56;
}

const SIZE = 56;
/** これ以上動いたらドラッグ。押しただけの指のぶれで場所が変わらないように */
const DRAG_THRESHOLD = 8;

export interface FabPosition {
  side: 'left' | 'right';
  /** 画面下端からの距離（px） */
  bottom: number;
}

function clampBottom(bottom: number): number {
  // 下はタブバーの上、上は画面の上端まで。どちらもボタンが隠れない位置で止める
  const min = tabHeight() + 8;
  const max = Math.max(min, window.innerHeight - SIZE - 8);
  return Math.min(max, Math.max(min, bottom));
}

function load(): FabPosition | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as Record<string, unknown>;
    const side = o.side === 'left' ? 'left' : 'right';
    const bottom = typeof o.bottom === 'number' && Number.isFinite(o.bottom) ? o.bottom : null;
    return bottom == null ? null : { side, bottom };
  } catch {
    return null;
  }
}

/**
 * ＋ ボタンをドラッグで動かせるようにする。
 *
 * **置き場所は端末ごとの都合**なので記録（AppData）には混ぜない。
 * 書き出した JSON を別の端末で読んだときに、その端末のボタンまで動く理由がない。
 *
 * 離したら左右どちらかの端に寄せる。自由な位置に留めると、
 * 画面の真ん中にボタンが浮いたまま戻せなくなる。
 * 縦だけは指の置いた高さを覚える（片手で届く高さは人によって違う）。
 *
 * 動かしていないあいだは **CSS の既定位置のまま**にして、
 * インラインの座標を持たない（端末の幅や safe-area の変化に CSS 側で追従させる）。
 */
export function useFabPosition() {
  const [pos, setPos] = useState<FabPosition | null>(null);
  const drag = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null);
  /** 直前の指がドラッグだったか。**離したあとに click が来る**ので、そこまで残す */
  const justDragged = useRef(false);
  const [offset, setOffset] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => setPos(load()), []);

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLButtonElement>) => {
    // 副ボタンや複数指では始めない
    if (!e.isPrimary || e.button !== 0) return;
    justDragged.current = false;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    d.moved = true;
    setOffset({ x: dx, y: dy });
  }, []);

  const onPointerUp = useCallback((e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    drag.current = null;
    setOffset(null);
    if (!d || d.id !== e.pointerId || !d.moved) return;
    justDragged.current = true;

    const rect = e.currentTarget.getBoundingClientRect();
    const next: FabPosition = {
      side: rect.left + rect.width / 2 < window.innerWidth / 2 ? 'left' : 'right',
      bottom: clampBottom(window.innerHeight - rect.bottom),
    };
    setPos(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* 容量超過などは置き場所を覚えないだけ。記録には関わらない */
    }
  }, []);

  const style: CSSProperties = {
    ...(pos
      ? pos.side === 'left'
        ? { left: inset(), right: 'auto', bottom: pos.bottom }
        : { right: inset(), left: 'auto', bottom: pos.bottom }
      : {}),
    ...(offset ? { transform: `translate(${offset.x}px, ${offset.y}px)` } : {}),
    // ドラッグ中に画面がスクロールしないように
    touchAction: 'none',
  };

  /**
   * 動かした指で押したときは、押した扱いにしない。
   * 読んだ時点で下ろす（次の指はまた押した扱いに戻る）。
   */
  const dragged = () => {
    const was = justDragged.current;
    justDragged.current = false;
    return was;
  };

  return { style, dragged, onPointerDown, onPointerMove, onPointerUp };
}

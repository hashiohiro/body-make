import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import ui from '../styles/ui.module.scss';
import s from './ChipGroup.module.scss';

/** 選択肢 1 つ。`id` が値、`label` が出す文字 */
export interface ChipOption<T> {
  id: T;
  label: string;
}

interface Props<T> {
  options: readonly ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /**
   * 何を選ぶ行か。
   *
   * **既定は読み上げにだけ出す**（`aria-label`）。チップの語だけで何の話か分かる場面
   * （表示期間・表示する値）では、見出しを置くと行が 1 段増えるだけになる。
   */
  label: string;
  /**
   * 見出しを画面にも出すか。
   *
   * 同じ面に行が 2 つ以上あるときに使う（カタログの 器具 / 部位）。
   * どちらが何の絞り込みなのか、チップの語だけでは決められない。
   */
  showLabel?: boolean | undefined;
  /** 折り返す行に使う詰めた見た目（`s.tight`）。一覧の上に重ねる絞り込みで使う */
  tight?: boolean | undefined;
  /**
   * **横に流れる行。**選択肢が画面の外まで続きうるときに付ける。
   *
   * 表示期間のように 3 つで収まる行には付けない。付けるのはいまのところ、
   * セット入力のダイアログに出す「その日の種目」だけ。
   *
   * 付けると 2 つが同時に効く。**どちらも同じ状況への手当てなので、分けて持たない。**
   *
   * - 選んでいるチップを、必ず見える位置へ寄せる
   *   （開いた種目が画面の外にあると、押す前に自分の居場所を探すことになる）
   * - **まだ続く側の端を薄くして、`›` を出す**
   *   （端でちょうど切れた行は、そこが終わりに見える。
   *   流せると分からなければ、隠れたチップは無いのと同じ）
   */
  scrollable?: boolean | undefined;
}

/**
 * 続きがある向きの印。**字ではなく図で描く。**
 *
 * `‹` `›` の字は、フォントごとに上下の位置が違う——文字の並びに混ぜて使うものなので、
 * 中央ではなく小文字の高さに合わせて置かれているものが多い。
 * 箱のほうを中央に寄せても、字そのものが箱の中央に無いので、寄って見えない。
 * 図なら箱の中央がそのまま中央になる。
 *
 * 色は `currentColor` で受ける。`--caret`（選ぶ欄の矢印）のように
 * `url()` で持つと、中で custom property が使えないぶん配色ごとに定義が要る。
 * 描いてしまえば 1 つで済む（グラフを外部ライブラリなしで描いているのと同じ理由）。
 */
function Chevron({ dir }: { dir: 'start' | 'end' }) {
  return (
    <svg className={s.chevron} viewBox="0 0 6 10" aria-hidden="true">
      <path
        d={dir === 'end' ? 'M1 1l4 4-4 4' : 'M5 1L1 5l4 4'}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * 選択肢から 1 つ選ぶチップの行。**アプリ中のチップ行はすべてこれ。**
 *
 * 同じ形（`ui.chipRow` + `ui.chip` + `aria-pressed`）が 15 か所に写してあった。
 * 写すたびに `role="group"` や読み上げの名前が抜けうるし、
 * 押した見た目を直すのに 15 か所を回ることになる。
 *
 * **2 択でも同じものを使う。**「どちらか一方」を枠続きで見せる `Segmented` は
 * 体組成／トレーニングの切り替え（画面の主題そのものが入れ替わる）のためにあって、
 * 絞り込みや表示の切り替えはこちら。
 */
export function ChipGroup<T extends string | number>({
  options,
  value,
  onChange,
  label,
  showLabel,
  tight,
  scrollable,
}: Props<T>) {
  const id = useId();
  const rowRef = useRef<HTMLDivElement>(null);
  /** どちら側にまだ続きがあるか。両端とも false なら全部見えている */
  const [more, setMore] = useState({ start: false, end: false });

  /**
   * 端の印を出すかどうかを測る。
   *
   * **1px の遊びを持たせる。**拡大率や小数のスクロール位置で端まで寄せても
   * `scrollLeft` がぴったり 0 や最大値にならないことがあり、
   * 終わりまで流したのに `›` が残る。
   */
  const measure = useCallback(() => {
    const el = rowRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setMore({ start: el.scrollLeft > 1, end: el.scrollLeft < max - 1 });
  }, []);

  /*
   * 選んでいるチップへ寄せる。**縦は動かさない**（`block: 'nearest'`）——
   * 行そのものは既に見えているので、ここで縦に動くと読んでいた場所が逃げる。
   *
   * 描く前に済ませる（`useLayoutEffect`）。あとから寄せると、一度
   * 端に寄った行が見えてから動くことになる。
   */
  useLayoutEffect(() => {
    if (!scrollable) return;
    rowRef.current
      ?.querySelector<HTMLElement>('[aria-pressed="true"]')
      ?.scrollIntoView({ inline: 'center', block: 'nearest' });
    measure();
  }, [scrollable, value, options.length, measure]);

  /* 幅が変われば、収まるかどうかも変わる（横向きにした・キーボードが出た） */
  useEffect(() => {
    if (!scrollable) return;
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [scrollable, measure]);

  const fade =
    more.start && more.end ? s.fadeBoth : more.end ? s.fadeEnd : more.start ? s.fadeStart : '';

  const row = (
    <div
      ref={rowRef}
      className={`${ui.chipRow} ${tight ? s.tight : ''} ${scrollable ? s.inScroller : ''} ${fade}`}
      role="group"
      onScroll={scrollable ? measure : undefined}
      {...(showLabel ? { 'aria-labelledby': id } : { 'aria-label': label })}
    >
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className={ui.chip}
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );

  return (
    <>
      {showLabel && (
        <div className={s.label} id={id}>
          {label}
        </div>
      )}
      {scrollable ? (
        <div className={s.scroller}>
          {row}
          {/*
            続きがある側にだけ出す。**押せない印**（`pointer-events: none`）で、
            チップの当たり判定を奪わない。流し終われば消える。
            読み上げには出さない——選択肢そのものは行が持っている。
          */}
          {more.start && (
            <span className={`${s.more} ${s.moreStart}`} aria-hidden="true">
              <Chevron dir="start" />
            </span>
          )}
          {more.end && (
            <span className={`${s.more} ${s.moreEnd}`} aria-hidden="true">
              <Chevron dir="end" />
            </span>
          )}
        </div>
      ) : (
        row
      )}
    </>
  );
}

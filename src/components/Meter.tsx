import s from './Meter.module.scss';

/**
 * バーの大きさ。**扱う量ではなく、面の中での役目で決める。**
 *
 *   row  … 一覧の行に混ぜる（6px）。並べて見比べるためのもの
 *   card … 目標のカードの主役（10px）。1 本だけ置く
 */
type Size = 'row' | 'card';

interface Props {
  /** 0〜1。外れた値はここで丸める（呼び出し側で毎回クランプさせない） */
  value: number;
  /** 何の進捗か。読み上げに出す */
  label: string;
  size?: Size | undefined;
  /**
   * 自分の段に置くか。**行の中に混ぜるときは渡さない**（上下の余白は行が決める）。
   *
   * 段として置くときだけ、上の行との間隔（8px）と下の注記との間隔（4px）を持つ。
   * これを行の中でも付けると、行の高さがバーのぶんだけ伸びる。
   */
  block?: boolean | undefined;
  /**
   * 未達のぶんを薄いアクセントで塗るか。
   *
   * 目標のメーターだけ真にする。1 本しか無い面では、トラック全体で
   * 「どこまで来たか」を読ませたい。並べる行では、地を塗ると行そのものが目立って
   * 見比べにくくなる。
   */
  tinted?: boolean | undefined;
  /** アニメーションを付けるか。1 本だけ置く面で使う（並ぶ行が一斉に動くと落ち着かない） */
  animated?: boolean | undefined;
}

/**
 * 進捗のバー。**アプリ中のバーはすべてこれ。**
 *
 * 同じものが 3 つの実装に分かれていた——一覧の行（`meter`）、回復の行
 * （`groupBarTrack`）、目標のカード（`track`）。高さと色だけが違うのに、
 * `width: ${p * 100}%` の書き方も 0〜1 の丸め方もそれぞれで、
 * **`role="progressbar"` は目標のカードにしか付いていなかった**
 * （読み上げで進捗が読めるのが 1 か所だけだった）。
 */
export function Meter({ value, label, size = 'row', block, tinted, animated }: Props) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);

  return (
    <span
      className={`${s.track} ${s[size]} ${block ? s.block : ''} ${tinted ? s.tinted : ''}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={label}
    >
      <i className={`${s.fill} ${animated ? s.animated : ''}`} style={{ width: `${pct}%` }} />
    </span>
  );
}

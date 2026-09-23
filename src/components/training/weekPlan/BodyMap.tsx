import { GROUP_COLORS } from '../../../lib/exerciseCatalog';
import type { MuscleGroup } from '../../../types';
import s from './weekPlan.module.scss';
import { useT } from '../../../lib/i18n';
import type { MessageKey } from '../../../lib/i18n';

interface Props {
  /**
   * 部位ごとの濃さ。0〜1。**部位色の濃淡だけで、良し悪しの色は乗せない**
   * （「部位別の配分」のヒートマップと同じ作法）。0 は地のまま。
   */
  tint: Partial<Record<MuscleGroup, number>>;
  /** 読み上げに出す、何の図か */
  label: string;
}

/** 札の並び順。図の上から下へ */
const ORDER: MuscleGroup[] = ['shoulders', 'chest', 'back', 'arms', 'core', 'legs'];

/** 区画ひとつ。点の列で持つ */
type Shape = [number, number][];

/** 図の中心。左右の対称はここで折り返す */
const MID = 50;

/**
 * 頭と首の輪郭。**楕円と首を 1 本の線でつなぐ。**
 *
 * 首の上端（44.1 / 55.9, y=33）は楕円 cx=50 cy=22 rx=11 ry=13 の上の点なので、
 * そこから大きい弧で頭を回って反対側へ戻れば、継ぎ目のない 1 つの形になる。
 */
const HEAD = 'M 43 46 L 44.1 33 A 11 13 0 1 1 55.9 33 L 57 46 Z';

/** 左の形から右の形を作る。左右で点を 2 度書くと、片方だけ直る */
const mirror = (shape: Shape): Shape => shape.map(([x, y]) => [MID * 2 - x, y]);

const pair = (left: Shape): Shape[] => [left, mirror(left)];

/**
 * 部位の区画。**どの区画も四点の台形で、隣とは辺を共有する。**
 *
 * 区画ごとに枠を引くので、すき間を空けると**境目に線が 2 本**並ぶ。
 * 辺を重ねれば 1 本に見える。離すのは、離れていることに意味がある
 * ところだけ（腕と胴、左右の脚）。
 *
 * 同じ幅の四角を積むと機械の絵になり、腰のくびれや肩の張り出しまで描くと
 * 今度は解剖図に寄る。**わずかな先細りだけ**を残して、あとは記号に留める。
 * 角は描画側で丸める（`stroke-linejoin: round`）ので、点は素直な多角形でよい。
 *
 * **胴（胸・腹・背中）は 1 枚で描く。**左右に分けると真ん中に線が入り、
 * 腹筋の正中線や脊柱のように見える。線を引くのは**部位の境目だけ**にする。
 * 手足と肩は本当に 2 つあるので、そこだけ左右で分ける。
 */
const FRONT: Partial<Record<MuscleGroup, Shape[]>> = {
  // 肩。胴（x=35）と腕（y=67）に辺を預ける
  shoulders: pair([
    [15, 48],
    [35, 46],
    [35, 67],
    [17, 67],
  ]),
  // 胸。胴は 1 枚で描く（左右に分けると正中線が筋に見える）
  chest: [
    [
      [35, 46],
      [65, 46],
      [64, 74],
      [36, 74],
    ],
  ],
  // 腕。胴とは離す——くっつけると人の形に見えない
  arms: pair([
    [17, 67],
    [31, 67],
    [29, 117],
    [19, 117],
  ]),
  // 腹
  core: [
    [
      [36, 74],
      [64, 74],
      [63, 111],
      [37, 111],
    ],
  ],
  // 脚。ここだけ先細りを残す（棒 2 本に見えないように）
  legs: pair([
    [37, 111],
    [49, 111],
    [46, 189],
    [39, 189],
  ]),
};

/** 背面。胴はひと続き（上背から腰まで）で、ほかは前と同じ骨格 */
const BACK: Partial<Record<MuscleGroup, Shape[]>> = {
  shoulders: FRONT.shoulders!,
  back: [
    [
      [35, 46],
      [65, 46],
      [63, 111],
      [37, 111],
    ],
  ],
  arms: FRONT.arms!,
  legs: FRONT.legs!,
};

const VIEWS: { id: string; key: MessageKey; shapes: Partial<Record<MuscleGroup, Shape[]>> }[] = [
  { id: 'front', key: 'bodyMap.front', shapes: FRONT },
  { id: 'back', key: 'bodyMap.back', shapes: BACK },
];

const points = (shape: Shape) => shape.map(([x, y]) => `${x},${y}`).join(' ');

/**
 * 読む専用の図の塗り。**部位色の濃淡だけ**で、良し悪しの色は乗せない
 * （「部位別の配分」のヒートマップと同じ作法）。0 は地のまま。
 */
const fillOf = (group: MuscleGroup, ratio: number) =>
  ratio <= 0
    ? 'var(--surface-sunken)'
    : `color-mix(in srgb, ${GROUP_COLORS[group]} ${15 + ratio * 55}%, transparent)`;

/**
 * 部位の量を絵で見せる。**読む図で、押せない。**
 *
 * 選ぶ図でもあった頃は、札（`Pill`）が操作の本体で、区画は同じ選択を
 * 絵にしているだけだった。曜日に部位を置く面が無くなり、残ったのは
 * 「どこをどれだけやるか（やったか）」を見せる用だけになったので、
 * 選ぶ道ごと落としてある。
 *
 * 区画は読み上げに出さない（`aria-hidden`）。同じ部位の要素が前後 2 枚で
 * 二重に読まれるだけなので、図ぜんたいに名前を付けて 1 つの絵として扱う。
 */
export function BodyMap({ tint, label }: Props) {
  const t = useT();
  return (
    <div className={s.bodyMap} role="img" aria-label={label}>
      <div className={s.figures}>
        {VIEWS.map((view) => (
          <figure key={view.id} className={s.figureWrap}>
            <svg className={s.figure} viewBox="0 0 100 196" aria-hidden="true">
              {/*
                頭と首。鍛える部位ではないので、枠線を持たせない。

                **1 つの形で描く。**楕円と台形を重ねていたときは、配色によっては
                塗りが半透明（`--grid` が `rgba`）になり、**重なった帯だけが濃く**なっていた。
                首の付け根は楕円の上に取ってあるので、継ぎ目も出ない。
              */}
              <path className={s.figureBase} d={HEAD} />

              {ORDER.filter((group) => view.shapes[group]).map((group) => (
                <g
                  key={group}
                  className={s.regionReading}
                  data-region={group}
                  style={{ fill: fillOf(group, tint[group] ?? 0) }}
                >
                  {view.shapes[group]!.map((shape, i) => (
                    <polygon key={i} points={points(shape)} />
                  ))}
                </g>
              ))}
            </svg>
            <figcaption className={s.figureLabel}>{t(view.key)}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

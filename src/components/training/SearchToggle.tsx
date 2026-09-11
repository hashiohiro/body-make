import { useEffect, useRef, useState } from 'react';
import s from './training.module.scss';

interface Props {
  query: string;
  onQuery: (value: string) => void;
  /** 何を探す欄か（読み上げと placeholder に使う） */
  label: string;
}

/**
 * 種目を名前で探す。**見出しの行に置く。**
 *
 * 以前は一覧の上に欄を常設していて、使わない日も 1 行ぶん高さを取り、
 * 触れば iOS がキーボードを出すので、それを理由にいったん廃止した。
 * 戻すにあたって変えたのは中身ではなく**置き場所**——
 * 見出しの行（カードのヘッダ／ダイアログの頭）はもともと空いているので、
 * そこに畳めば **待機中の高さが 0** になる。
 *
 * 打ちはじめたら、一覧を平たい候補に差し替える（呼び出し側の仕事）。
 * 部位の見出しは、探している最中は読まない。
 *
 * **別の面は重ねない。**ダイアログ → カタログ → 検索 で 3 段になる
 * （`design-training.md` の「3 段は作らない」）。同じ面のまま入れ替える。
 */
export function SearchToggle({ query, onQuery, label }: Props) {
  // 外から語を持って開かれることもある（面を差し替えても続きから探せるように）
  const [open, setOpen] = useState(query !== '');
  const ref = useRef<HTMLInputElement>(null);

  // 開いたらすぐ打てるようにする（押してからもう一度、欄を狙わせない）
  useEffect(() => {
    if (open) ref.current?.focus();
  }, [open]);

  const close = () => {
    setOpen(false);
    onQuery('');
  };

  if (!open) {
    return (
      <button
        type="button"
        className={s.searchBtn}
        aria-label={label}
        onClick={() => setOpen(true)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden>
          <circle cx="11" cy="11" r="6.5" />
          <path d="M16 16l4.5 4.5" strokeLinecap="round" />
        </svg>
      </button>
    );
  }

  return (
    <span className={s.searchBox}>
      <input
        ref={ref}
        type="search"
        className={s.searchField}
        value={query}
        placeholder={label}
        aria-label={label}
        onChange={(e) => onQuery(e.target.value)}
        // 打ち終わりに Esc で閉じられる。物理キーボードのときだけ効く
        onKeyDown={(e) => e.key === 'Escape' && close()}
      />
      {/*
        × は 1 つだけ。ブラウザが欄の中に付ける × は CSS で消してある——
        「語を消す」と「検索をやめる」が同じ形で並ぶと、押す前に区別が付かない。
        語だけ消しても一覧は全件に戻るので、結果は同じところに着く。
      */}
      <button type="button" className={s.searchClose} aria-label="検索をやめる" onClick={close}>
        ×
      </button>
    </span>
  );
}

import { useEffect, useState } from 'react';
import { todayISO } from '../lib/date';

/**
 * いまの日付。**前面に戻ったときに読み直す。**
 *
 * PWA は閉じずに背面へ回るだけなので、寝る前に開いたまま翌朝また開くと、
 * `todayISO()` を描画のたびに呼んでいても再描画が起きず、日付が前日のままになる。
 * 連続記録も回復も「今日」から数えるので、1 日ぶんずれた数字を見せることになる。
 *
 * **見ている日は動かさない。**記録画面が勝手に別の日へ移ると、
 * 打ちかけの欄が目の前から消える（深夜に前日ぶんを打っている最中がこれ）。
 * 日が変わったことは、ヘッダに出る「今日」ボタンで知らせる
 * （`DateNav` は見ている日と今日が違うときだけ出す）。
 *
 * 見るのは前面に戻った瞬間だけで、時計は持たない。日付が変わる瞬間に
 * 画面が書き換わる必要はなく、タイマーを置くと背面で起き続ける理由になる。
 */
export function useToday(): string {
  const [today, setToday] = useState(todayISO);

  useEffect(() => {
    const sync = () => {
      // 同じ日なら state を触らない（再描画が無駄に走らないように）
      setToday((cur) => {
        const next = todayISO();
        return cur === next ? cur : next;
      });
    };

    /*
     * 3 つとも拾う。**どれか 1 つでは足りない。**
     *   visibilitychange … タブの切り替え・ホームへ戻して戻る
     *   focus            … 別アプリから戻る（visible のまま focus だけ動くことがある）
     *   pageshow         … iOS がページを凍らせて復帰させたとき（bfcache）
     */
    const onVisible = () => {
      if (document.visibilityState === 'visible') sync();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', sync);
    window.addEventListener('pageshow', sync);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', sync);
      window.removeEventListener('pageshow', sync);
    };
  }, []);

  return today;
}

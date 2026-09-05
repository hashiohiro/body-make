import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { loadData } from './lib/storage';
import { applyStoredTheme } from './hooks/useTheme';
import './styles/global.scss';

const container = document.getElementById('root');
if (!container) throw new Error('#root が見つかりません');

/*
 * 記録を読み終えてから React を載せる。
 *
 * 保存先が IndexedDB になって読み出しが非同期になった。画面の中で待つと、
 * どの画面にも「まだ読んでいない」状態が要るようになり、記録が無い状態と
 * 見分けがつかなくなる。読むのはここ 1 か所だけにする。
 *
 * 待っているあいだの表示は index.html が持っている（400ms 遅れて出る）。
 * バンドルを取得・解析している区間のほうが長いので、ここに書いたのでは間に合わない。
 *
 * 配色だけは読み込みを待たずに当てる。地の色が数十ミリ秒だけ既定に戻るのが見えるため。
 */
applyStoredTheme();

// 新しいビルドが出たら次回起動時に自動で入れ替える。
// 読み込みの成否に関わらず登録する——壊れて開けないときに、次のビルドで直せるように
registerSW({ immediate: true });

void loadData().then(
  (initial) => {
    container.replaceChildren();
    createRoot(container).render(
      <StrictMode>
        <App initial={initial} />
      </StrictMode>,
    );
  },
  () => {
    /*
     * 読み出しに失敗した。**空の記録でアプリを載せない。**
     *
     * 載せると、空の状態が保存されて本物を上書きしうる。記録には触らず、
     * 読めなかったことだけを伝えて開き直してもらう
     * （`storage.ts` の Backend 'none' と同じ考え方）。
     */
    const boot = container.querySelector('.boot');
    if (boot) {
      boot.innerHTML =
        '<p><b>記録を読み出せませんでした。</b></p>' +
        '<p>記録は消えていません。開き直すと戻ることがあります。</p>';
      boot.setAttribute('style', 'opacity:1;animation:none');
    }
  },
);

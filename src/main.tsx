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
 * 配色だけは読み込みを待たずに当てる。地の色が数十ミリ秒だけ既定に戻るのが見えるため。
 */
applyStoredTheme();

void loadData().then((initial) => {
  createRoot(container).render(
    <StrictMode>
      <App initial={initial} />
    </StrictMode>,
  );

  // 新しいビルドが出たら次回起動時に自動で入れ替える
  registerSW({ immediate: true });
});

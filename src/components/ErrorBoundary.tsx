import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { exportJson } from '../lib/io';
import { flushSave, loadData } from '../lib/storage';
import { Button } from './Button';
import ui from '../styles/ui.module.scss';
import s from './ErrorBoundary.module.scss';
import { deviceLocale, makeT } from '../lib/i18n';

interface State {
  error: Error | null;
  /** どの部品で起きたか。読むためではなく、伝えるために写せるようにしておく */
  stack: string | null;
  /** 書き出しにも失敗したか */
  exportFailed: boolean;
}

/**
 * 画面を出せなかったときの受け皿。**アプリで 1 つ、いちばん外側に置く。**
 *
 * 描画のどこかで例外が出ると React は木ごと落とすので、受け皿が無いと白画面になる。
 * しかもこれは **PWA でキャッシュが効いている**ので、開き直しても白のままになりうる。
 *
 * **このアプリは記録が唯一の資産で、バックアップは JSON の書き出しだけ。**
 * 白画面だとその書き出しにも行けない——それがいちばん困る。だから置くのは
 * 「ごめんなさい」ではなく**記録を持ち出す口**にする。
 *
 * 面ごとに置かない。細かく囲むと「一部だけ壊れた画面」が出来て、
 * どこまで信じていいのか読む側に分からなくなる。**出せないなら全部出さない。**
 * 読み出しに失敗したときの案内（`main.tsx`）と同じ言い方にそろえる。
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null, stack: null, exportFailed: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  override componentDidCatch(_error: Error, info: ErrorInfo): void {
    this.setState({ stack: info.componentStack ?? null });
  }

  /**
   * いま保存されている記録を書き出す。
   *
   * 保存は少し待ってから書くので、**先に書き切ってから**読み直す
   * （落ちる直前の 1 手が落ちないように）。画面の状態は当てにしない——
   * 壊れているのはそちらなので。
   */
  private readonly save = () => {
    void flushSave()
      .then(loadData)
      .then((data) => {
        exportJson(data);
        this.setState({ exportFailed: false });
      })
      .catch(() => this.setState({ exportFailed: true }));
  };

  override render(): ReactNode {
    /*
     * **辞書から直に引く（フックを使わない）。**
     *
     * ここはクラス部品で、しかも描画が壊れたときに出る面。設定を読む経路ごと
     * 壊れている可能性があるので、記録の中の言語ではなく**端末の言語**で出す。
     */
    const t = makeT(deviceLocale());
    const { error, stack, exportFailed } = this.state;
    if (error == null) return this.props.children;

    return (
      <div className={s.wrap}>
        <section className={ui.card}>
          <p className={s.head}>{t('error.title')}</p>
          <p className={ui.note}>{t('error.note')}</p>

          <div className={ui.btnRow}>
            <Button tone="primary" onClick={this.save}>
              {t('error.export')}
            </Button>
            <Button tone="ghost" onClick={() => window.location.reload()}>
              {t('alert.reopen')}
            </Button>
          </div>

          {exportFailed && <p className={ui.note}>{t('error.exportFailed')}</p>}

          <details className={s.detail}>
            <summary>{t('error.details')}</summary>
            <pre>
              {error.message}
              {stack}
            </pre>
          </details>
        </section>
      </div>
    );
  }
}

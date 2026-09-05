import { useState } from 'react';
import { useInstallPrompt } from '../hooks/useStorageSafety';
import { loadDevice, isStandalone, markExported, patchDevice, snoozeOver } from '../lib/device';
import { todayISO } from '../lib/date';
import { exportJson } from '../lib/io';
import { IS_DEMO } from '../lib/env';
import type { AppData } from '../types';
import ui from '../styles/ui.module.scss';
import s from './SafetyNotices.module.scss';

/**
 * 書き出しを促しはじめる、**未書き出しの**記録日数。
 *
 * 前は「前回の書き出しから 60 日」で出していたが、それだと
 * 書き出したあと 1 日も記録していなくても 60 日で出る一方、
 * 毎日記録していても 59 日目までは出なかった。
 * **失う量で決める**ほうが、言っていることと条件が一致する。
 */
const BACKUP_AFTER_DAYS = 30;
/** ホーム画面の案内を出しはじめる記録日数。使うと決めた人にだけ出す */
const INSTALL_AFTER_DAYS = 3;

interface Props {
  data: AppData;
}

/**
 * 記録のある日。**体組成とトレーニングの和集合**で数える。
 *
 * `Stats.recordedDays` は体組成だけを数えるので、筋トレしか付けていない人に
 * この案内が一生出なかった。守る対象はどちらの記録も同じなので、
 * 片方だけを閾値に使わない。
 */
function recordedDates(data: AppData): string[] {
  return [...new Set([...Object.keys(data.entries), ...Object.keys(data.workouts)])];
}

/**
 * まだ書き出していない記録の日数。
 *
 * 書き出した日の記録は書き出しに含まれているので、**その日より後**を数える。
 * 一度も書き出していなければ全部が対象。
 */
function unsavedDays(dates: readonly string[], exportedAt: string | null): number {
  return exportedAt == null ? dates.length : dates.filter((d) => d > exportedAt).length;
}

/**
 * 記録が消えないようにするための案内。
 *
 * **ホームのいちばん上**（切り替えと現在地のあいだ）に置く。
 * 毎日見る数字の下に置くと読まれない——言っているのは「この端末にしか無い」なので、
 * 読まれなければ何も守れない。毎回目に入ることを引き受けたうえで、
 * 閉じられるようにして間隔を持たせる。
 *
 * 出すのは **一度に 1 つだけ**。2 枚並ぶと、どちらも読み飛ばされる。
 * 閉じたら 30 日は出さない（`lib/device.ts`）。永久に消さないのは、
 * 30 日前に閉じた案内と、90 日ぶんの記録を抱えたいまとでは、失うものの量が違うため。
 */
export function SafetyNotices({ data }: Props) {
  const [device, setDevice] = useState(loadDevice);
  const install = useInstallPrompt();
  // デモは開き直すたびに初期データへ戻る。守るものが無い場所で、守り方の話をしない
  if (IS_DEMO) return null;

  const today = todayISO();
  const dates = recordedDates(data);
  const unsaved = unsavedDays(dates, device.exportedAt);

  const showBackup = unsaved >= BACKUP_AFTER_DAYS && snoozeOver(device.backupClosedAt);

  // ホーム画面への追加は「使うと決めたか」なので、こちらは通算で見る
  const showInstall =
    dates.length >= INSTALL_AFTER_DAYS && !isStandalone() && snoozeOver(device.installClosedAt);

  // 失うものが大きいほうを先に出す。同時には出さない
  if (showBackup) {
    return (
      <section className={`${ui.card} ${s.urgent}`}>
        <p className={s.body}>
          {device.exportedAt == null
            ? `${unsaved}日ぶんの記録が、この端末のブラウザの中だけにあります。まだ一度も書き出していません。`
            : `前に書き出した ${device.exportedAt} から、${unsaved}日ぶん記録しています。この端末のブラウザの中だけにあります。`}
          ブラウザのデータを消すか機種を変えると、戻せません。
        </p>
        <div className={ui.btnRow}>
          <button
            type="button"
            className={`${ui.btn} ${ui.btnPrimary}`}
            onClick={() => {
              exportJson(data);
              setDevice(markExported());
            }}
          >
            JSONで書き出す
          </button>
          <button
            type="button"
            className={`${ui.btn} ${ui.btnGhost}`}
            onClick={() => setDevice(patchDevice({ backupClosedAt: today }))}
          >
            閉じる
          </button>
        </div>
      </section>
    );
  }

  if (showInstall) {
    return (
      <section className={ui.card}>
        <p className={s.body}>
          ホーム画面に追加すると、オフラインでも開けて、ブラウザのデータ整理で記録が消えにくくなります。
          {install.prompt == null && (
            <>
              <br />
              iPhone は共有ボタンから「ホーム画面に追加」、Android
              はメニューから「アプリをインストール」。
            </>
          )}
        </p>
        <div className={ui.btnRow}>
          {install.prompt && (
            <button type="button" className={`${ui.btn} ${ui.btnPrimary}`} onClick={install.prompt}>
              ホーム画面に追加
            </button>
          )}
          <button
            type="button"
            className={`${ui.btn} ${ui.btnGhost}`}
            onClick={() => setDevice(patchDevice({ installClosedAt: today }))}
          >
            閉じる
          </button>
        </div>
      </section>
    );
  }

  return null;
}

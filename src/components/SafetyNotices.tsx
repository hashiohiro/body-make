import { useState } from 'react';
import { useInstallPrompt } from '../hooks/useStorageSafety';
import { loadDevice, isStandalone, markExported, patchDevice, snoozeOver } from '../lib/device';
import { diffDays, todayISO } from '../lib/date';
import { exportJson } from '../lib/io';
import { IS_DEMO } from '../lib/env';
import type { AppData } from '../types';
import ui from '../styles/ui.module.scss';
import s from './SafetyNotices.module.scss';

/** 記録がこの日数を超えたら、書き出しを促す対象にする */
const BACKUP_AFTER_DAYS = 30;
/** 前に書き出してからこの日数が経っていなければ、まだ促さない */
const BACKUP_INTERVAL_DAYS = 60;
/** ホーム画面の案内を出しはじめる記録日数。使うと決めた人にだけ出す */
const INSTALL_AFTER_DAYS = 3;

interface Props {
  data: AppData;
}

/**
 * 記録のある日数。**体組成とトレーニングの和集合**で数える。
 *
 * `Stats.recordedDays` は体組成だけを数えるので、筋トレしか付けていない人に
 * この案内が一生出なかった。守る対象はどちらの記録も同じなので、
 * 片方だけを閾値に使わない。
 */
function recordedDays(data: AppData): number {
  return new Set([...Object.keys(data.entries), ...Object.keys(data.workouts)]).size;
}

/**
 * 記録が消えないようにするための案内。
 *
 * **記録の話ではなく、記録の置き場所の話**なのでホームのいちばん下に置く。
 * 上に出すと、毎日見る数字の前に毎日同じ注意書きが挟まる。
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
  const days = recordedDays(data);
  const staleBackup =
    device.exportedAt == null || diffDays(today, device.exportedAt) >= BACKUP_INTERVAL_DAYS;

  const showBackup = days >= BACKUP_AFTER_DAYS && staleBackup && snoozeOver(device.backupClosedAt);

  const showInstall =
    days >= INSTALL_AFTER_DAYS && !isStandalone() && snoozeOver(device.installClosedAt);

  // 失うものが大きいほうを先に出す。同時には出さない
  if (showBackup) {
    return (
      <section className={`${ui.card} ${s.urgent}`}>
        <p className={s.body}>
          {days}日ぶんの記録が、この端末のブラウザの中だけにあります。
          {device.exportedAt == null
            ? 'まだ一度も書き出していません。'
            : `前に書き出したのは ${device.exportedAt} です。`}
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

import { useEffect, useState } from 'react';

/**
 * ブラウザに「この記録を勝手に消さないでほしい」と申請する。
 *
 * localStorage は容量が逼迫したときや、しばらく開いていないサイトの整理対象になる。
 * `navigator.storage.persist()` はその整理から外してもらう申請で、
 * **通るかどうかはブラウザが決める**（Chrome は利用実績から自動で判断し、
 * Safari はホーム画面に追加した状態を持続として扱う）。
 *
 * 断られても実害はない。申請していないより悪くなることはないので、
 * 記録が 1 件でも入った時点で 1 回だけ出す。
 */
export function usePersistentStorage(hasRecords: boolean): void {
  useEffect(() => {
    if (!hasRecords) return;
    const storage = navigator.storage;
    if (!storage?.persist || !storage.persisted) return;
    let cancelled = false;
    void (async () => {
      try {
        if (cancelled) return;
        if (await storage.persisted()) return;
        await storage.persist();
      } catch {
        /* 対応していない環境。申請しないだけで、動作は変わらない */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasRecords]);
}

/**
 * Chromium 系だけが投げる「インストールできます」のイベント。
 *
 * 受け取れた端末では本物のボタンを出せる。受け取れない端末（iOS Safari など）は
 * null のままで、案内側が手順の文章に落ちる。
 */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

export function useInstallPrompt(): { prompt: (() => void) | null } {
  const [event, setEvent] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      // 既定のミニバナーを止めて、こちらの案内から出す（出す時機を記録日数で決めたい）
      e.preventDefault();
      setEvent(e as InstallPromptEvent);
    };
    const onInstalled = () => setEvent(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  return {
    prompt: event
      ? () => {
          void event.prompt();
          // プロンプトは 1 つのイベントにつき 1 回しか出せない
          setEvent(null);
        }
      : null,
  };
}

import { useEffect, useState } from 'react';

/**
 * ブラウザに「この記録を勝手に消さないでほしい」と申請する。
 *
 * 端末の容量が逼迫したときや、しばらく開いていないサイトは整理の対象になる。
 * 対象になるのは**このオリジンの保存領域まるごと**で、IndexedDB も localStorage も一緒に消える。
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

/**
 * このオリジンが使える容量の目安。
 *
 * localStorage の 5MB という決め打ちの代わりに、**ブラウザが答える値**を出す。
 * IndexedDB の上限は端末の空き容量から決まるので、こちらでは決め打てない。
 * 返ってくるのはオリジン全体（Service Worker のキャッシュを含む）の見積もりで、
 * 記録だけの量ではない。答えない環境では null のままにして、何も出さない。
 */
export function useStorageQuota(): number | null {
  const [quota, setQuota] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    void navigator.storage
      ?.estimate?.()
      .then((e) => {
        if (alive && e.quota != null) setQuota(e.quota);
      })
      .catch(() => {
        /* 答えない環境。目安を出さないだけ */
      });
    return () => {
      alive = false;
    };
  }, []);

  return quota;
}

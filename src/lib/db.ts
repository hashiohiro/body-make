/**
 * IndexedDB の最小ラッパ。**依存は足さない**（ランタイムの依存は React だけ、を崩さない）。
 *
 * 持つのは 1 レコードだけ。`AppData` を丸ごと入れる。
 *
 * **日単位のレコードには割っていない。** 割る値打ちは書き込みのほうにあって
 * （変わった日だけ書ける）、読み出しは結局その場で組み直すことになる。
 * 割らない理由は大きさではなく、**測ったら支配的でなかった**から。
 * 10年ぶん（1,337KB）の生成データで、書き込み 47ms に対して
 * 導出（日平均・移動平均・週次集計・種目別集計）が 113ms かかる。
 * 打鍵のたびに走るのは両方だが、割って軽くなるのは前者だけ。
 * 先に詰めるべきなのは確定の頻度と導出の依存（`useBodyData`）のほう。
 */
const DB_NAME = 'bodymake';
const DB_VERSION = 1;
const STORE = 'app';
const RECORD_KEY = 'data';

let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * IndexedDB が使えるか。
 *
 * 一部のブラウザのプライベートモードでは、`indexedDB` があるのに `open` が失敗する。
 * 存在の有無だけでは判定できないので、実際に開いてみるところまでを可用性とする。
 */
export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB が無い環境'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB を開けない'));
    // 別のタブが古い版を掴んでいる。開けないので呼び出し側が localStorage へ落ちる
    req.onblocked = () => reject(new Error('IndexedDB が別のタブに掴まれている'));
  });

  // 失敗を覚え込ませない。次の起動でもう一度試せるようにする
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const req = fn(transaction.objectStore(STORE));
        // 値が返るのは request、書けたことの保証は transaction の complete。両方を待つ
        transaction.oncomplete = () => resolve(req.result);
        transaction.onabort = () => reject(transaction.error ?? new Error('中断'));
        transaction.onerror = () => reject(transaction.error ?? new Error('失敗'));
      }),
  );
}

/** 入っていなければ null。壊れていても投げるのは呼び出し側で受ける */
export function readRecord<T>(): Promise<T | null> {
  return tx<T | undefined>('readonly', (store) => store.get(RECORD_KEY)).then((v) => v ?? null);
}

/**
 * 丸ごと置き換える。**JSON にしない。**
 * IndexedDB は structured clone で持つので、文字列化の往復が要らない。
 */
export function writeRecord(value: unknown): Promise<void> {
  return tx('readwrite', (store) => store.put(value, RECORD_KEY)).then(() => undefined);
}

/** テストと「すべて削除」用 */
export function deleteRecord(): Promise<void> {
  return tx('readwrite', (store) => store.delete(RECORD_KEY)).then(() => undefined);
}

/** テストから状態を捨てるための入口。開き直せるように promise も落とす */
export function resetDbForTests(): void {
  dbPromise = null;
}

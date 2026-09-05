/**
 * IndexedDB の最小ラッパ。**依存は足さない**（ランタイムの依存は React だけ、を崩さない）。
 *
 * 入れるのは**生データだけ**で、計算した値は入れない（`docs/design-storage.md` §1）。
 *
 * レコードは週ごと（`w:YYYY-MM-DD`）と、週に属さないもの（`meta`）に分けてある。
 * **分ける目的は書き込みの局所化**で、読み込みは起動時に全部読む。
 * 値を 1 つ打ったときに書き直すのが全期間ではなくその週だけになるので、
 * 1 回の保存が記録の量によらず一定になる（10 年ぶんで 35.8ms → 0.04ms）。
 *
 * 読み込みは局所化しない。開始値・最長連続記録・通算といった全期間の数字を出す以上、
 * 古い週を読まずに済ませるには結果を保存するしかなく、それは §1 に反する。
 */
const DB_NAME = 'bodymake';
const DB_VERSION = 1;
const STORE = 'app';
/** 週に割る前の、丸ごと 1 レコードだった頃のキー。引き取りのためだけに残す */
export const LEGACY_RECORD_KEY = 'data';

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
  return tx<T | undefined>('readonly', (store) => store.get(LEGACY_RECORD_KEY)).then(
    (v) => v ?? null,
  );
}

/**
 * 丸ごと置き換える。**JSON にしない。**
 * IndexedDB は structured clone で持つので、文字列化の往復が要らない。
 */
export function writeRecord(value: unknown): Promise<void> {
  return tx('readwrite', (store) => store.put(value, LEGACY_RECORD_KEY)).then(() => undefined);
}

/** テストと、旧版レコードの後片付け用 */
export function deleteRecord(): Promise<void> {
  return tx('readwrite', (store) => store.delete(LEGACY_RECORD_KEY)).then(() => undefined);
}

/** 入っているものを全部読む。起動時の 1 回だけ呼ぶ */
export function readAll(): Promise<[string, unknown][]> {
  return openDb().then(
    (db) =>
      new Promise<[string, unknown][]>((resolve, reject) => {
        const transaction = db.transaction(STORE, 'readonly');
        const store = transaction.objectStore(STORE);
        const keys = store.getAllKeys();
        const values = store.getAll();
        transaction.oncomplete = () =>
          resolve((keys.result as string[]).map((k, i) => [k, values.result[i]]));
        transaction.onabort = () => reject(transaction.error ?? new Error('中断'));
        transaction.onerror = () => reject(transaction.error ?? new Error('失敗'));
      }),
  );
}

/**
 * まとめて書き換える。**1 つのトランザクションで行う。**
 *
 * 週をまたぐ編集で複数のレコードが変わることがある。別々に書くと、
 * 途中で落ちたときに週どうしの辻褄が合わなくなる。
 */
export function writeMany(
  puts: readonly [string, unknown][],
  deletes: readonly string[] = [],
): Promise<void> {
  if (puts.length === 0 && deletes.length === 0) return Promise.resolve();
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE, 'readwrite');
        const store = transaction.objectStore(STORE);
        for (const [key, value] of puts) store.put(value, key);
        for (const key of deletes) store.delete(key);
        transaction.oncomplete = () => resolve();
        transaction.onabort = () => reject(transaction.error ?? new Error('中断'));
        transaction.onerror = () => reject(transaction.error ?? new Error('失敗'));
      }),
  );
}

/** 入っているものを全部消す。テストと「すべて削除」用 */
export function clearAllRecords(): Promise<void> {
  return tx('readwrite', (store) => store.clear()).then(() => undefined);
}

/** テストから状態を捨てるための入口。開き直せるように promise も落とす */
export function resetDbForTests(): void {
  dbPromise = null;
}

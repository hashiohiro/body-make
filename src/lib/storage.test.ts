import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { currentBackend, emptyData, flushSave, loadData, saveData, storedBytes } from './storage';
import { deleteRecord, readRecord, resetDbForTests } from './db';
import type { AppData } from '../types';

const DATA_KEY = 'bodymake.data.v1';
const STORE_KEY = 'bodymake.store.v1';

/** localStorage を持たない環境で動かすための最小実装（training.test.ts と同じ器） */
class MemStorage {
  protected store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  clear() {
    this.store.clear();
  }
  getItem(k: string) {
    return this.store.get(k) ?? null;
  }
  key(i: number) {
    return [...this.store.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.store.delete(k);
  }
  setItem(k: string, v: string) {
    this.store.set(k, String(v));
  }
}

/** 書けないブラウザ（容量超過・プライベートモード）の再現 */
class FullStorage extends MemStorage {
  override setItem(): never {
    throw new DOMException('QuotaExceededError');
  }
}

const useStorage = (s: unknown) => {
  (globalThis as { localStorage?: unknown }).localStorage = s;
};

const realIndexedDB = globalThis.indexedDB;

/** IndexedDB を開けない環境の再現。開けなければ localStorage へ落ちる */
function breakIndexedDb() {
  Object.defineProperty(globalThis, 'indexedDB', { value: undefined, configurable: true });
  resetDbForTests();
}

function withWeight(kg: number): AppData {
  return {
    ...emptyData(),
    entries: {
      '2026-03-01': { am: { weight: kg, bodyFat: null }, pm: { weight: null, bodyFat: null } },
    },
  };
}

beforeEach(async () => {
  useStorage(new MemStorage());
  Object.defineProperty(globalThis, 'indexedDB', { value: realIndexedDB, configurable: true });
  resetDbForTests();
  await deleteRecord();
});

afterEach(() => {
  Object.defineProperty(globalThis, 'indexedDB', { value: realIndexedDB, configurable: true });
  resetDbForTests();
});

describe('保存先', () => {
  it('IndexedDB が開ければ、そちらに書く', async () => {
    await loadData();
    expect(currentBackend()).toBe('idb');

    expect(await saveData(withWeight(68.4))).toBe(true);
    const record = await readRecord<AppData>();
    expect(record?.entries['2026-03-01']?.am.weight).toBe(68.4);
    // 旧版の保存先は使わない
    expect(localStorage.getItem(DATA_KEY)).toBeNull();
  });

  /*
   * 一部のプライベートモードでは indexedDB.open が通らない。
   * ここで記録を失わせないために、従来どおり localStorage を使う。
   */
  it('IndexedDB が開けなければ localStorage へ落ちる', async () => {
    breakIndexedDb();
    await loadData();
    expect(currentBackend()).toBe('local');

    expect(await saveData(withWeight(70))).toBe(true);
    expect(localStorage.getItem(DATA_KEY)).toContain('70');
  });

  it('落とし先も書けなければ false。投げずに返す', async () => {
    breakIndexedDb();
    await loadData();
    useStorage(new FullStorage());
    expect(await saveData(emptyData())).toBe(false);
  });
});

describe('旧版からの引き取り', () => {
  it('localStorage にある記録を IndexedDB へ移す', async () => {
    localStorage.setItem(
      DATA_KEY,
      JSON.stringify({
        version: 7,
        entries: { '2026-03-01': { am: { weight: 68.4, bodyFat: 21.3 } } },
      }),
    );

    const data = await loadData();
    expect(data.entries['2026-03-01']?.am.weight).toBe(68.4);

    // 移った先にも入っている
    const record = await readRecord<AppData>();
    expect(record?.entries['2026-03-01']?.am.weight).toBe(68.4);
  });

  /*
   * 残すと、そのコピーは日ごとに古くなる。IndexedDB を開けなかった起動でそれを読むと、
   * 古い記録を本物として見せ、そこへ打ち込んで上書きすることになる。
   * 空に見えるより、それらしく見えて違うほうが悪い。
   */
  it('移したら、旧版のコピーは消す', async () => {
    localStorage.setItem(DATA_KEY, JSON.stringify({ version: 7, entries: {} }));
    await loadData();

    expect(localStorage.getItem(DATA_KEY)).toBeNull();
    expect(localStorage.getItem(STORE_KEY)).toBe('idb');
  });

  it('移したあとに書かれた旧版の記録は、もう読まない', async () => {
    await loadData();
    await saveData(withWeight(60));
    // 印を書く前のビルドが残していったコピーが、あとから見つかったとしても
    localStorage.setItem(DATA_KEY, JSON.stringify({ version: 7, entries: {} }));

    resetDbForTests();
    const data = await loadData();
    expect(data.entries['2026-03-01']?.am.weight).toBe(60);
    // 見なかっただけでなく、片付ける
    expect(localStorage.getItem(DATA_KEY)).toBeNull();
  });
});

describe('移行済みなのに開けなかったとき', () => {
  /*
   * ここで localStorage へ落ちてはいけない。落ちると移行時点の古い記録
   * （あるいは空）を本物として見せ、そこへ打ち込んだ内容で上書きしてしまう。
   */
  it('旧版へ落ちない。どこにも書かない', async () => {
    await loadData();
    await saveData(withWeight(68.4));
    expect(localStorage.getItem(STORE_KEY)).toBe('idb');

    breakIndexedDb();
    const data = await loadData();

    expect(currentBackend()).toBe('none');
    // 記録は読めていないので、空を返す
    expect(Object.keys(data.entries)).toHaveLength(0);
    // その空を保存しない。保存できなかったことは呼び出し側へ返す
    expect(await saveData(data)).toBe(false);
    expect(localStorage.getItem(DATA_KEY)).toBeNull();
  });

  it('開けるようになれば、そのまま元の記録に戻る', async () => {
    await loadData();
    await saveData(withWeight(68.4));

    breakIndexedDb();
    await loadData();
    await saveData(emptyData());

    Object.defineProperty(globalThis, 'indexedDB', { value: realIndexedDB, configurable: true });
    resetDbForTests();
    const data = await loadData();
    expect(data.entries['2026-03-01']?.am.weight).toBe(68.4);
  });

  /** 一度も IndexedDB を使えていない端末は、従来どおり localStorage で動く */
  it('印が無ければ、これまでどおり localStorage を使う', async () => {
    breakIndexedDb();
    await loadData();
    expect(currentBackend()).toBe('local');
    expect(await saveData(withWeight(70))).toBe(true);
  });
});

describe('書き込みのまとめ', () => {
  /*
   * 連続して打っているあいだ、途中の版をすべて書く意味はない。
   * 最後の 1 つが残っていれば、打った内容は失われない。
   */
  it('書き込み中に来た変更は、最新の 1 つにまとまる', async () => {
    await loadData();
    void saveData(withWeight(1));
    void saveData(withWeight(2));
    await saveData(withWeight(3));
    await flushSave();

    const record = await readRecord<AppData>();
    expect(record?.entries['2026-03-01']?.am.weight).toBe(3);
  });

  it('flushSave は書き込み中のものが片付くまで待つ', async () => {
    await loadData();
    void saveData(withWeight(42));
    await flushSave();
    expect((await readRecord<AppData>())?.entries['2026-03-01']?.am.weight).toBe(42);
  });
});

describe('保存サイズ', () => {
  it('記録が増えれば増える', () => {
    expect(storedBytes(withWeight(68))).toBeGreaterThan(storedBytes(emptyData()));
  });

  it('JSON の長さで測る（増え方を読むための目盛り）', () => {
    const data = emptyData();
    expect(storedBytes(data)).toBe(JSON.stringify(data).length);
  });
});

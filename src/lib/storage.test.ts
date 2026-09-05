import { beforeEach, describe, expect, it } from 'vitest';
import { STORAGE_BUDGET_BYTES, emptyData, saveData, storedBytes } from './storage';

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

describe('保存の成否', () => {
  it('書ければ true', () => {
    useStorage(new MemStorage());
    expect(saveData(emptyData())).toBe(true);
  });

  /*
   * ここが false を返さないと、打った値が画面に出たまま保存されず、
   * 次に開いたときに消えている。握りつぶしに戻さないための番人。
   */
  it('書けなければ false。投げずに返す', () => {
    useStorage(new FullStorage());
    expect(saveData(emptyData())).toBe(false);
  });
});

describe('保存サイズ', () => {
  beforeEach(() => useStorage(new MemStorage()));

  it('上限と同じ物差し（UTF-16 の 2 バイト）で数える', () => {
    // 文字数で数えると上限の半分に見えてしまう
    const data = emptyData();
    expect(storedBytes(data)).toBe(JSON.stringify(data).length * 2);
  });

  it('日本語 1 文字も英数字 1 文字も 2 バイトとして数える', () => {
    const ascii = { ...emptyData(), presets: [{ id: 'a', name: 'ab', exerciseIds: ['x'] }] };
    const kana = { ...emptyData(), presets: [{ id: 'a', name: '胸日', exerciseIds: ['x'] }] };
    expect(storedBytes(kana)).toBe(storedBytes(ascii));
  });

  it('記録が増えれば増える', () => {
    const before = storedBytes(emptyData());
    const after = storedBytes({
      ...emptyData(),
      entries: {
        '2026-03-01': {
          am: { weight: 68.4, bodyFat: 21.3 },
          pm: { weight: 67.9, bodyFat: 21.6 },
        },
      },
    });
    expect(after).toBeGreaterThan(before);
  });

  it('空の状態は目安の 5MB からはるか下にある', () => {
    expect(storedBytes(emptyData())).toBeLessThan(STORAGE_BUDGET_BYTES / 1000);
  });
});

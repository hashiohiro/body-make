import { beforeEach, describe, expect, it } from 'vitest';
import { loadDevice, markExported, patchDevice, snoozeOver } from './device';
import { addDays, todayISO } from './date';

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

describe('端末の覚え書き', () => {
  beforeEach(() => useStorage(new MemStorage()));

  it('何も書いていない端末は、すべて null で始まる', () => {
    expect(loadDevice()).toEqual({
      exportedAt: null,
      backupClosedAt: null,
      installClosedAt: null,
    });
  });

  it('書き出すと、その日が残る', () => {
    expect(markExported().exportedAt).toBe(todayISO());
    expect(loadDevice().exportedAt).toBe(todayISO());
  });

  it('壊れた値は null に落ちる（日付以外を指標にしない）', () => {
    localStorage.setItem(
      'bodymake.device.v1',
      JSON.stringify({ exportedAt: 'きのう', backupClosedAt: 42 }),
    );
    expect(loadDevice().exportedAt).toBeNull();
    expect(loadDevice().backupClosedAt).toBeNull();
  });

  it('書けない端末でも投げない。案内が出続けるだけで記録は失われない', () => {
    useStorage(new FullStorage());
    expect(() => patchDevice({ backupClosedAt: todayISO() })).not.toThrow();
  });
});

describe('案内を閉じたあとの間隔', () => {
  beforeEach(() => useStorage(new MemStorage()));

  it('一度も閉じていなければ出す', () => {
    expect(snoozeOver(null)).toBe(true);
  });

  it('閉じた当日は出さない', () => {
    expect(snoozeOver(todayISO())).toBe(false);
  });

  it('29日目は出さない、30日目から出す', () => {
    expect(snoozeOver(addDays(todayISO(), -29))).toBe(false);
    expect(snoozeOver(addDays(todayISO(), -30))).toBe(true);
  });
});

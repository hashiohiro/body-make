import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { ja } from './ja';
import type { MessageKey } from './ja';
import { en } from './en';

export type { MessageKey } from './ja';

/** 実際に出す言語。**2 つだけ**（`docs/design-i18n.md`） */
export type Locale = 'ja' | 'en';

/** 設定で選べるもの。テーマ（`ThemePref`）と同じ形——端末に従うか、名指しか */
export type LocalePref = 'system' | Locale;

/** 持っている言語ぜんぶ。**辞書に無いものを両方で突き合わせる**ときに使う */
export const LOCALES: readonly Locale[] = ['ja', 'en'];

export const LOCALE_PREFS: LocalePref[] = ['system', 'ja', 'en'];

export function isLocalePref(value: unknown): value is LocalePref {
  return typeof value === 'string' && (LOCALE_PREFS as string[]).includes(value);
}

const DICTS: Record<Locale, Record<MessageKey, string>> = { ja, en };

/**
 * 端末の言語。**日本語かどうかだけを見る。**
 *
 * 持っているのが 2 つなので、`ja` で始まらないものはすべて英語に寄せる。
 * 細かく判定しても、出せる言語が増えるわけではない。
 */
export function deviceLocale(): Locale {
  const tag = typeof navigator === 'undefined' ? '' : (navigator.language ?? '');
  return tag.toLowerCase().startsWith('ja') ? 'ja' : 'en';
}

export function resolveLocale(pref: LocalePref): Locale {
  return pref === 'system' ? deviceLocale() : pref;
}

/** 差し込む値。`{n}` のような穴を埋める */
export type Vars = Record<string, string | number>;

/**
 * 文言を取り出す。**語順は辞書が決める。**
 *
 * `${a}と${b}` のような組み立てをコードに残さない——英語では順が変わるので、
 * 組み立てた場所すべてを直して回ることになる。穴は `{n}` で辞書側に開ける。
 *
 * **辞書に無いキーはキーの文字列をそのまま返す。**画面が空白になるより、
 * `settings.language` と出ているほうが原因に辿り着ける。
 */
export function translate(locale: Locale, key: MessageKey, vars?: Vars): string {
  const raw = DICTS[locale][key] ?? ja[key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  );
}

/**
 * 文言を引くもの。**いまの言語も一緒に持ち歩く。**
 *
 * 辞書に置かないもの（カタログの種目名）を引くのに言語が要る場所があり、
 * そこだけ `locale` を別の引数で通すと、途中の関数すべてに引数が 1 本増える。
 * 文言を引く相手と言語は必ず同じものなので、1 つにまとめてある。
 */
export interface T {
  (key: MessageKey, vars?: Vars): string;
  readonly locale: Locale;
}

/** `T` を作る。**作り方を 1 か所にする**——画面も試験もこれを使う */
export function makeT(locale: Locale): T {
  return Object.assign((key: MessageKey, vars?: Vars) => translate(locale, key, vars), { locale });
}

const LocaleContext = createContext<{ locale: Locale; t: T }>({
  locale: 'ja',
  t: makeT('ja'),
});

/**
 * 言語を下すべてに配る。**`WeightUnitProvider` と同じ作法。**
 *
 * 文言を出す場所は画面中に散っていて、末端まで props で通すと、
 * 文言に関係のない中間の部品にも引数が生える。
 */
export function LocaleProvider({ pref, children }: { pref: LocalePref; children: ReactNode }) {
  const value = useMemo(() => {
    const locale = resolveLocale(pref);
    return { locale, t: makeT(locale) };
  }, [pref]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/** 文言を取り出すフック。画面側はこれだけを使う */
export function useT(): T {
  return useContext(LocaleContext).t;
}

/** いまの言語。日付の書式など、文言ではないものを出すときに使う */
export function useLocale(): Locale {
  return useContext(LocaleContext).locale;
}

import { describe, expect, it } from 'vitest';
import { ja } from './ja';
import { en } from './en';
import { deviceLocale, isLocalePref, resolveLocale, translate } from './index';
import { CATALOG } from '../exerciseCatalog';
import { CATALOG_NAMES_EN } from '../catalogNames.en';

/**
 * 文言の抜け漏れを機械で落とす（`docs/design-i18n.md` §10）。
 *
 * 規約は守られない。書く量が多いほど、書き忘れも書き足しも起きる。
 * 型で落ちるもの（英語の訳し忘れ・キーの打ち間違い）は型に任せ、
 * ここが見るのは**型では見えないもの**だけ。
 *
 * ソースは **`import.meta.glob` で読む**。`node:fs` を使うと `@types/node` が要り、
 * アプリ側の tsconfig に Node の型を持ち込むことになる（画面のコードからも
 * `process` が見えてしまう）。Vite が持っている口で足りる。
 */

const SOURCES = Object.fromEntries(
  Object.entries(
    import.meta.glob('/src/**/*.{ts,tsx}', {
      query: '?raw',
      import: 'default',
      eager: true,
    }) as Record<string, string>,
  ).map(([path, code]) => [path.replace(/^\//, ''), code]),
);

const FILES = Object.keys(SOURCES).sort();

/** 同じ日本語を 2 つのキーに入れてよいもの。**語が同じでも意味が違うとき**だけ */
const SAME_WORD_OK: Record<string, string> = {
  日: '曜日の「日」（Sun）と、日数の単位の「日」（days）。英語では別の語になる',
  月: '曜日の「月」（Mon）と、カレンダーの範囲の「月」（Month）。英語では別の語になる',
  目標: '種目カードのボタン（Goal・1 つの目標）と、タブ（Goals・目標の一覧）。英語では単数と複数に分かれる',
  記録あり:
    'カレンダーの日（recorded・その日に記録がある）と、カタログの種目の札（Has records・その種目に記録がある）。主語が違い、英語では別の語になる',
};

/**
 * **剥がさないと決めた面。**理由を書く——書けないものは剥がす。
 *
 * 「まだ剥がしていない面」の一覧はもう無い（全部剥がし終わったので配列ごと消した）。
 * 残っているのはここだけで、**増やすときは理由が要る。**
 *
 * リストに無いファイルに日本語が残っていたら落ちる（剥がし漏れ）。
 * リストにあるファイルから日本語が消えても落ちる（理由が要らなくなったのに残っている）。
 * 2 方向あるので腐らない。
 */
const NOT_TRANSLATED: Record<string, string> = {
  'src/lib/exerciseCatalog.ts':
    '種目名の日本語はここが基準で、英名は catalogNames.en.ts が ID から引く（docs/design-i18n.md §4）',
  'src/lib/seed.ts': 'デモの初期データ。作成者の記録そのもので、画面の文言ではない',
  'src/lib/perf.bench.ts':
    '開発者しか走らせない計測の見出し。読むのは作者（docs/design-i18n.md §1.3）',
};

/** 画面のコード。テストと辞書そのものは見ない */
/**
 * 画面の文言を持ちうるコード。**`.ts` も見る**——曜日の文字のように、
 * `lib` に置いてあっても画面に出るものがある。
 */
const SCREENS = FILES.filter(
  (f) => !f.includes('.test.') && !f.startsWith('src/lib/i18n/') && !f.endsWith('.d.ts'),
);

const read = (f: string) => SOURCES[f] ?? '';

/**
 * コメントを落とす。**日本語のほとんどはコメント**なので、
 * これをしないと「べた書き」の検査が全ファイルで落ちる。
 *
 * ブロック（`/* *\/` と `{/* *\/}`）を先に消し、行コメントは
 * **文字列の中の `//` を避けて**消す（`https://` を切らないため）。
 */
function stripComments(code: string): string {
  const noBlock = code.replace(/\/\*[\s\S]*?\*\//g, '');
  return noBlock
    .split('\n')
    .map((line) => {
      let quote: string | null = null;
      for (let i = 0; i < line.length; i++) {
        const c = line[i]!;
        if (quote) {
          if (c === '\\') i++;
          else if (c === quote) quote = null;
          continue;
        }
        if (c === "'" || c === '"' || c === '`') quote = c;
        else if (c === '/' && line[i + 1] === '/') return line.slice(0, i);
      }
      return line;
    })
    .join('\n');
}

const JAPANESE = /[ぁ-んァ-ヶ一-龯]/;

/**
 * 画面に出うる文字列。**文字列リテラルと、JSX の地の文の両方。**
 *
 * 属性と地の文だけを見ていた頃は、3 つの穴があった。
 *
 * - 配列や表の中の文字列（`{ id: 'week', label: '1週' }`）
 * - 中括弧が混じる地の文（`最長 {n}日 · 通算 {m}日`）
 * - `lib` に置いた画面用の定数（曜日の文字など）
 *
 * どれも画面に出るので、**リテラルはぜんぶ見る**ことにした。
 * 見ないのはコメントだけ（`stripComments`）。
 */
function screenText(code: string): string[] {
  const body = stripComments(code);
  const out: string[] = [];
  // 文字列リテラル（' " ` のいずれか）
  for (const m of body.matchAll(/'([^'\n]*)'|"([^"\n]*)"|`([^`]*)`/g)) {
    out.push(m[1] ?? m[2] ?? m[3] ?? '');
  }
  // JSX の地の文。**中括弧の差し込みは落としてから**見る
  for (const m of body.matchAll(/>([^<>]+)</g)) out.push(m[1]!.replace(/\{[^}]*\}/g, ''));
  return out.filter((x) => x.trim() !== '');
}

/** 同じ語を 2 つのキーに入れてよいもの（英語）。理由は `SAME_WORD_OK` と同じ作法 */
const SAME_WORD_OK_EN: Record<string, string> = {
  Back: '画面を戻る Back と、部位の背中 Back。日本語では別の語（戻る／背中）',
};

/** 英語のまま出してよいもの。**その言語の名前は訳さない** */
const JAPANESE_IN_EN_OK: Record<string, string> = {
  'settings.language.ja': '言語の選択肢。日本語は「日本語」と出すのが親切（英語話者にも探せる）',
};

/**
 * 前後に空白を持ってよい値。**値のうしろに条件つきで添えるものだけ。**
 *
 * 文の途中ではないので語順の risk が無い（英語でも同じ位置に付く）。
 * 文を割った跡はここに入れず、`{…}` の穴にする。
 */
const TRAILING_SPACE_OK: Record<string, string> = {
  'check.limit': '見積もり時間のうしろに、上限を決めているときだけ添える',
  'detail.speedSuffix': '有酸素の合計のうしろに、速度を出せるときだけ添える',
  'set.addedTop': 'トップセットのうしろに、加重した日だけ添える',
  'common.listSep': '語をつなぐ区切りそのもの（英語は「, 」なので空白を持つ）',
};

/**
 * 文の途中に差し込む値。**句点で閉じない**——閉じると文が 2 つに割れて読める。
 * `Strong` の `{strong}` に入るものだけがここに載る。
 */
const MID_SENTENCE_OK: Record<string, string> = {
  'checks.needAxial': 'checks.showNote の {strong} に入る',
  'defaults.noteStrong': 'defaults.note の {strong} に入る',
  'unitForm.inputNoteStrong': 'unitForm.inputNote の {strong} に入る',
  'warn.timeMessage': '「{message}を許容済みにする」の {message} に入る',
  'warn.axialMessage': '同上。指摘の文はラベルの中に埋め込まれる',
};

/** 語の重複を数える。**言語ごとに見る**——片方だけ見ても、もう片方で潰れる */
function duplicatesOf(dict: Record<string, string>, allowed: Record<string, string>): string[] {
  const byValue = new Map<string, string[]>();
  for (const [key, value] of Object.entries(dict)) {
    byValue.set(value, [...(byValue.get(value) ?? []), key]);
  }
  return [...byValue.entries()]
    .filter(([value, keys]) => keys.length > 1 && !(value in allowed))
    .map(([value, keys]) => `${value}: ${keys.join(' / ')}`);
}

describe('文言の抜け漏れ', () => {
  /* 同じ語が 2 つのキーに入っていると、片方だけ直る余地が残る */
  it('日本語に重複が無い', () => {
    expect(duplicatesOf(ja, SAME_WORD_OK)).toEqual([]);
  });

  /*
   * **英語も同じように見る。**日本語だけを見ていたので、日本語では
   * 「体重の変化」と「体重変化」に分かれているものが、英語ではどちらも
   * Weight change になっている——という潰れ方に 17 組気づけていなかった。
   */
  it('英語に重複が無い', () => {
    expect(duplicatesOf(en as Record<string, string>, SAME_WORD_OK_EN)).toEqual([]);
  });

  /* 例外に挙げたまま重複が解消していると、なぜ例外なのかが読めなくなる */
  it('重複の例外表が腐っていない', () => {
    const values = Object.values(ja as Record<string, string>);
    const stale = Object.keys(SAME_WORD_OK).filter(
      (word) => values.filter((v) => v === word).length < 2,
    );
    expect(stale).toEqual([]);
  });

  /* 辞書にあるのに誰も引いていないキーは、消し忘れ */
  it('使われていないキーが無い', () => {
    const code = FILES.filter((f) => !f.startsWith('src/lib/i18n/'))
      .map(read)
      .join('\n');
    const unused = Object.keys(ja).filter((key) => !code.includes(`'${key}'`));
    expect(unused).toEqual([]);
  });

  /*
   * **キーを組み立てない。**`t(\`x.${id}\`)` や `t('x.' + id)` をやると、
   * どのキーが使われているか静的に追えなくなり、
   * 「使われていないキー」も「訳し忘れ」も見えなくなる。
   *
   * 表から引く形（`t(o.key)`）は許す。**キーの型（`MessageKey`）で縛られていて、
   * リテラルはその表に書いてある**ので、上の 2 つの検査がそのまま効く。
   */
  it('キーを組み立てていない', () => {
    const bad: string[] = [];
    for (const f of FILES.filter((x) => !x.includes('.test.'))) {
      const code = stripComments(read(f));
      // 見るのは**キーの引数だけ**。差し込みの値（`{ n: a + 1 }`）は最初のコンマの先
      if (/\bt\(\s*`/.test(code) || /\bt\(\s*[^,)]*\+/.test(code)) bad.push(f);
    }
    expect(bad).toEqual([]);
  });

  /*
   * **穴は両方の辞書に同じだけ開ける。**片方に `{n}` が無いと、
   * 差し込んだ値が黙って消える（画面は出るので、見ないと気づけない）。
   */
  it('差し込む穴が日本語と英語でそろっている', () => {
    const holes = (value: string) => [...new Set(value.match(/\{\w+\}/g) ?? [])].sort().join(',');
    const jaAll = ja as Record<string, string>;
    const enAll = en as Record<string, string>;
    const off = Object.keys(jaAll).filter((key) => holes(jaAll[key]!) !== holes(enAll[key]!));
    expect(off).toEqual([]);
  });

  /* 訳し忘れは型では見えない（キーはあって、中身が日本語のまま） */
  it('英語に日本語が残っていない', () => {
    const left = Object.entries(en as Record<string, string>)
      .filter(([key, value]) => JAPANESE.test(value) && !(key in JAPANESE_IN_EN_OK))
      .map(([key, value]) => `${key}: ${value}`);
    expect(left).toEqual([]);
  });

  /*
   * **断片を JSX で繋がない。**前後に空白を持つ値は、たいてい
   * 「`{t('前')}{値}`」と並べた跡（`直近 ` ＋ 数値）。語順が辞書から出ていく。
   */
  it('値を空白で継ぎ足していない', () => {
    const joined = Object.entries(ja)
      .filter(([key, value]) => value !== value.trim() && !(key in TRAILING_SPACE_OK))
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`);
    expect(joined).toEqual([]);
  });

  /*
   * **文として終わるものは句点で閉じる。**「まだ記録がありません。」と
   * 「まだ腹囲の記録がありません」が並んでいた。どちらでもよいが、
   * 揃っていないと書くたびに迷う（多数派の「付ける」に寄せた）。
   */
  it('文が句点で終わっている', () => {
    const SENTENCE = /(です|ます|ません|ました|ませんでした|ください)$/;
    const open = Object.entries(ja as Record<string, string>)
      .filter(([key, value]) => SENTENCE.test(value) && !(key in MID_SENTENCE_OK))
      .map(([key, value]) => `${key}: ${value}`);
    expect(open).toEqual([]);
  });

  /*
   * **文を断片に割らない。**「前」＋ `<b>強める語</b>` ＋ 「後」と並べると、
   * 日本語では通っても**英語では順が変わる**ので、割った場所をすべて直して回ることになる。
   * 強めたい語は `{strong}` の穴にして、`Strong` が埋める。
   */
  it('文を <b> で断片に割っていない', () => {
    const bad = FILES.filter(
      (f) =>
        f.endsWith('.tsx') &&
        !f.includes('.test.') &&
        /\{t\('[^']+'[^}]*\)\}\s*<b>\{t\(/.test(read(f)),
    );
    expect(bad).toEqual([]);
  });

  /* 剥がし終わった面に日本語が残っていたら落とす */
  it('剥がした面に日本語が残っていない', () => {
    const left = SCREENS.filter(
      (f) => !(f in NOT_TRANSLATED) && screenText(read(f)).some((x) => JAPANESE.test(x)),
    );
    expect(left).toEqual([]);
  });

  /* 理由が要らなくなったのに残っていたら落とす（例外表を腐らせない） */
  it('訳さない面の一覧に、もう日本語が無い面が残っていない', () => {
    const done = Object.keys(NOT_TRANSLATED).filter(
      (f) => !screenText(read(f)).some((x) => JAPANESE.test(x)),
    );
    expect(done).toEqual([]);
  });
});

/*
 * 種目名は辞書ではなく ID → 英名の表に置いてある（`docs/design-i18n.md` §4）。
 * 辞書と違って型では突き合わせられないので、ここで両方向を見る。
 */
describe('カタログの種目名', () => {
  it('英名がすべての種目にある', () => {
    const missing = CATALOG.map((c) => c.id).filter((id) => !(id in CATALOG_NAMES_EN));
    expect(missing).toEqual([]);
  });

  it('カタログに無い種目の英名が残っていない', () => {
    const ids = new Set(CATALOG.map((c) => c.id));
    expect(Object.keys(CATALOG_NAMES_EN).filter((id) => !ids.has(id))).toEqual([]);
  });

  it('英名に日本語が混ざっていない', () => {
    const ja = Object.entries(CATALOG_NAMES_EN)
      .filter(([, name]) => JAPANESE.test(name))
      .map(([id]) => id);
    expect(ja).toEqual([]);
  });
});

describe('言語の決め方', () => {
  it('端末に従うか、名指しか', () => {
    expect(isLocalePref('system')).toBe(true);
    expect(isLocalePref('ja')).toBe(true);
    expect(isLocalePref('fr')).toBe(false);
    expect(resolveLocale('en')).toBe('en');
    expect(resolveLocale('system')).toBe(deviceLocale());
  });

  /* 穴は辞書側に開ける。コードで `${a}と${b}` と組み立てない */
  it('差し込みは辞書の穴を埋める', () => {
    expect(translate('ja', 'settings.language')).toBe('言語');
    expect(translate('en', 'settings.language')).toBe('Language');
  });

  /* 無いキーはキーそのものを返す。画面が空白になるより原因に辿り着ける */
  it('知らないキーは、キーをそのまま返す', () => {
    expect(translate('ja', 'no.such.key' as never)).toBe('no.such.key');
  });

  it('英語は日本語と同じ数のキーを持つ', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(ja).sort());
  });
});

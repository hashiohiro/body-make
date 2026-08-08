/**
 * 配布物（dist/）に実際にコードが入った第三者ソフトウェアを洗い出す。
 *
 * 設計方針は「デフォルト拒否」。
 * package.json の dependencies / devDependencies は判定に使わない。ビルドプラグインが
 * ランタイムコードを注入する場合（vite-plugin-pwa の virtual:pwa-register など）、
 * 役割による分類では取りこぼすため。
 *
 * 代わりにソースマップの sources を全件列挙し、自分の src/ 配下を引いた残りを
 * すべて「帰属先の判断が要るもの」として扱う。既知でないものが出たら異常終了する。
 *
 *   node scripts/licenses.mjs          レポート表示
 *   node scripts/licenses.mjs --check  未申告があれば exit 1（CI 用）
 *
 * 事前に `vite build --sourcemap` が必要。
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const DIST = 'dist';
const OWN_SOURCE_DIR = 'src';

/**
 * ソースマップに現れないため自動検出できないもの。
 * バンドラが注入するランタイムヘルパーは生成コードで、sources に出典が残らない。
 * 検出できない以上、目視で確認して手で登録するしかない。
 */
const MANUAL = [
  {
    name: 'vite',
    reason: 'modulepreload polyfill がバンドルに注入される（動的 import を使うため）',
    // 混入していれば必ず出る文字列。消えたら登録を見直す合図になる
    marker: 'modulepreload',
  },
];

/** THIRD-PARTY-NOTICES.txt に記載済みの帰属先。ここに無いものを検出したら落とす */
const DECLARED = {
  react: 'React (Meta Platforms, Inc.)',
  'react-dom': 'React (Meta Platforms, Inc.)',
  scheduler: 'React (Meta Platforms, Inc.)',
  'workbox-core': 'Workbox (Google LLC)',
  'workbox-precaching': 'Workbox (Google LLC)',
  'workbox-routing': 'Workbox (Google LLC)',
  'workbox-strategies': 'Workbox (Google LLC)',
  'workbox-window': 'Workbox (Google LLC)',
  'vite-plugin-pwa': 'vite-plugin-pwa (Anthony Fu)',
  vite: 'Vite (VoidZero Inc. and Vite contributors)',
  /** workbox-build が生成する Service Worker のひな形。中身の workbox は上で申告済み */
  '(generated service worker)': 'Workbox (Google LLC)',
};

function collect(dir, suffix) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...collect(p, suffix));
    else if (e.name.endsWith(suffix)) out.push(p);
  }
  return out;
}

const walk = (dir) => collect(dir, '.map');
const walkJs = (dir) => collect(dir, '.js');

/** Windows と POSIX で表記が割れるため、判定前に必ず / へ寄せる */
const toPosix = (p) => p.replace(/\\/g, '/');

/** ソースマップ 1 エントリを、帰属判断の単位（パッケージ名など）に落とす */
function classify(rawSource) {
  const source = toPosix(rawSource);

  const nm = source.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/);
  if (nm) return nm[1];

  // プラグインが注入する仮想モジュール（node_modules 配下に現れない）
  const virt = source.match(/@([^/]+)\/virtual:/);
  if (virt) return virt[1];

  // 自作コード
  if (source.includes(`/${OWN_SOURCE_DIR}/`) || source.startsWith(`${OWN_SOURCE_DIR}/`)) return null;

  // ビルドツールが OS の一時ディレクトリで生成したコード。
  // POSIX の /tmp/<hash>/ と Windows の AppData/Local/Temp/<hash>/ の両方を拾う
  if (/\/te?mp\/[0-9a-f]{16,}\//i.test(source)) return '(generated service worker)';

  return `(未分類) ${source}`;
}

if (!existsSync(DIST)) {
  console.error(`${DIST}/ がありません。先に \`npx vite build --sourcemap\` を実行してください。`);
  process.exit(1);
}

const maps = walk(DIST);
if (maps.length === 0) {
  console.error('ソースマップが見つかりません。`npx vite build --sourcemap` が必要です。');
  process.exit(1);
}

const found = new Map(); // 単位 -> 出力ファイルの集合
for (const m of maps) {
  const artifact = toPosix(relative(DIST, m)).replace(/\.map$/, '');
  const { sources = [] } = JSON.parse(readFileSync(m, 'utf8'));
  for (const s of sources) {
    const key = classify(s);
    if (!key) continue;
    if (!found.has(key)) found.set(key, new Set());
    found.get(key).add(artifact);
  }
}

const licenseOf = (pkg) => {
  const p = `node_modules/${pkg}/package.json`;
  if (!existsSync(p)) return '-';
  return JSON.parse(readFileSync(p, 'utf8')).license ?? '?';
};

const undeclared = [];
console.log(`配布物に含まれる第三者コード（ソースマップ ${maps.length} 件から復元）\n`);
for (const key of [...found.keys()].sort()) {
  const declared = DECLARED[key];
  if (!declared) undeclared.push(key);
  const mark = declared ? ' ' : '!';
  console.log(
    `${mark} ${key.padEnd(28)} ${licenseOf(key).padEnd(7)} ${declared ?? '★ 未記載'}`,
  );
  for (const a of [...found.get(key)].sort()) console.log(`      ↳ ${a}`);
}

// ソースマップに出ないものは、成果物の中身を直接見て在／不在を確かめる
const jsText = walkJs(DIST)
  .map((f) => readFileSync(f, 'utf8'))
  .join('');
console.log('\n自動検出できない注入コード（成果物を直接検査）\n');
for (const m of MANUAL) {
  const present = jsText.includes(m.marker);
  const declared = DECLARED[m.name];
  if (present && !declared) undeclared.push(m.name);
  const mark = !present ? '-' : declared ? ' ' : '!';
  const state = !present
    ? '検出されず（記載不要になった可能性。要確認）'
    : (declared ?? '★ 未記載');
  console.log(`${mark} ${m.name.padEnd(28)} ${licenseOf(m.name).padEnd(7)} ${state}`);
  console.log(`      ↳ ${m.reason}`);
}

if (undeclared.length > 0) {
  console.error(`\n未申告 ${undeclared.length} 件: ${undeclared.join(', ')}`);
  console.error('THIRD-PARTY-NOTICES.txt に追記し、このファイルの DECLARED にも登録してください。');
  if (process.argv.includes('--check')) process.exit(1);
} else {
  console.log('\nすべて THIRD-PARTY-NOTICES.txt に記載済みです。');
}

console.log(
  '\n注意: ソースマップはコードのみを追跡します。フォント・画像・アイコン・データファイルなど、\n' +
    'モジュールグラフを通らない同梱物は別途、手で確認してください。',
);

/** ルートの THIRD-PARTY-NOTICES.txt を配布物へ同梱する。
 *  正本はルートの 1 つだけにし、public/ 側は生成物として .gitignore する（二重管理を避ける）。 */
import { copyFileSync, mkdirSync } from 'node:fs';

mkdirSync('public', { recursive: true });
copyFileSync('THIRD-PARTY-NOTICES.txt', 'public/THIRD-PARTY-NOTICES.txt');

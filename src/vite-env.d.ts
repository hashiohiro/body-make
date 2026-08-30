/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/** デモ向けビルドでだけ '1'。.env.demo から入る（lib/env.ts で読む） */
interface ImportMetaEnv {
  readonly VITE_DEMO?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** package.json の version。vite.config.ts の define で差し込む */
declare const __APP_VERSION__: string;

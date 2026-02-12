/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TRACKING_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  /**
   * Where the page recitations are served from, without a trailing slash.
   *
   * Unset (the default) means same-origin `/audio`, which is what the API
   * serves locally. The recordings are 2.47 GB, far past what a git repo or a
   * free host's slug can carry, so in production they live in object storage
   * and this points at that bucket instead.
   *
   * Read at BUILD time, not run time — it must be set wherever the client is
   * built, not merely on the running server.
   */
  readonly VITE_AUDIO_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** The app version from client/package.json, defined in vite.config.ts. */
declare const __APP_VERSION__: string;

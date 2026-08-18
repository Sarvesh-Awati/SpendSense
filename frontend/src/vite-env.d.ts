/// <reference types="vite/client" />

/**
 * Build-time configuration exposed to the client.
 *
 * Only `VITE_`-prefixed variables are inlined by Vite, and everything here is
 * embedded in the shipped bundle — so nothing secret may ever be added.
 */
interface ImportMetaEnv {
  /**
   * Origin of the SpendSense API, without a trailing `/api`
   * (e.g. `https://spendsense-api.onrender.com`).
   *
   * Leave unset in development: requests fall back to `/api`, which the Vite
   * dev server proxies to the local backend.
   */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

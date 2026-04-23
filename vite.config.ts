import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { getDevHttpsCredentials } from './vite-dev-https'

/** Dev defaults to HTTP (Cursor Simple Browser + no cert/SSL mismatch). See `npm run dev:https` for phone/LAN. */
function devHintsPlugin(): Plugin {
  return {
    name: 'mydailyapp-dev-hints',
    configureServer(server) {
      return () => {
        const p = server.config.server.port ?? 5170
        const https = Boolean(server.config.server.https)
        if (https) {
          console.log(
            `\n  \x1b[33mTip:\x1b[0m Phone on Wi‑Fi: open \x1b[1mhttps://192.168…:${p}\x1b[0m from \x1b[1mNetwork\x1b[0m below (not \x1b[1mhttp://\x1b[0m).\n`,
          )
        } else {
          console.log(
            `\n  \x1b[33mTip:\x1b[0m Cursor Simple Browser: \x1b[1mhttp://localhost:${p}/\x1b[0m` +
              `  ·  Phone on Wi‑Fi needs TLS → \x1b[1mnpm run dev:https\x1b[0m + \x1b[1mhttps://192.168…\x1b[0m\n`,
          )
        }
      }
    },
  }
}

/** Default 5170; override with `VITE_DEV_PORT` or `PORT` (e.g. `VITE_DEV_PORT=5180 npm run dev`). */
function devPort(): number {
  const raw = process.env.VITE_DEV_PORT ?? process.env.PORT
  if (raw == null || raw === '') return 5170
  const n = Number.parseInt(String(raw), 10)
  if (!Number.isFinite(n) || n < 1 || n > 65535) {
    throw new Error(`Invalid dev port: ${raw}`)
  }
  return n
}

const port = devPort()

/** HTTP by default (Cursor preview, no self-signed cert). Set `VITE_DEV_HTTPS=1` or run `npm run dev:https` for phone on LAN (localStorage needs https:// there). */
const useHttps = process.env.VITE_DEV_HTTPS === '1'
const httpsCredentials = useHttps ? getDevHttpsCredentials() : null

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  /** GitHub Pages project URL: https://jullietprojects.github.io/MyDailyApp/ */
  base: command === 'serve' ? '/' : '/MyDailyApp/',
  plugins: [react(), devHintsPlugin()],
  server: {
    open: true,
    port,
    /** Avoid silent jump 5170→5171 (broken bookmarks / wrong URL). Set \`VITE_ALLOW_PORT_FALLBACK=1\` to allow. */
    strictPort: process.env.VITE_ALLOW_PORT_FALLBACK !== '1',
    host: true,
    ...(httpsCredentials ? { https: httpsCredentials } : {}),
  },
  preview: {
    host: true,
    port,
    strictPort: process.env.VITE_ALLOW_PORT_FALLBACK !== '1',
    ...(httpsCredentials ? { https: httpsCredentials } : {}),
  },
}))

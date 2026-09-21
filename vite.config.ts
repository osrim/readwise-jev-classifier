import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import type { ProxyOptions } from 'vite'
import * as z from 'zod'

// Secrets stay on the dev server. The browser never sees either key.
const Env = z.object({
  READWISE_TOKEN: z.string().min(1),
  TYPESAFE_API_KEY: z.string().min(1),
})

/** Both upstreams reject browser requests and need credentials it must not hold. */
const authProxy = (target: string, header: string): ProxyOptions => ({
  target,
  changeOrigin: true,
  rewrite: (p) => p.replace(/^\/(readwise|jev)/, ''),
  configure: (proxy) => {
    proxy.on('proxyReq', (req) => req.setHeader('Authorization', header))
  },
})

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const parsed = Env.safeParse(env)
  if (!parsed.success) {
    // Warn instead of crashing. The UI is worth opening before the keys are in
    // place, and the proxied calls fail with a plain 401.
    console.warn(`\n[env] missing credentials, API calls will fail:\n${z.prettifyError(parsed.error)}\n`)
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
    server: {
      // Keys match by prefix, so the trailing slash matters. Without it a static
      // asset named `readwise-*.png` goes upstream instead of being served.
      proxy: {
        '/readwise/': authProxy('https://readwise.io', `Token ${env.READWISE_TOKEN ?? ''}`),
        '/jev/': authProxy('https://api.typesafe.ai', `Bearer ${env.TYPESAFE_API_KEY ?? ''}`),
      },
    },
  }
})

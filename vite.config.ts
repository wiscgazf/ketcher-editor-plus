import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import commonjs from 'vite-plugin-commonjs'
import translate from './plugins/translate'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig((config: any) => {
  const env = loadEnv(config.mode, process.cwd())
  const plugins = [react(), translate(env.VITE_APP_ENV)]

  if (env.VITE_APP_ENV !== 'development') {
    plugins.push(
      commonjs({
        filter(id: string) {
          if (
            id.includes('node_modules/ketcher-core/dist') ||
            id.includes('node_modules/ketcher-react/dist') ||
            id.includes('node_modules/ketcher-standalone/dist')
          ) {
            return true
          }
        }
      }) as any
    )
  }
  return {
    ...config,
    plugins,
    resolve: {
      alias: [
        {
          find: '@',
          replacement: resolve('src')
        }
      ]
    },
    define: {
      'process.env': {},
      global: 'global',
      'process.env.VITE_APP_ENV': JSON.stringify(env.VITE_APP_ENV)
    },
    base: env.VITE_APP_ENV === 'iframe' ? './' : '/',
    build: {
      commonjsOptions: {
        transformMixedEsModules: true
      },
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (
              id.includes('node_modules/ketcher-react') ||
              id.includes('node_modules/ketcher-core')
            ) {
              return 'jby.ketcher'
            }
            if (id.includes('node_modules/ketcher-standalone')) {
              return 'jby.standalone'
            }
          }
        }
      }
    }
  }
})

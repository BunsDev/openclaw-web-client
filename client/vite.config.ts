import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const port =
    Number(process.env.CLIENT_PORT) ||
    Number(env.CLIENT_PORT) ||
    Number(env.VITE_CLIENT_PORT) ||
    18800

  return {
    plugins: [react()],
    server: {
      port,
      host: '0.0.0.0',
    },
    preview: {
      port,
      host: '0.0.0.0',
    },
  }
})

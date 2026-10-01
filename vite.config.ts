import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1]
const isUserOrOrgSite = repositoryName?.endsWith('.github.io')
const base = process.env.GITHUB_ACTIONS && repositoryName && !isUserOrOrgSite
  ? `/${repositoryName}/`
  : '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    allowedHosts: ["kenalugpt.local"],
    proxy: {
      "/v1": {
        target: "http://127.0.0.1:1234",
        changeOrigin: true,
      },
    },
  },
})

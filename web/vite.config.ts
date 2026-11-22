import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"

const root = dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, "")
  // Local development: forward API calls to the knowledge service (FastAPI) and Synapse Guard (Express).
  const knowledge = env.KNOWLEDGE_DEV_PROXY ?? "http://localhost:8000"
  const guard = env.GUARD_DEV_PROXY ?? "http://localhost:4000"
  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { "@": resolve(root, "src") } },
    server: {
      proxy: {
        "/api/knowledge": { target: knowledge, changeOrigin: true },
        "/api/auth": { target: guard, changeOrigin: true },
        "/api/guard": { target: guard, changeOrigin: true },
      },
    },
  }
})

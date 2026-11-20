import path from "path"                          // add
import tailwindcss from "@tailwindcss/vite"      // add
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],             // add tailwindcss()
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },  // add
})
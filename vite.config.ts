import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Local development proxy to bypass CORS
      // Maps /aliyun-api/xxx -> https://dashscope.aliyuncs.com/xxx
      '/aliyun-api': {
        target: 'https://dashscope.aliyuncs.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/aliyun-api/, ''),
        secure: false,
      }
    }
  },
  build: {
    outDir: 'dist',
  }
})
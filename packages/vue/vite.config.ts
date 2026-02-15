import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'StreamingMarkdownVue',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      // 确保外部化处理那些你不想打包进库的依赖
      external: ['vue', '@streaming-markdown/core'],
      output: {
        globals: {
          vue: 'Vue',
          '@streaming-markdown/core': 'StreamingMarkdownCore',
        },
      },
    },
    outDir: 'dist',
    sourcemap: true,
  },
});

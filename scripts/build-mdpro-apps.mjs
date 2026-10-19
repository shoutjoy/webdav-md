import { build } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

await build({
  configFile: false,
  plugins: [react(), tailwindcss()],
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    outDir: 'mdpro/Apps/textToAudio',
    emptyOutDir: false,
    minify: true,
    target: 'es2020',
    lib: {
      entry: 'mdpro/Apps/textToAudio/main.tsx',
      name: 'TTS2AudioApp',
      formats: ['iife'],
      fileName: () => 'tts-creator.bundle.js',
      cssFileName: 'tts-creator',
    },
  },
});

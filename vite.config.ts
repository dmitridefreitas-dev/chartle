import { defineConfig } from 'vite';

// Relative base: the build works at any path — GitHub Pages subpath,
// a custom domain, or file://. No router, no server, no config drift.
export default defineConfig({
  base: './',
  build: { target: 'es2022' },
});

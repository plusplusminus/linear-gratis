import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs', 'iife'],
    globalName: 'Pulse',
    dts: true,
    sourcemap: true,
    clean: true,
    target: 'es2020',
    minify: true,
    treeshake: true,
  },
  {
    entry: { 'pulse-loader': 'src/loader.ts' },
    format: ['iife'],
    sourcemap: false,
    clean: false,
    target: 'es2015',
    minify: true,
    treeshake: true,
  },
])

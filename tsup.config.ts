import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    sourcemap: true,
    splitting: false,
  },
  {
    entry: { 'cli/index': 'src/cli/index.ts' },
    format: ['esm'],
    sourcemap: true,
    splitting: false,
  },
  {
    entry: { 'plugin/index': 'src/plugin/index.cts' },
    format: ['cjs'],
    dts: true,
    sourcemap: true,
    splitting: false,
  },
]);

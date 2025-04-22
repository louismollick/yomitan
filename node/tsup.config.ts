import { defineConfig } from 'tsup'
import copy from 'esbuild-plugin-copy';

export default defineConfig({
  entry: ['index.ts'],
  format: ['cjs', 'esm'],
  experimentalDts: true,
  clean: true,
  external: ['esbuild'],
  esbuildPlugins: [
    copy({
      resolveFrom: 'cwd',
      assets: {
        from: ['../ext/templates-display.html'],
        to: ['./dist'],
      },
    }),
  ],
})

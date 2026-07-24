import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  format: 'cjs',
  minify: true,
  platform: 'node',
  target: 'node18',
  outfile: 'dist/extension.cjs',
  external: ['vscode'],
  logLevel: 'info',
});

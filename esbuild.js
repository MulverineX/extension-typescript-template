const esbuild = require('esbuild')
// include this if you need some node support:
// npm i @esbuild-plugins/node-modules-polyfill --save-dev
const { NodeModulesPolyfillPlugin } = require('@esbuild-plugins/node-modules-polyfill')

esbuild.build({
  // supports other types like js or ts
  entryPoints: ['src/index.ts'],
  outdir: 'dist',
  bundle: true,
  sourcemap: true,
  inject: ['./src/util/polyfills.ts'],
  plugins: [
    NodeModulesPolyfillPlugin({
      url: true
    })
  ], // include this if you need some node support
  minify: true,
  format: 'cjs', // needs to be CJS for now
  target: ['es2022'] // don't go over es2022 because quickjs-ng doesn't support it yet https://github.com/quickjs-ng/quickjs/issues/54 primarily the new Set methods
})

// 测试打包脚本：stub 图片资源，映射 @ 别名
const esbuild = require('esbuild')
const path = require('path')

const imageStub = {
  name: 'image-stub',
  setup(build) {
    build.onResolve({ filter: /\.(webp|jpe?g|png|gif|svg)$/ }, args => ({
      path: args.path,
      namespace: 'image-stub'
    }))
    build.onLoad({ filter: /.*/, namespace: 'image-stub' }, () => ({
      contents: 'export default "stub-image"',
      loader: 'js'
    }))
  }
}

esbuild.build({
  entryPoints: ['test/inbound.test.js'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: 'test/inbound.test.bundle.mjs',
  alias: { '@': path.resolve('src') },
  plugins: [imageStub],
  logLevel: 'info'
}).then(() => console.log('bundle ok')).catch(e => {
  console.error(e)
  process.exit(1)
})

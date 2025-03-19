const $ = Bun.$

const exportHack = `module.exports = {
  ...module.exports,
  ...require('@moosync/edk').Exports
}`

async function build() {
    try {
        await $`extism-js -V`.quiet()
    } catch (e) {
        console.error('extism-js CLI not found. Please install the extism-js CLI globally with their install script https://github.com/extism/js-pdk#install-script')
        process.exit(1)
    }

    console.log('Building extension')

    const index = Bun.file('./src/index.ts')
    const indexText = await index.text()

    await index.write(`${indexText}\n\n${exportHack}`)

    await $`bun i && bun esbuild && extism-js dist/index.js -i ./node_modules/@moosync/edk/src/plugin.d.ts -o dist/ext.wasm --skip-opt && mopack --path .`.quiet()

    await index.write(indexText)
}

build()
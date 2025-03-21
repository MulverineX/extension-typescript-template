const $ = Bun.$

async function build() {
    try {
        await $`extism-js -V`.quiet()
    } catch (e) {
        console.error('extism-js CLI not found. Please install the extism-js CLI globally with their install script https://github.com/extism/js-pdk#install-script')
        process.exit(1)
    }

    console.log('Building extension')

    // Should be dist/ext.wasm but moodriver gets upset
    await $`cp package.json dist && bun i && bun esbuild && extism-js dist/index.js -i ./node_modules/@moosync/edk/src/plugin.d.ts -o ./dist/ext.wasm --skip-opt && mopack --path ./dist`.quiet()
}

build()
import * as fs from 'fs/promises'

// Hack to get Bun to watch the extension source for changes
import * as Extension from '../src/index'
import { stripComments } from 'jsonc-parser'

const $ = Bun.$

console.log('Testing moosync extension')

if (!Object.hasOwn(Extension, 'entry')) {
    console.error('No entry function found in extension.')
    process.exit(1)
}

try {
    await $`moodriver -V`.quiet()
} catch (e) {
    console.error('moodriver not found. Please install moodriver globally with `cargo install --git https://github.com/Moosync/moodriver`')
    process.exit(1)
}

await $`bun run build`.quiet()

console.log('Done. Running tests...')

const tests = Object.entries(await fs.readdir('./test'))

let fail = false

for await (const [i, test] of tests) {
    if (test.endsWith('moosync_trace.json')) {
        const trace = JSON.parse(stripComments(await Bun.file('./test/' + test).text()))

        console.log(`Running ${trace.required ? 'required' : 'optional'} test ${Number(i) + 1} of ${tests.length}: ${trace.name}\n   ${trace.description}`)

        if (trace.skip) {
            console.log('   Skipping test')
            continue
        }
        if (trace.invert) {
            console.log('   Inverting test, expecting error')
        }
        console.log('   Running moodriver...')
         
        try {
            const stdout = $`MOOSYNC_LOG=extensions=trace,extism=trace,extism_pdk=debug,app_lib=debug moodriver -vv -t ./test/${test} ./ext.wasm`.lines()

            let extensionLog = ''

            if (process.argv[2] && process.argv[2] === '-v') {
                extensionLog = 'N/A'
                console.log('   Test running in Verbose mode, moodriver output:')
            }

            let extensionLogging = false

            for await (const line of stdout) {
                if (extensionLog === 'N/A') {
                    console.log(line)
                } else {
                    if (extensionLogging === true) {
                        if (line.includes('=== End Extension output ===')) {
                            extensionLogging = false
                        } else {
                            extensionLog += line
                        }
                    } else if (line.includes('=== Extension output ===')) {
                        extensionLogging = true
                    }
                }
            }

            if (extensionLog !== '') {
                if (trace.invert) {
                    console.log('   Extension succeeded, expected error:\n', extensionLog)
                } else {
                    console.log('   Extension output:\n', extensionLog)
                }
            } else {
                console.log('   Extension output not found')
                console.log('   Test failed!')
            }
            
            if (trace.invert) {
                console.log('   Test failed!')
                if (trace.required) {
                    fail = true
                }
            } else {
                console.log('   Test passed!')
            }
        } catch (err) {
            const stdout = err.stdout.text()
            const output = stdout.includes('=== Extension output ===') ? /(?:=== Extension output ===\n)((\n|.)*)(?:=== End Extension output ===)/.exec(stdout)![1].trim() : false

            if (output) {
                if (!trace.invert) {
                    console.log('   Extension failed:\n', output)
                    console.error('   Test failed!')
                    if (trace.required) {
                        fail = true
                    }
                } else {
                    console.log('   Extension failed as expected:\n', output)
                    console.log('   Test passed!')
                }
            } else {
                console.log('   Extension failed to run')
                console.log('   moodriver error:\n', stdout)
                console.log('   Test failed!')

                fail = true
            }
        }
    }
}

if (fail) {
    console.log('Some test(s) failed, check the output above for more information.')

    process.exit(1)
} else {
    console.log(`All ${tests.length} tests passed!`)
}
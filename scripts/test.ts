import * as fs from 'fs/promises'

// Hack to get Bun to watch the extension source for changes
import * as Extension from '../src/index'
import { stripComments } from 'jsonc-parser'

// Super over-engineered test script

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

let requiredTests = 0

let fail = false

for await (const [i, test] of tests) {
    if (test.endsWith('moosync_trace.jsonc')) {
        const trace = JSON.parse(stripComments(await Bun.file('./test/' + test).text()))

        console.log(`Running ${trace.required ? 'required' : 'optional'} test ${Number(i) + 1} of ${tests.length}: ${trace.name}\n   ${trace.description}`)

        if (trace.skip) {
            console.log('   Skipping test')
            continue
        }

        if (trace.required) {
            requiredTests++
        }

        if (trace.invert) {
            console.log('   Inverting test, expecting error')
        }
        console.log('   Running moodriver...')

        let verbose = false

        if (process.argv[2] && process.argv[2] === '-v') {
            verbose = true
            console.log('   Test running in Verbose mode, moodriver output:')
        }

        let extensionLogged = false

        const moodriver = Bun.spawn({
            cmd: ['moodriver', verbose ? '-vv' : '-v', '-t', `./test/${test}`, './ext.wasm'],
            stdout: 'pipe',
            windowsHide: true,
            windowsVerbatimArguments: true,
        })

        const reader = moodriver.stdout.getReader()

        const decoder = new TextDecoder()

        class ShellLine {
            constructor(public rawLine: string, public i: number, public chunkI: number, public lines: number) {}

            get line() {
                return this.rawLine.replace(/\u001b\[.*?m/g, '')
            }
        }
 
        async function* shell() {
            let done = false

            let globalI = 0

            while (!done) {
                const chunk = await reader.read()

                if (chunk.done) {
                    done = true
                } else {
                    let lines = decoder.decode(chunk.value, {stream: true}).split('\n')

                    for (let i = 0; i < lines.length; i++) {
                        yield new ShellLine(lines[i], globalI++, i, lines.length)
                    }
                }
            }
        }

        let extensionLogging: false | string = false

        let fullLog = ''

        let commands = 0

        for await (const { line, rawLine } of shell()) {
            fullLog += rawLine + '\n'

            if (verbose) {
                console.log(line)

                if (line.includes('extism::pdk')) {
                    extensionLogged = true
                }
            } else {
                const timestamp = /^\d+-\d+-\d+T(\d+):(\d+):(\d+)\.(\d+)Z\s+([^]*)$/.exec(line)

                // Newlines in the extension log
                if (timestamp === null && extensionLogging !== false) {
                    const newLine = line.split(/plugin="\w+-\w+-\w+-\w+-\w+"/)
                    console[extensionLogging](`                            ${extensionLogging.length === 5 ? ' ' : ''}${newLine[0]}`)

                    if (newLine[1] === '') {
                        extensionLogging = false
                    }

                    continue
                }

                if (timestamp !== null) {
                    const parsed = /^(\w+)\s+extism::pdk:\s+([^]*)$/.exec(timestamp[5].trim())

                    if (parsed !== null && !parsed[2].startsWith('parsed ext command msg')) {
                        extensionLogged = true

                        const contents = parsed[2].split(/plugin="\w+-\w+-\w+-\w+-\w+"/)

                        const newLine = `     ${timestamp[1]}:${timestamp[2]}:${timestamp[3]}.${timestamp[4]} ${parsed[1].length === 4 ? ' ' : ''}[${parsed[1]}] ${contents[0]}`

                        const endOfLog = contents[1] === ''

                        switch (parsed[1]) {
                            case 'INFO': {
                                console.log(newLine)
                                if (!endOfLog) {
                                    extensionLogging = 'log'
                                }
                            } break
                            case 'DEBUG': {
                                console.debug(newLine)
                                if (!endOfLog) {
                                    extensionLogging = 'log'
                                }
                            } break
                            case 'WARN': {
                                console.warn(newLine)
                                if (!endOfLog) {
                                    extensionLogging = 'warn'
                                }
                            } break
                            case 'ERROR': {
                                console.error(newLine)
                                if (!endOfLog) {
                                    extensionLogging = 'error'
                                }
                            } break
                        }
                    } else {
                        extensionLogging = false
                    }
                } else {
                    if (line.startsWith('Command [')) {
                        const command = line.split(/Command \[\d\/\d\]: /)[1]
                        console.log(`\n     Running event command ${commands++}: ${command}\n`)
                    } else if (line.startsWith('Expected: ')) {

                        console.error(`\n     Received invalid response. ${line}\n`)
                    }
                }
            }
        }

        if ((await moodriver.exited) > 0) {
            if (extensionLogged) {
                if (!trace.invert) {
                    console.error('   Extension failed\n')
                    console.error('   Test failed!')
                    if (trace.required) {
                        fail = true
                    }
                } else {
                    console.log('   Extension failed as expected\n')
                    console.log('   Test passed!')
                }
            } else {
                console.error('   Extension failed to run\n')
                console.error('   moodriver error\n')
                console.error('   Test failed!')
    
                fail = true
            }
        } else {
            if (extensionLogged) {
                if (!trace.invert) {
                    console.log('   Test passed!')
                } else {
                    console.error('   Passed unexpectedly.\n')
                    console.error('   Test failed!')
                }
            } else {
                console.error('   Extension output not found.\n')
                console.error('   moodriver error, full output:\n')
                console.log(fullLog)
                console.error('   Test failed!')
                if (trace.required) {
                    fail = true
                }
            }
        }
    }
}

if (fail) {
    console.error('Some required test(s) failed, check the output above for more information.')

    process.exit(1)
} else {
    if (requiredTests === 0) {
        console.log('Tests were ran, no required tests were found.')
    } else {
        console.log(`All ${tests.length} required tests passed!`)
    }
}
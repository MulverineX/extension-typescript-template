import * as fs from 'fs/promises'

import { stripComments } from 'jsonc-parser'

// Hack to get Bun to watch the extension source for changes
import * as Extension from '../src/index'


// Super over-engineered test script

const $ = Bun.$

console.log('Testing moosync extension')

try {
    await $`moodriver -V`.quiet()
} catch (e) {
    console.error('moodriver not found. Please install moodriver globally with `cargo install --git https://github.com/Moosync/moodriver`')
    process.exit(1)
}

console.log('Building extension...')

await $`bun run build`.quiet()

console.log('Done. Running tests...')

let tests = Object.entries(await fs.readdir('./test')).sort(([i, a], [j, b]) => (Number(a.substring(0, 3))+1) - (Number(b.substring(0, 3))+1))

const args: {
    verbose?: true
    watchMode?: true
    only?: number
} = {}

if (process.argv[2]) {
    for (const arg of process.argv.slice(2)) {
        if (arg === '-v' || arg === '--verbose') {
            args.verbose = true
        } else if (arg === '-w' || arg === '--watchMode') {
            args.watchMode = true
        } else if (arg.startsWith('--only=')) {
            args.only = Number(arg.split('--only=')[1])
        }
    }
}

let requiredTests = 0

let fail = false

for await (const [i, test] of tests) {
    if (test.endsWith('moosync_trace.jsonc') && (args.only === undefined || Number(i)+1 === args.only)) {
        // If this errors its probably because you have trailing commas somewhere
        const trace = JSON.parse(stripComments(await Bun.file('./test/' + test).text()))

        console.log(`Running ${trace.required ? 'required' : 'optional'} test ${Number(i) + 1} of ${tests.length}: ${trace.name}\n   Goal: ${trace.description}`)

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

        if (process.argv[2] && process.argv.slice(2).includes('-v')) {
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
                console.log(rawLine)

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
                        const [ _, expectedString, receivedString ] = /^Expected: (.+), received: (.+)$/.exec(line)!

                        function cleanRustyJSON(object: string) {
                            object = object.replaceAll('Object {', '{')
                            object = object.replaceAll('String("', '"')
                            object = object.replaceAll('Array [', '[')
                            object = object.replaceAll('Number(', '')
                            object = object.replaceAll('),' , ',')
                            object = object.replaceAll(')}' , '}')
                            object = object.replaceAll('Null', 'null')

                            return object
                        }

                        const expected = JSON.parse(cleanRustyJSON(expectedString))

                        const received = JSON.parse(cleanRustyJSON(receivedString))

                        type LiteralUnion<T extends string> = T | string & Record<never, never>

                        type ValueType = number | boolean | LiteralUnion<'<object>' | '<array>' | '<nothing>'>

                        const diffs: [keyPath: (string | number)[], expected: ValueType, received: ValueType][] = []

                        function pathJSON(obj: any, path: (string | number)[]) {
                            for (const [i, key] of Object.entries(path)) {
                                if (Number(i) === (path.length) - 1) {
                                    if (typeof key === 'number') {
                                        return obj[Number(key)]
                                    } else {
                                        return obj[key]
                                    }
                                } else {
                                    if (typeof key === 'number') {
                                        if (obj[Number(key)] === undefined) {
                                            return undefined
                                        } else {
                                            return pathJSON(obj[Number(key)], path.slice(1))
                                        }
                                    } else {
                                        if (obj[key] === undefined) {
                                            return undefined
                                        } else {
                                            return pathJSON(obj[key], path.slice(1))
                                        }
                                    }
                                }
                            }
                        }

                        function traverseJSON(path: (string | number)[], key: string | number, value: any) {
                            const expect = pathJSON(expected, [...path.slice(1), key])

                            const valueType: ValueType = Array.isArray(value) ? '<array>' : typeof value === 'object' ? '<object>' : value

                            if (expect === undefined) {
                                if (value !== null) {
                                    diffs.push([[...path, key], '<nothing>', valueType])
                                }
                            } else if (value === null) {
                                if (typeof expect === 'object') {
                                    const emptyExpect = Object.keys(expect).length === 0
                                    
                                    if (!emptyExpect) {
                                        diffs.push([[...path, key], Array.isArray(expect) ? '<array>' : '<object>', '<nothing>'])
                                    }
                                } else {
                                    diffs.push([[...path, key], expect, '<nothing>'])
                                }
                            } else {
                                const expectType: ValueType = Array.isArray(expect) ? '<array>' : typeof expect === 'object' ? '<object>' : expect

                                if (valueType === '<array>') {
                                    if (expectType === '<array>') {
                                        (value as any[]).forEach((v, k) => {
                                            traverseJSON([...path, key], k, v)
                                        })
                                    } else {
                                        diffs.push([[...path, key], expectType, '<array>'])
                                    }
                                } else if (valueType === '<object>') {
                                    if (expectType === '<object>') {
                                        Object.entries(value).forEach(([k, v]) => {
                                            traverseJSON([...path, key], k, v)
                                        })
                                    } else {
                                        diffs.push([[...path, key], expectType, '<object>'])
                                    }
                                } else if (expect !== 'ignore' && value !== null && expect !== value) {
                                    diffs.push([[...path, key], expect, value])
                                }
                            }
                        }

                        if (received === null) {
                            diffs.push([['$root'], Array.isArray(expected) ? '<array>' : typeof expected === 'object' ? '<object>' : expected, '<nothing>'])
                        } else if (Array.isArray(received)) {
                            if (Array.isArray(expected)) {
                                expected.forEach((value, index) => {
                                    traverseJSON(['$root'], index, value)
                                })
                            } else {
                                diffs.push([['$root'], typeof expected === 'object' ? '<object>' : expected, '<array>'])
                            }
                        } else {
                            if (Array.isArray(expected)) {
                                diffs.push([['$root'], '<array>', typeof received === 'object' ? '<object>' : received])
                            } else {
                                Object.entries(received).forEach(([key, value]) => {
                                    traverseJSON(['$root'], key, value)
                                })
                            }
                        }

                        if (diffs.length === 0) {
                            console.log('\n     Received valid response!')
                        } else {
                            console.error('\n     Received invalid response!')

                            for (const diff of diffs) {
                                const path = diff[0].map((key) => typeof key === 'number' ? `[${key}]` : key).join('.')
                                console.log(`       @ ${path}\n`+
                                    `         Expected: ${diff[1]}\n` +
                                    `         Received: ${diff[2]}`
                                )
                            }
                        }
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

    if (!args.watchMode) {
        process.exit(1)
    }
} else {
    if (requiredTests === 0) {
        console.log('Tests were ran, no required tests were found.')
    } else {
        console.log(`All ${tests.length} required tests passed!`)
    }
}
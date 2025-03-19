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

let fail = false

for await (const [i, test] of tests) {
    if (test.endsWith('moosync_trace.jsonc')) {
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

        let verbose = false

        if (process.argv[2] && process.argv[2] === '-v') {
            verbose = true
            console.log('   Test running in Verbose mode, moodriver output:')
        }

        let extensionLogged = false

        let stdout: undefined | AsyncIterable<string>

        let testFailed = false
         
        try {
            stdout = $`moodriver ${verbose ? '-vv' : '-v'} -t ./test/${test} ./ext.wasm`.lines()
        } catch (err) {
            let _err = err
            testFailed = true
        }

        if (stdout !== undefined) {
            let extensionLogging: false | string = false

            console.log('Does this even run?')

            console.log('function thats getting all of the lines at once, even though it should be async', stdout[Symbol.asyncIterator])

            try {
                const _stdout = stdout[Symbol.asyncIterator]()
                _stdout.next().catch((err) => {

                    console.log('ALL lines are returned in the first `.next()` call:\n', err.stdout.toString())
                })
                for await (const _line of stdout) {
                    console.log('This never runs because the fake AsyncIterator is consumed in the first `.next()` call')
                    if (verbose) {
                        console.log(_line)
    
                        if (_line.includes('extism::pdk')) {
                            extensionLogged = true
                        }
                    } else {
                        const trimmedLine = _line.replace(/\u001b\[.*?m/g, '').trim()
                        const timestamp = /^\d+-\d+-\d+T(\d+):(\d+):(\d+)\.(\d+)Z\s+([^]*)$/.exec(trimmedLine)
    
                        // Newlines in the extension log
                        if (timestamp === null && extensionLogging !== false) {
                            const line = trimmedLine.split(/plugin="\w+-\w+-\w+-\w+-\w+"/)
                            console[extensionLogging](`                            ${extensionLogging.length === 5 ? ' ' : ''}${line[0]}`)
    
                            if (line[1] === '') {
                                extensionLogging = false
                            }
    
                            continue
                        }
    
                        if (timestamp !== null) {
                            const parsed = /^(\w+)\s+extism::pdk:\s+([^]*)$/.exec(timestamp[5].trim())
    
                            if (parsed !== null) {
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
                        }
                    }
                }
            } catch (err) {
                console.log('as soon as the AsyncIterable is consumed it errors out\n', err.stdout.toString(), err.stderr.toString().length)
            }
            

            if (testFailed) {
                if (extensionLogged) {
                    if (!trace.invert) {
                        console.log('   Extension failed\n')
                        console.error('   Test failed!')
                        if (trace.required) {
                            fail = true
                        }
                    } else {
                        console.log('   Extension failed as expected')
                        console.log('   Test passed!')
                    }
                } else {
                    console.log('   Extension failed to run\n')
                    console.log('   moodriver error\n')
                    console.log('   Test failed!')
        
                    fail = true
                }
            } else {
                if (extensionLogged) {
                    if (!trace.invert) {
                        console.log('   Extension output')
                        console.log('   Test passed!')
                    } else {
                        console.log('   Passed unexpectedly.')
                        console.log('   Test failed!')
                    }
                } else {
                    console.log('   Extension output not found.')
                    console.log('   Test failed!')
                    if (trace.required) {
                        fail = true
                    }
                }
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
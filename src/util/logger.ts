import { getSecure } from './extension'

export class LoggerClass {
    private actor: string

    constructor(actor: string) {
        this.actor = actor
    }

    private get debugging() {
        let DEBUGGING: boolean
        try {
            DEBUGGING = getSecure<true>('DEBUGGING')
        } catch (e) {
            DEBUGGING = false
        }
        return DEBUGGING
    }

    info(...messages: any[]) {
        console.log(`[${this.actor}]`, ...messages);
    }

    debug(...messages: any[]) {
        if (this.debugging) {
            console.debug(`[${this.actor}]`, ...messages);
        }
    }

    warn(...messages: any[]) {
        console.warn(`[${this.actor}]`, ...messages);
    }

    error(...messages: any[]) {
        console.error(`[${this.actor}]`, ...messages);
    }
}

export const Logger = (actor: string) => new LoggerClass(actor)

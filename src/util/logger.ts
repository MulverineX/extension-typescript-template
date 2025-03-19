export class LoggerClass {
    private actor: string

    constructor(actor: string) {
        this.actor = actor
    }

    info(...messages: any[]) {
        console.log(`[${this.actor}]`, ...messages);
    }

    warn(...messages: any[]) {
        console.warn(`[${this.actor}]`, ...messages);
    }

    error(...messages: any[]) {
        console.error(`[${this.actor}]`, ...messages);
    }
}

export const Logger = (actor: string) => new LoggerClass(actor)

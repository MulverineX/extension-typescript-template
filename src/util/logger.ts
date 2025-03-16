class LoggerClass {
    private actor: string

    constructor(actor: string) {
        this.actor = actor
    }

    info(...messages: any[]) {
        console.log(`[INFO] [${this.actor}] `, ...messages);
    }

    warn(...messages: any[]) {
        console.warn(`[WARN] [${this.actor}] `, ...messages);
    }

    error(...messages: any[]) {
        console.error(`[ERROR] [${this.actor}] `, ...messages);
    }
}

export const Logger = (actor: string) => new LoggerClass(actor)

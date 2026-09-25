export class FetchWorker {
    private worker: Worker;

    constructor() {
        this.worker = new Worker(
            new URL("./fetchWorker.ts", import.meta.url),
            { type: "module" }
        );
    }

    postMessage(message: unknown) {
        this.worker.postMessage(message);
    }

    set onmessage(handler: ((event: MessageEvent) => void) | null) {
        this.worker.onmessage = handler;
    }

    set onerror(handler: ((event: ErrorEvent) => void) | null) {
        this.worker.onerror = handler;
    }

    terminate() {
        this.worker.terminate();
    }
}
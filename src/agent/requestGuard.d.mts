export interface RequestHandle { id: number; controller: AbortController }
export declare const createRequestGuard: () => { begin(options?: { replace?: boolean }): RequestHandle | null; isCurrent(request: RequestHandle | null): boolean; finish(request: RequestHandle | null): void; cancel(): void }

export declare const ERROR_CODES: readonly string[]
export declare class GatewayError extends Error {
  code: string
  retryable: boolean
  statusCode: number
  constructor(code: string, message: string, options?: { retryable?: boolean; statusCode?: number; providerPayload?: unknown })
}
export declare const toPublicError: (error: unknown, requestId: string) => { code: string; message: string; retryable: boolean; requestId: string }

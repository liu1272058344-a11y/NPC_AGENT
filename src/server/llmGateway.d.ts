export interface GatewayRequest {
  provider: 'deepseek' | 'openai'
  key: string
  model: string
  messages?: Array<{ role: string; content: string }>
  instructions?: string
  schema: Record<string, unknown>
  validate?: (value: unknown) => unknown
  signal?: AbortSignal
  requestId?: string
  logger?: (entry: Record<string, unknown>) => void
}
export declare const requestStructured: (options: GatewayRequest) => Promise<unknown>
export declare const readModelText: (body: any, mode?: 'responses' | 'chat') => string | undefined

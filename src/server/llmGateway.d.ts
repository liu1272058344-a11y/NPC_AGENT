export interface GatewayRequest {
  provider: 'deepseek' | 'openai'
  key: string
  model: string
  messages?: Array<{ role: string; content: string }>
  instructions?: string
  schema: Record<string, unknown>
  signal?: AbortSignal
  requestId?: string
}
export declare const requestStructured: (options: GatewayRequest) => Promise<unknown>

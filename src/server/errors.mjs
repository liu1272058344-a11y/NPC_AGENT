export const ERROR_CODES = Object.freeze([
  'API_ERROR', 'EMPTY_RESPONSE', 'INVALID_SCHEMA', 'PROVIDER_EMPTY_RESPONSE', 'PROVIDER_INVALID_JSON', 'PROVIDER_SCHEMA_MISMATCH',
  'PROVIDER_OUTPUT_TRUNCATED', 'PROVIDER_CONTENT_FILTERED', 'PROVIDER_RATE_LIMITED',
  'PROVIDER_UNAVAILABLE', 'PROVIDER_TIMEOUT', 'REQUEST_ABORTED', 'INVALID_REQUEST',
  'CONFIGURATION_ERROR', 'INVALID_VISUAL_ASSET', 'PROMPT_INVALID', 'IMAGE_PROVIDER_ERROR', 'ASSET_PERSISTENCE_ERROR', 'INTERNAL_ERROR'
])

export class GatewayError extends Error {
  constructor(code, message, options = {}) {
    super(message)
    this.name = 'GatewayError'
    this.code = ERROR_CODES.includes(code) ? code : 'INTERNAL_ERROR'
    this.retryable = options.retryable === true
    this.statusCode = Number.isInteger(options.statusCode) ? options.statusCode : 500
    this.providerPayload = options.providerPayload
  }
}

export const toPublicError = (error, requestId) => {
  const source = error instanceof GatewayError ? error : ERROR_CODES.includes(error?.code) ? new GatewayError(error.code, error.message || '请求失败。', { statusCode: error.statusCode, retryable: error.retryable }) : new GatewayError('INTERNAL_ERROR', '模型请求失败，请稍后重试。')
  return { code: source.code, message: source.message, retryable: source.retryable, requestId }
}

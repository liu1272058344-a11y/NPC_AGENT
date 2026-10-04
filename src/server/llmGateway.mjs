import { GatewayError } from './errors.mjs'

const retryableStatus = new Set([429, 500, 502, 503, 504])
const endpointFor = (provider, model, mode) => {
  if (provider === 'deepseek') return mode === 'responses' ? 'https://api.deepseek.com/responses' : 'https://api.deepseek.com/chat/completions'
  if (provider === 'openai') return mode === 'responses' ? 'https://api.openai.com/v1/responses' : 'https://api.openai.com/v1/chat/completions'
  throw new GatewayError('CONFIGURATION_ERROR', `Unsupported provider: ${provider}`, { statusCode: 400 })
}
const modeFor = (provider, model) => provider === 'deepseek' && /^(deepseek-flash|deepseek-v4-pro)$/.test(model) ? 'responses' : 'chat'
const jsonText = (body, mode) => mode === 'responses'
  ? body.output_text || body.output?.flatMap((item) => item.content || []).find((item) => item.type === 'output_text')?.text
  : body.choices?.[0]?.message?.content
const cleanJsonText = (text) => String(text ?? '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
const parseJson = (text) => {
  const cleaned = cleanJsonText(text)
  if (!cleaned) throw new GatewayError('EMPTY_RESPONSE', '模型没有返回内容。', { retryable: false, statusCode: 502 })
  try { return JSON.parse(cleaned) } catch { throw new GatewayError('INVALID_SCHEMA', '模型返回内容不是有效 JSON。', { retryable: true, statusCode: 502 }) }
}
const providerError = (response, payload) => {
  const status = response.status
  if (status === 429) return new GatewayError('PROVIDER_RATE_LIMITED', '模型服务当前繁忙，请稍后重试。', { retryable: true, statusCode: 429, providerPayload: payload })
  if (retryableStatus.has(status)) return new GatewayError('PROVIDER_UNAVAILABLE', '模型服务暂时不可用，请稍后重试。', { retryable: true, statusCode: 502, providerPayload: payload })
  return new GatewayError('API_ERROR', '模型 API 请求失败，请检查服务配置或稍后重试。', { retryable: status >= 500, statusCode: status >= 400 && status < 500 ? 400 : 502, providerPayload: payload })
}
const inspectCompletion = (body, mode) => {
  if (mode === 'responses') {
    if (body.status === 'incomplete') {
      const reason = body.incomplete_details?.reason
      if (reason === 'content_filter') throw new GatewayError('API_ERROR', '模型输出被内容策略拦截。', { statusCode: 502 })
      throw new GatewayError('API_ERROR', '模型输出被截断。', { statusCode: 502 })
    }
    if (body.status === 'failed') throw new GatewayError('PROVIDER_UNAVAILABLE', '模型生成失败，请稍后重试。', { retryable: true, statusCode: 502 })
  } else {
    const finishReason = body.choices?.[0]?.finish_reason
    if (finishReason === 'length') throw new GatewayError('API_ERROR', '模型输出被截断。', { statusCode: 502 })
    if (finishReason === 'content_filter') throw new GatewayError('API_ERROR', '模型输出被内容策略拦截。', { statusCode: 502 })
  }
}

export async function requestStructured({ provider, key, model, messages = [], instructions = '', schema, signal, requestId = 'unknown', fetchImpl = fetch, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), random = Math.random, timeoutMs = 15000, logger = () => {} }) {
  const mode = modeFor(provider, model)
  const endpoint = endpointFor(provider, model, mode)
  if (signal?.aborted) throw new GatewayError('REQUEST_ABORTED', '请求已取消。', { statusCode: 499 })
  let lastError
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController()
    const abort = () => controller.abort()
    signal?.addEventListener('abort', abort, { once: true })
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const started = Date.now()
    try {
      const repair = attempt > 1
      const body = mode === 'responses'
        ? { model, store: false, instructions: `${instructions}${repair ? '\n上一轮返回不是合法 JSON。请修复并只输出完整 JSON。' : ''}`, input: messages, max_output_tokens: 4000, text: { format: { type: 'json_schema', name: 'npc_forge_result', strict: true, schema } } }
        : { model, messages: [{ role: 'system', content: `${instructions}\n只返回 JSON。${schema ? `\n输出必须符合以下 JSON Schema，包含所有必需字段，不添加 schema 之外的字段：${JSON.stringify(schema)}` : ''}${repair ? '\n上一轮返回不是合法 JSON。请修复并只输出完整 JSON。' : ''}` }, ...messages], response_format: { type: 'json_object' }, max_tokens: 4000, stream: false }
      const response = await fetchImpl(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal })
      const raw = await response.text()
      let payload
      try { payload = raw ? JSON.parse(raw) : {} } catch { throw new GatewayError('API_ERROR', '模型服务返回了无效响应。', { retryable: response.status >= 500, statusCode: 502 }) }
      if (!response.ok) throw providerError(response, payload)
      inspectCompletion(payload, mode)
      const rawResponse = jsonText(payload, mode)
      let value
      try { value = parseJson(rawResponse) } catch (parseError) {
        logger({ requestId, provider, model, attempt, durationMs: Date.now() - started, finishReason: payload.choices?.[0]?.finish_reason || payload.status, usage: payload.usage, errorCode: parseError.code, retrying: attempt < 3 })
        if (parseError.code === 'EMPTY_RESPONSE' || attempt >= 3) throw parseError
        throw parseError
      }
      logger({ requestId, provider, model, attempt, durationMs: Date.now() - started, finishReason: payload.choices?.[0]?.finish_reason || payload.status, usage: payload.usage, retrying: false })
      return value
    } catch (error) {
      if (signal?.aborted) throw new GatewayError('REQUEST_ABORTED', '请求已取消。', { statusCode: 499 })
      const normalized = error instanceof GatewayError ? error : error?.name === 'AbortError' ? new GatewayError('PROVIDER_TIMEOUT', '模型请求超时。', { retryable: true, statusCode: 504 }) : new GatewayError('PROVIDER_UNAVAILABLE', '无法连接模型服务。', { retryable: true, statusCode: 502 })
      lastError = normalized
      const shouldRetry = normalized.retryable && attempt < 3
      logger({ requestId, provider, model, attempt, durationMs: Date.now() - started, errorCode: normalized.code, retrying: shouldRetry })
      if (!shouldRetry) throw normalized
      await sleep(100 * (2 ** (attempt - 1)) + Math.floor(random() * 100))
    } finally {
      clearTimeout(timer); signal?.removeEventListener('abort', abort)
    }
  }
  throw lastError || new GatewayError('INTERNAL_ERROR', '模型请求失败。')
}

import { GatewayError } from './errors.mjs'

const retryableStatus = new Set([429, 500, 502, 503, 504])
const endpointFor = (provider, model, mode) => {
  if (provider === 'deepseek') return mode === 'responses' ? 'https://api.deepseek.com/responses' : 'https://api.deepseek.com/chat/completions'
  if (provider === 'openai') return mode === 'responses' ? 'https://api.openai.com/v1/responses' : 'https://api.openai.com/v1/chat/completions'
  throw new GatewayError('CONFIGURATION_ERROR', `Unsupported provider: ${provider}`, { statusCode: 400 })
}
const modeFor = (provider, model) => provider === 'deepseek' && /^(deepseek-flash|deepseek-v4-pro)$/.test(model) ? 'responses' : 'chat'
export const readModelText = (body, mode = 'responses') => {
  const invalid = () => new GatewayError('INVALID_MODEL_RESPONSE', '模型服务返回的数据结构异常，请重试。', { statusCode: 502 })
  if (!body || typeof body !== 'object' || (body.output !== undefined && !Array.isArray(body.output))) throw invalid()
  if (body.output?.some(item => !item || (item.content !== undefined && !Array.isArray(item.content)))) throw invalid()
  const parts = body?.output?.flatMap(item => item.content || []) || []
  if (parts.some(part => !part || (part.type === 'output_text' && typeof part.text !== 'string'))) throw invalid()
  if (body?.choices?.[0]?.message?.refusal || parts.some(part => part.type === 'refusal'))
    throw new GatewayError('MODEL_REFUSAL', '模型无法处理此生成请求，请调整描述。', { statusCode: 422 })
  const text = mode === 'responses'
    ? (typeof body?.output_text === 'string' && body.output_text.trim() ? body.output_text : parts.filter(part => part.type === 'output_text').map(part => part.text).join(''))
    : body?.choices?.[0]?.message?.content
  if (text != null && typeof text !== 'string') throw invalid()
  if (mode === 'chat' && (!Object.hasOwn(body.choices?.[0]?.message || {},'content') || body.choices?.[0]?.message?.tool_calls?.length)) throw invalid()
  if (mode === 'chat' && !body?.choices?.[0]?.message || mode === 'responses' && !body?.output && typeof body?.output_text !== 'string')
    throw new GatewayError('INVALID_MODEL_RESPONSE', '模型服务返回的数据结构异常，请重试。', { statusCode: 502 })
  return text
}
const cleanJsonText = (text) => String(text ?? '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
const parseJson = (text) => {
  const cleaned = cleanJsonText(text)
  if (!cleaned) throw new GatewayError('EMPTY_RESPONSE', '模型未返回有效内容，请重试。', { retryable: true, statusCode: 502 })
  try { return JSON.parse(cleaned) } catch { throw new GatewayError('INVALID_JSON', 'AI 返回的 JSON 格式异常，请重试。', { retryable: true, statusCode: 502 }) }
}
// Strict provider schemas require nullable optional properties and an object root.
const strictSchema = schema => {
  const result = structuredClone(schema)
  delete result.$schema
  const visit = node => {
    if (node.type === 'object') {
      if (!node.properties || node.additionalProperties !== false) return false
      const required = new Set(node.required || [])
      for (const [key, value] of Object.entries(node.properties)) {
        if (!visit(value)) return false
        if (!required.has(key)) node.properties[key] = { anyOf: [value, { type: 'null' }] }
      }
      node.required = Object.keys(node.properties)
    }
    if (node.items && !visit(node.items)) return false
    for (const child of node.anyOf || []) if (!visit(child)) return false
    return true
  }
  return visit(result) ? result : null
}
const removeOptionalNulls = (value, schema) => {
  if (!value || typeof value !== 'object') return value
  const branch = schema.anyOf?.find(s => s.properties?.status?.const === value.status) || schema.anyOf?.[0] || schema
  if (Array.isArray(value)) return value.map(item => removeOptionalNulls(item, branch.items || {}))
  return Object.fromEntries(Object.entries(value).filter(([key, entry]) => entry !== null || !Object.hasOwn(branch.properties || {},key) || (branch.required || []).includes(key)).map(([key, entry]) => [key, removeOptionalNulls(entry, branch.properties?.[key] || {})]))
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

export async function requestStructured({ provider, key, model, messages = [], instructions = '', schema, validate, signal, requestId = 'unknown', fetchImpl = fetch, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), random = Math.random, timeoutMs = 15000, logger = (entry) => console.debug('[AI_GENERATION_MODEL]', entry) }) {
  const mode = modeFor(provider, model)
  const endpoint = endpointFor(provider, model, mode)
  if (signal?.aborted) throw new GatewayError('REQUEST_ABORTED', '请求已取消。', { statusCode: 499 })
  let lastError
  const strict = strictSchema(schema || {})
  const wrapped = Boolean(strict?.anyOf)
  const outputSchema = wrapped ? { type:'object', properties:{result:strict}, required:['result'], additionalProperties:false } : strict || schema
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    if (signal?.aborted) throw new GatewayError('REQUEST_ABORTED', '请求已取消。', { statusCode: 499 })
    const controller = new AbortController()
    const abort = () => controller.abort()
    signal?.addEventListener('abort', abort, { once: true })
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const started = Date.now()
    const metadata = { requestId, provider, model, attempt, startedAt:new Date(started).toISOString() }
    try {
      const repair = ['EMPTY_RESPONSE','INVALID_JSON','INVALID_SCHEMA'].includes(lastError?.code)
      const body = mode === 'responses'
        ? { model, store: false, instructions: `${instructions}${wrapped ? '\n输出包装为 {"result":符合内容 schema 的对象}。' : ''}${repair ? '\n上一轮返回未通过 JSON 或字段校验。请修复并只输出完整 JSON。' : ''}`, input: messages, max_output_tokens: 4000, text: { format: { type: 'json_schema', name: 'npc_forge_result', strict: true, schema:outputSchema } } }
        : { model, messages: [{ role: 'system', content: `${instructions}\n只返回 JSON。${schema ? `\n输出必须符合以下 JSON Schema，包含所有必需字段，不添加 schema 之外的字段：${JSON.stringify(provider === 'openai' && strict ? outputSchema : schema)}` : ''}${repair ? '\n上一轮返回未通过 JSON 或字段校验。请修复并只输出完整 JSON。' : ''}` }, ...messages], response_format: provider === 'openai' && strict ? { type:'json_schema', json_schema:{name:'npc_forge_result',strict:true,schema:outputSchema} } : { type: 'json_object' }, ...(provider === 'openai' ? {max_completion_tokens:4000} : {max_tokens:4000}), stream: false }
      const response = await fetchImpl(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal })
      const raw = await response.text()
      metadata.httpStatus = response.status; metadata.hasRawResponse = Boolean(raw)
      let payload
      try { payload = raw ? JSON.parse(raw) : {} } catch { if (!response.ok) throw providerError(response); throw new GatewayError('INVALID_MODEL_RESPONSE', '模型服务返回了无效响应。', { statusCode: 502 }) }
      if (!response.ok) throw providerError(response, payload)
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new GatewayError('INVALID_MODEL_RESPONSE','模型服务返回的数据结构异常，请重试。',{statusCode:502})
      metadata.finishReason = payload.choices?.[0]?.finish_reason || payload.status
      metadata.usage = payload.usage ? {total_tokens:payload.usage.total_tokens,input_tokens:payload.usage.input_tokens,output_tokens:payload.usage.output_tokens} : undefined
      inspectCompletion(payload, mode)
      const rawResponse = readModelText(payload, mode)
      metadata.rawContentLength = rawResponse?.length || 0
      let value = parseJson(rawResponse)
      if (strict && (mode === 'responses' || provider === 'openai')) {
        if (wrapped && (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 1 || !Object.hasOwn(value,'result')))
          throw new GatewayError('INVALID_SCHEMA','AI 返回的数据字段异常，请重试。',{statusCode:422,retryable:true})
        value = removeOptionalNulls(wrapped ? value.result : value, schema)
      }
      if (validate) value = validate(value)
      metadata.parsedContentLength = JSON.stringify(value).length; metadata.schemaValidation = validate ? 'success' : 'not_requested'
      logger({ ...metadata, endedAt:new Date().toISOString(), durationMs: Date.now() - started, retrying: false })
      return value
    } catch (error) {
      const normalized = signal?.aborted ? new GatewayError('REQUEST_ABORTED', '请求已取消。', { statusCode: 499 }) : error instanceof GatewayError ? error : error?.name === 'AbortError' ? new GatewayError('PROVIDER_TIMEOUT', '生成超时，请重试。', { retryable: true, statusCode: 504 }) : new GatewayError('PROVIDER_UNAVAILABLE', '无法连接模型服务。', { retryable: true, statusCode: 502 })
      lastError = normalized
      const shouldRetry = normalized.retryable && attempt < 2 && normalized.code !== 'PROVIDER_RATE_LIMITED'
      logger({ ...metadata, endedAt:new Date().toISOString(), durationMs: Date.now() - started, errorCode: normalized.code, message:normalized.message, issues:normalized.issues, schemaValidation:normalized.code === 'INVALID_SCHEMA' ? 'failure' : undefined, retrying: shouldRetry })
      if (!shouldRetry) throw normalized
      await sleep(100 * (2 ** (attempt - 1)) + Math.floor(random() * 100))
    } finally {
      clearTimeout(timer); signal?.removeEventListener('abort', abort)
    }
  }
  throw lastError || new GatewayError('INTERNAL_ERROR', '模型请求失败。')
}

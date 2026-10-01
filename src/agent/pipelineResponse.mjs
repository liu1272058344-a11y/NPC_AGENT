const failureMessage = (payload, status) => {
  if (payload && typeof payload === 'object') return payload.message || payload.error?.message || (typeof payload.error === 'string' ? payload.error : '')
  if (typeof payload === 'string') return payload.trim()
  return `Pipeline 执行失败（HTTP ${status}）`
}

export async function parsePipelineResponse(response) {
  const text = await response.text()
  let payload = null
  if (text.trim()) {
    try { payload = JSON.parse(text) } catch { payload = text }
  }
  if (!response.ok) throw new Error(failureMessage(payload, response.status) || `Pipeline 执行失败（HTTP ${response.status}）`)
  if (!payload || typeof payload !== 'object' || !payload.project || !payload.visual) throw new Error('Pipeline 返回的数据结构不完整。')
  return payload
}

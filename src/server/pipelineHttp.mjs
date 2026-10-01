const noStore = { 'Cache-Control': 'no-store' }

export async function handlePipelineRequest(request, controller) {
  if (request?.method !== 'POST') {
    return {
      status: 405,
      headers: { ...noStore, Allow: 'POST' },
      body: { code: 'METHOD_NOT_ALLOWED', message: '仅支持 POST 请求。', retryable: false }
    }
  }

  const requirement = String(request?.body?.requirement || '').trim()
  if (!requirement) {
    return {
      status: 400,
      headers: noStore,
      body: { code: 'INVALID_REQUEST', message: '请先填写游戏设定。', retryable: false }
    }
  }

  try {
    const output = await controller.run({
      requirement,
      style: String(request?.body?.style || ''),
      assetType: String(request?.body?.assetType || 'character')
    })
    if (String(output?.status || '').toLowerCase() === 'failed') {
      const error = output?.error || output?.errors?.[0] || {}
      return {
        status: 502,
        headers: noStore,
        body: { code: error.code || 'PIPELINE_FAILED', message: error.message || 'Pipeline 执行失败。', retryable: true }
      }
    }
    return { status: 200, headers: noStore, body: output }
  } catch {
    return {
      status: 502,
      headers: noStore,
      body: { code: 'PIPELINE_FAILED', message: 'Pipeline 执行失败，请稍后重试。', retryable: true }
    }
  }
}

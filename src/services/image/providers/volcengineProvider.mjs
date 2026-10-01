export async function generate({ prompt, negativePrompt = '', apiKey, endpoint = 'https://ark.cn-beijing.volces.com', model, size = '1024x1024' }) {
  const response = await fetch(`${endpoint.replace(/\/$/, '')}/api/v3/images/generations`, { method: 'POST', redirect: 'error', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, prompt: negativePrompt ? `${prompt}\nAvoid: ${negativePrompt}` : prompt, response_format: 'url', size, watermark: false }) })
  const raw = await response.text()
  let body = {}
  try { body = raw ? JSON.parse(raw) : {} } catch { throw Object.assign(new Error('火山方舟返回了无法解析的响应'), { code: 'IMAGE_PROVIDER_ERROR', statusCode: response.status || 502 }) }
  if (!response.ok) throw Object.assign(new Error('火山方舟图片请求失败，请检查密钥、额度和模型配置。'), { code: 'IMAGE_PROVIDER_ERROR', statusCode: response.status })
  const image = body?.data?.[0] || body?.images?.[0] || body
  if (!image?.url && !image?.b64_json) throw Object.assign(new Error('火山方舟没有返回图片，请检查模型 ID 和 API Key'), { code: 'IMAGE_PROVIDER_ERROR' })
  return { url: image.url || `data:image/png;base64,${image.b64_json}`, model, size }
}

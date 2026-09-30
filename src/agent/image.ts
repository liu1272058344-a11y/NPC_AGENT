export interface ImageResult { url: string; model: string; size: string }
export interface VisualAssetResult { visualAsset: Record<string, unknown>; prompt: Record<string, unknown>; image: ImageResult & { provider?: string } }
export async function generateImage(prompt: string, negativePrompt = '', apiKey = '', options: { provider?: string; model?: string; endpoint?: string; size?: string } = {}): Promise<ImageResult> {
  if (!apiKey.trim()) throw new Error('请先填写图片模型 API Key')
  const provider = options.provider || 'openai'
  const model = options.model || 'gpt-image-1'
  const size = options.size || '1024x1024'
  const endpoint = (options.endpoint || 'https://api.openai.com/v1').replace(/\/$/, '')
  const request = provider === 'volcengine'
    ? { url: `${endpoint}/api/v3/images/generations`, headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: { model, prompt, response_format: 'url', size } }
    : provider === 'fal'
    ? { url: `${endpoint}/fal-ai/${model}`, headers: { Authorization: `Key ${apiKey}`, 'Content-Type': 'application/json' }, body: { prompt, image_size: size } }
    : provider === 'together'
      ? { url: `${endpoint}/images/generations`, headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: { model, prompt, width: 1024, height: 1024, steps: 4, n: 1 } }
      : { url: `${endpoint}/images/generations`, headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: { model, prompt: negativePrompt ? `${prompt}\nAvoid: ${negativePrompt}` : prompt, size, n: 1 } }
  const finalRequest = provider === 'volcengine'
    ? { url: '/api/image', headers: { 'Content-Type': 'application/json' }, body: { provider, prompt, negativePrompt, apiKey, endpoint, model, size } }
    : request
  const response = await fetch(finalRequest.url, { method: 'POST', headers: finalRequest.headers, body: JSON.stringify(finalRequest.body) })
  const raw = await response.text()
  let body: any = {}
  try { body = raw ? JSON.parse(raw) : {} } catch { throw new Error(`图片服务返回了无法解析的响应（HTTP ${response.status}）`) }
  if (!response.ok) throw new Error(body.message || body.error?.message || body.detail || `图片生成失败（HTTP ${response.status}）`)
  const image = body.data?.[0] || body.images?.[0] || body
  const url = image.url || image.uri || (image.b64_json ? `data:image/png;base64,${image.b64_json}` : image.image?.url)
  if (!url) throw new Error('图片模型返回为空，请检查 Provider、模型和 API Key')
  return { url, model, size }
}

export async function generateVisualAsset(character: Record<string, unknown>, apiKey = ''): Promise<VisualAssetResult> {
  const response = await fetch('/api/visual-assets/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ character, apiKey }) })
  const body = await response.json()
  if (!response.ok) throw new Error(body.message || body.error || '视觉资产生成失败')
  return body as VisualAssetResult
}

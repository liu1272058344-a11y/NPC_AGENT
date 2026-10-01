export interface ImageResult { url: string; model: string; size: string }
export interface VisualAssetResult { visualAsset: Record<string, unknown>; prompt: Record<string, unknown>; image: ImageResult & { provider?: string } }
export async function generateImage(prompt: string, negativePrompt = '', _apiKey = '', options: { provider?: string; model?: string; endpoint?: string; size?: string } = {}): Promise<ImageResult> {
  const provider = options.provider || 'openai'
  const model = options.model || 'gpt-image-1'
  const size = options.size || '1024x1024'
  const response = await fetch('/api/image', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider, prompt, negativePrompt, model, size }) })
  const raw = await response.text()
  let body: any = {}
  try { body = raw ? JSON.parse(raw) : {} } catch { throw new Error(`图片服务返回了无法解析的响应（HTTP ${response.status}）`) }
  if (!response.ok) throw new Error(body.message || body.error?.message || body.detail || `图片生成失败（HTTP ${response.status}）`)
  const image = body.data?.[0] || body.images?.[0] || body
  const url = image.url || image.uri || (image.b64_json ? `data:image/png;base64,${image.b64_json}` : image.image?.url)
  if (!url) throw new Error('图片模型返回为空，请检查 Provider、模型和 API Key')
  return { url, model, size }
}

export async function generateVisualAsset(character: Record<string, unknown>, _apiKey = ''): Promise<VisualAssetResult> {
  const response = await fetch('/api/visual-assets/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ character }) })
  const body = await response.json()
  if (!response.ok) throw new Error(body.message || body.error || '视觉资产生成失败')
  return body as VisualAssetResult
}

export interface ImageResult { url: string; model: string; size: string }
export interface VisualAssetResult { visualAsset: Record<string, unknown>; prompt: Record<string, unknown>; image: ImageResult & { provider?: string } }
export async function generateImage(prompt: string, negativePrompt = '', apiKey = ''): Promise<ImageResult> {
  const response = await fetch('/api/image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, negativePrompt, apiKey }) })
  const body = await response.json()
  if (!response.ok) throw new Error(body.error || '图像生成失败')
  return body as ImageResult
}

export async function generateVisualAsset(character: Record<string, unknown>, apiKey = ''): Promise<VisualAssetResult> {
  const response = await fetch('/api/visual-assets/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ character, apiKey }) })
  const body = await response.json()
  if (!response.ok) throw new Error(body.message || body.error || '视觉资产生成失败')
  return body as VisualAssetResult
}

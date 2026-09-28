export interface ImageResult { url: string; model: string; size: string }
export async function generateImage(prompt: string, negativePrompt = '', apiKey = ''): Promise<ImageResult> {
  const response = await fetch('/api/image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, negativePrompt, apiKey }) })
  const body = await response.json()
  if (!response.ok) throw new Error(body.error || '图像生成失败')
  return body as ImageResult
}

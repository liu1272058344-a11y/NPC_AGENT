export async function generateImage({ prompt, negativePrompt = '', apiKey, endpoint = 'https://api.openai.com/v1', model = 'gpt-image-1', size = '1024x1024' }) {
  if (!prompt?.trim()) throw new Error('image prompt is required')
  if (!apiKey) { const error = new Error('IMAGE_API_KEY 未配置，无法生成图片。'); error.statusCode = 503; throw error }
  const response = await fetch(`${endpoint.replace(/\/$/, '')}/images/generations`, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, prompt: negativePrompt ? `${prompt}\nAvoid: ${negativePrompt}` : prompt, size, n: 1 }) })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) { const error = new Error(body?.error?.message || '图像生成服务请求失败'); error.statusCode = response.status; throw error }
  const image = body?.data?.[0]
  if (!image?.url && !image?.b64_json) throw new Error('图像服务返回为空。')
  return { url: image.url || `data:image/png;base64,${image.b64_json}`, model, size }
}

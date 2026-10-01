export function hostedFlux(provider) {
  return { async generate({ prompt, apiKey, model, size }) {
    if (typeof model !== 'string' || !/^[a-zA-Z0-9_./-]+$/.test(model) || model.includes('..')) throw Object.assign(new Error('模型 ID 无效。'), { statusCode: 400 })
    const fal = provider === 'fal'
    const url = fal ? `https://fal.run/${model.startsWith('fal-ai/') ? model : `fal-ai/${model}`}` : 'https://api.together.xyz/v1/images/generations'
    const response = await fetch(url, { method: 'POST', redirect: 'error', headers: { Authorization: `${fal ? 'Key' : 'Bearer'} ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(fal ? { prompt, image_size: 'square_hd' } : { model, prompt, width: 1024, height: 1024, steps: 4, n: 1 }) })
    if (!response.ok) throw Object.assign(new Error('图片服务请求失败，请检查密钥、额度和模型。'), { statusCode: 502 })
    const body = await response.json()
    const image = body.images?.[0] || body.data?.[0]
    if (!image?.url) throw Object.assign(new Error('图片服务未返回图片。'), { statusCode: 502 })
    return { url: image.url, model, size }
  } }
}

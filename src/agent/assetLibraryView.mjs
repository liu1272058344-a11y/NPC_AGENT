export const createGeneratedImageAsset = (input, id = `image-${Date.now()}`) => ({
  id,
  url: input.url,
  model: input.model,
  size: input.size,
  prompt: input.prompt,
  negativePrompt: input.negativePrompt || '',
  type: input.type || '生成图片',
  sourceId: input.sourceId || '',
  createdAt: new Date().toISOString()
})

export const buildAssetLibraryEntries = (npc, prompts, images = []) => {
  const entries = []
  if (npc) {
    entries.push({
      id: `npc:${npc.id || npc.name}`,
      kind: 'npc',
      title: npc.name,
      subtitle: `${npc.role} · ${npc.world}`,
      detail: '角色档案'
    })
  }
  for (const prompt of prompts) {
    entries.push({
      id: `prompt:${prompt.promptEn}`,
      kind: 'prompt',
      title: prompt.type,
      subtitle: prompt.style,
      detail: 'Prompt 档案 · Version 1',
      prompt
    })
  }
  for (const image of images) {
    entries.push({
      id: `image:${image.id}`,
      kind: 'image',
      title: image.type,
      subtitle: `${image.model} · ${image.size}`,
      detail: '生成图片',
      image
    })
  }
  return entries
}

export const buildAssetLibraryDetail = (entryId, npc, prompts, images = []) => {
  if (npc && entryId === `npc:${npc.id || npc.name}`) return { kind: 'npc', npc, prompts }
  const prompt = prompts.find((item) => entryId === `prompt:${item.promptEn}`)
  if (prompt) return { kind: 'prompt', prompt }
  const image = images.find((item) => entryId === `image:${item.id}`)
  return image ? { kind: 'image', image } : null
}

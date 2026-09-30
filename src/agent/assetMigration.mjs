const readJson = (storage, key, fallback) => { try { const raw = storage.getItem(key); return raw ? JSON.parse(raw) : fallback } catch { return fallback } }

export async function migrateLocalAssetRecords(storage, api) {
  const images = readJson(storage, 'npc-forge-image-library', [])
  const npc = readJson(storage, 'npc-forge-current-npc', null)
  const prompts = readJson(storage, 'npc-forge-asset-library', [])
  const remaining = []
  const result = { migrated: 0, expired: 0, pending: 0, migratedArchives: 0 }
  if (npc || (Array.isArray(prompts) && prompts.length)) {
    const archive = npc ? { id: npc.id || npc.name, name: npc.name, summary: npc.summary || '', profile: npc } : { id: 'legacy-prompts', name: '旧版 Prompt 档案', summary: '从旧版浏览器资产库迁移', profile: {} }
    try { await api.saveRemoteArchive({ archive, prompts: (Array.isArray(prompts) ? prompts : []).map((prompt, index) => ({ id: `legacy-prompt:${index}:${prompt.promptEn || ''}`, prompt: prompt.promptEn || prompt.promptZh || '', negativePrompt: prompt.negativePrompt || '', provider: 'legacy', modelId: '' })) }); result.migratedArchives = 1 } catch { result.pending += 1 }
  }
  for (const image of Array.isArray(images) ? images : []) {
    try {
      const archiveId = image.sourceId || npc?.id || 'legacy-assets'
      await api.saveRemoteImage({ idempotencyKey: `legacy:${image.id}`, sourceUrl: image.url, archive: { id: archiveId, name: npc?.name || image.type || '旧图片资产', summary: npc?.summary || '从旧版浏览器资产库迁移', profile: npc || { type: image.type } }, prompt: { id: `legacy-prompt:${image.id}`, prompt: image.prompt || '', negativePrompt: image.negativePrompt || '', provider: 'legacy', modelId: image.model || '' }, provider: 'legacy', modelId: image.model || '' })
      result.migrated += 1
    } catch (error) {
      if (error?.code === 'SOURCE_EXPIRED' || error?.code === 'ASSET_NOT_FOUND') result.expired += 1
      else { result.pending += 1; remaining.push(image) }
    }
  }
  if (remaining.length) storage.setItem('npc-forge-image-library', JSON.stringify(remaining))
  else storage.removeItem('npc-forge-image-library')
  return result
}

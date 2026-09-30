const readJson = (storage, key, fallback) => { try { const raw = storage.getItem(key); return raw ? JSON.parse(raw) : fallback } catch { return fallback } }

export async function migrateLocalAssetRecords(storage, api) {
  const images = readJson(storage, 'npc-forge-image-library', [])
  if (!Array.isArray(images) || images.length === 0) return { migrated: 0, expired: 0, pending: 0 }
  const npc = readJson(storage, 'npc-forge-current-npc', null)
  const remaining = []
  const result = { migrated: 0, expired: 0, pending: 0 }
  for (const image of images) {
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

const readJson = (storage, key, fallback) => { try { const raw = storage.getItem(key); return raw ? JSON.parse(raw) : fallback } catch { return fallback } }
const stableHash = (value) => {
  let hash = 2166136261
  for (const character of value) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 16777619) }
  return (hash >>> 0).toString(36)
}
export const stableLegacyId = (kind, workspaceId, value) => `legacy-${kind}-${stableHash(`${workspaceId}:${JSON.stringify(value)}`)}`

export async function migrateLocalAssetRecords(storage, api) {
  const images = readJson(storage, 'npc-forge-image-library', [])
  const storedNpc = readJson(storage, 'npc-forge-current-npc', null)
  const storedWorld = readJson(storage, 'npc-forge-current-world', null)
  const workspaceId = api.workspaceId || 'default'
  const world = storedWorld ? {...storedWorld,id:storedWorld.id || stableLegacyId('world',workspaceId,storedWorld)} : null
  const npc = storedNpc ? {...storedNpc,id:storedNpc.id || stableLegacyId('character',workspaceId,storedNpc)} : null
  if (world && !storedWorld.id) storage.setItem('npc-forge-current-world',JSON.stringify(world))
  if (npc && !storedNpc.id) storage.setItem('npc-forge-current-npc',JSON.stringify(npc))
  const prompts = readJson(storage, 'npc-forge-asset-library', [])
  const remaining = []
  const result = { migrated: 0, expired: 0, pending: 0, migratedArchives: 0 }
  const marker=`npc-forge-content-migration:${workspaceId}`
  const fingerprint=JSON.stringify({world,npc,prompts})
  const promptCategories=new Set((Array.isArray(prompts)?prompts:[]).map(classifyLegacyAsset))
  const hasNonCharacterPrompt=[...promptCategories].some(category=>category!=='character' && category!=='unknown')
  const legacyCategory=npc ? (hasNonCharacterPrompt ? 'unknown' : 'character') : (promptCategories.size===1 ? [...promptCategories][0] : 'unknown')
  const legacyArchiveId=npc?.id || stableLegacyId('prompts',workspaceId,prompts)
  if ((world || npc || (Array.isArray(prompts) && prompts.length)) && storage.getItem(marker)!==fingerprint) {
    const archive = npc ? { id: legacyArchiveId, name: npc.name, summary: npc.summary || '', profile: {...npc,category:legacyCategory,needsClassification:legacyCategory==='unknown'} } : { id: 'legacy-prompts', name: '旧版 Prompt 档案', summary: '从旧版浏览器资产库迁移', profile: {category:legacyCategory,needsClassification:legacyCategory==='unknown'} }
    try {
      if (world && api.saveWorld) await api.saveWorld({id:world.id,name:world.name,profile:world})
      if (npc || (Array.isArray(prompts) && prompts.length)) {
        await api.saveRemoteArchive({ archive, prompts: (Array.isArray(prompts) ? prompts : []).map((prompt, index) => ({ id: `legacy-prompt:${index}:${prompt.promptEn || ''}`, prompt: prompt.promptEn || prompt.promptZh || '', promptZh:prompt.promptZh || '',snapshot:{asset:prompt,category:classifyLegacyAsset(prompt)},negativePrompt: prompt.negativePrompt || '', provider: 'legacy', modelId: '' })) })
        result.migratedArchives = 1
      }
      storage.setItem(marker,fingerprint)
    } catch { result.pending += 1 }
  }
  for (const image of Array.isArray(images) ? images : []) {
    try {
      const archiveId = image.sourceId || npc?.id || 'legacy-assets'
      const imageCategory=npc ? legacyCategory : classifyLegacyAsset(image)
      const legacyProfile = npc ? { ...npc, category: imageCategory, needsClassification: imageCategory === 'unknown' } : { type: image.type, category: imageCategory, needsClassification: imageCategory === 'unknown' }
      await api.saveRemoteImage({ idempotencyKey: `legacy:${image.id}`, sourceUrl: image.url, archive: { id: archiveId, name: npc?.name || image.type || '旧图片资产', summary: npc?.summary || '从旧版浏览器资产库迁移', profile: legacyProfile }, prompt: { id: `legacy-prompt:${image.id}`, prompt: image.prompt || '', negativePrompt: image.negativePrompt || '', provider: 'legacy', modelId: image.model || '', snapshot: { category: legacyProfile.category, asset: image } }, provider: 'legacy', modelId: image.model || '' })
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
import { classifyLegacyAsset } from '../content/categories.mjs'

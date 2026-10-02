import { createHash, randomUUID } from 'node:crypto'
import { ASSET_LIMITS, expiresAtFrom } from './config.mjs'
import { fetchSourceImage } from './sourceImage.mjs'
import { classifyLegacyAsset, contentCategories } from '../../content/categories.mjs'

const normalizeImage = (row) => ({
  id: row.id, archiveId: row.archiveId || row.archive_id, promptRecordId: row.promptRecordId || row.prompt_record_id,
  url: row.url || row.blobUrl || row.blob_url, pathname: row.pathname, contentType: row.contentType || row.content_type,
  byteSize: Number(row.byteSize || row.byte_size || 0), width: row.width || undefined, height: row.height || undefined,
  provider: row.provider, modelId: row.modelId || row.model_id, createdAt: row.createdAt || row.created_at, expiresAt: row.expiresAt || row.expires_at
})

const quotaWarning = (usage) => usage.imageCount >= ASSET_LIMITS.maxImages * ASSET_LIMITS.warningRatio || usage.byteCount >= ASSET_LIMITS.maxBytes * ASSET_LIMITS.warningRatio
const normalizeWorld = (row) => row ? ({ id:row.id,name:row.name,profile:row.profile || row.profile_json || {},updatedAt:row.updatedAt || row.updated_at }) : null
const normalizeArchive = (row) => {
  const profile=row.profile || row.profile_json || {}
  return { id:row.id,name:row.name,summary:row.summary,profile,category:classifyLegacyAsset(row),worldId:profile.worldId || '',worldName:profile.world?.name || '',tags:profile.tags || [],relatedIds:profile.relatedIds || [],updatedAt:row.updatedAt || row.updated_at,promptCount:Number(row.promptCount || row.prompt_count || 0),imageCount:Number(row.imageCount || row.image_count || 0),byteCount:Number(row.byteCount || row.byte_count || 0),coverUrl:row.coverUrl || row.cover_url,nearestExpiry:row.nearestExpiry || row.nearest_expiry }
}
const normalizePrompt = (row) => ({ id: row.id, prompt: row.prompt, promptZh:row.promptZh || row.prompt_zh || '',snapshot:row.snapshot || row.snapshot_json || {},negativePrompt: row.negativePrompt || row.negative_prompt || '', provider: row.provider, modelId: row.modelId || row.model_id, createdAt: row.createdAt || row.created_at })
const invalid = message => Object.assign(new Error(message),{statusCode:400,code:'INVALID_CONTENT'})
async function validateArchive(db,workspaceId,archive) {
  if (!archive || typeof archive.id !== 'string' || !archive.id.trim() || typeof archive.name !== 'string' || !archive.name.trim()) throw invalid('请填写条目名称。')
  const profile=archive.profile || {}
  if (profile.category && !contentCategories[profile.category] && profile.category !== 'unknown') throw invalid('资产类别无效。')
  if (profile.worldId && !await db.findWorld(workspaceId,profile.worldId)) throw invalid('所属世界不存在。')
  if (profile.relatedIds && (!Array.isArray(profile.relatedIds) || profile.relatedIds.some(id=>typeof id !== 'string'))) throw invalid('关联条目格式无效。')
  for (const id of profile.relatedIds || []) if (id === archive.id || !await db.getArchiveDetail(workspaceId,id)) throw invalid('关联条目不存在或指向自身。')
}

export const createAssetService = ({ db, blob, source = fetchSourceImage, now = () => new Date(), uuid = randomUUID }) => ({
  async saveGeneratedImage(input) {
    await validateArchive(db,input.workspaceId,input.archive)
    await db.ensureWorkspace(input.workspaceId)
    const duplicate = await db.findByIdempotencyKey(input.workspaceId, input.idempotencyKey)
    if (duplicate) {
      const usage = await db.getWorkspaceUsage(input.workspaceId)
      return { asset: normalizeImage(duplicate), usage, nearLimit: quotaWarning(usage) }
    }
    const image = await source(input.sourceUrl)
    const id = uuid()
    const createdAt = now().toISOString()
    const pathname = `workspaces/${input.workspaceId}/${id}`
    const usage = await db.reserveQuota(input.workspaceId, image.byteSize, ASSET_LIMITS)
    let uploaded
    try {
      uploaded = await blob.putImage(pathname, image.bytes, image.contentType)
      await db.upsertArchive(input.workspaceId, input.archive)
      const promptId = input.prompt.id || `prompt-${createHash('sha256').update(input.idempotencyKey).digest('hex').slice(0, 24)}`
      await db.insertPrompt(input.workspaceId, input.archive.id, { ...input.prompt, id: promptId })
      const record = { id, workspaceId: input.workspaceId, archiveId: input.archive.id, promptRecordId: promptId, blobUrl: uploaded.url, pathname: uploaded.pathname || pathname, contentType: image.contentType, byteSize: image.byteSize, width: image.width || input.width, height: image.height || input.height, provider: input.provider, modelId: input.modelId, createdAt, expiresAt: expiresAtFrom(now()), idempotencyKey: input.idempotencyKey }
      const saved = await db.insertImageAsset(record)
      return { asset: normalizeImage(saved), usage, nearLimit: quotaWarning(usage) }
    } catch (error) {
      if (uploaded?.url) await blob.deleteImage(uploaded.url).catch(() => {})
      await db.releaseQuota(input.workspaceId, image.byteSize).catch(() => {})
      const winner = await db.findByIdempotencyKey(input.workspaceId, input.idempotencyKey).catch(() => null)
      if (winner) { const current = await db.getWorkspaceUsage(input.workspaceId); return { asset: normalizeImage(winner), usage: current, nearLimit: quotaWarning(current) } }
      throw error
    }
  },
  async saveArchive(workspaceId, input) { await validateArchive(db,workspaceId,input.archive); await db.ensureWorkspace(workspaceId); const archive = await db.upsertArchive(workspaceId, input.archive); for (const prompt of input.prompts || []) await db.insertPrompt(workspaceId, input.archive.id, prompt); return { archive: normalizeArchive(archive) } },
  async listWorlds(workspaceId) { return (await db.listWorlds(workspaceId)).map(normalizeWorld) },
  async getWorld(workspaceId,id) { if (typeof id !== 'string' || !id.trim()) throw invalid('世界标识无效。'); return normalizeWorld(await db.findWorld(workspaceId,id)) },
  async saveWorld(workspaceId,world) { if (!world?.id || !world?.name) throw invalid('世界名称与标识必填。'); await db.ensureWorkspace(workspaceId); return normalizeWorld(await db.upsertWorld(workspaceId,world)) },
  async deleteWorld(workspaceId,id) { if (typeof id !== 'string' || !id.trim()) throw invalid('世界标识无效。'); return db.deleteWorld(workspaceId,id) },
  async updateArchiveMetadata(workspaceId,id,patch) {
    const detail=await db.getArchiveDetail(workspaceId,id)
    if (!detail) throw Object.assign(new Error('条目不存在。'),{statusCode:404})
    const old=normalizeArchive(detail.archive)
    const profile={...old.profile}
    for (const key of ['category','worldId','tags','relatedIds']) if (patch[key] !== undefined) profile[key]=patch[key]
    if (patch.worldId !== undefined) profile.world=patch.worldId ? (await db.findWorld(workspaceId,patch.worldId))?.profile : null
    const archive={id,name:patch.name ?? old.name,summary:patch.summary ?? old.summary,profile}
    await validateArchive(db,workspaceId,archive)
    return {archive:normalizeArchive(await db.upsertArchive(workspaceId,archive))}
  },
  async listArchiveSummaries(workspaceId, { allowCreate = false } = {}) { const exists = await db.workspaceExists(workspaceId); if (!exists && !allowCreate) throw Object.assign(new Error('当前工作区不存在，请刷新后重试。'), { code: 'STALE_WORKSPACE', statusCode: 409 }); if (!exists) await db.ensureWorkspace(workspaceId); const worlds = db.listWorlds ? await db.listWorlds(workspaceId) : []; return { archives: (await db.listArchives(workspaceId)).map(normalizeArchive), worlds: worlds.map(normalizeWorld), usage: await db.getWorkspaceUsage(workspaceId) } },
  async getArchiveDetail(workspaceId, archiveId) { const detail = await db.getArchiveDetail(workspaceId, archiveId); return detail ? { archive: normalizeArchive(detail.archive), prompts: detail.prompts.map(normalizePrompt), images: detail.images.map(normalizeImage) } : null },
  async getImage(workspaceId, id) { return db.findImageAsset(workspaceId, id) },
  async deleteArchive(workspaceId, id) {
    if (typeof id !== 'string' || !id.trim()) throw Object.assign(new Error('档案标识无效。'), { statusCode: 400 })
    const detail = await db.getArchiveDetail(workspaceId, id)
    if (!detail) return { deleted: true }
    for (const image of detail.images) {
      await blob.deleteImage(image.blob_url || image.url).catch((error) => { if (error?.statusCode !== 404) throw error })
      await db.deleteImageRecord(workspaceId, image.id)
    }
    await db.deleteEmptyArchive(workspaceId, id)
    return { deleted: true }
  },
  async deleteImage(workspaceId, id) {
    const image = await db.findImageAsset(workspaceId, id)
    if (!image) return { deleted: true }
    await blob.deleteImage(image.blob_url || image.url).catch((error) => { if (error?.statusCode !== 404) throw error })
    await db.deleteImageRecord(workspaceId, id)
    return { deleted: true }
  },
  async cleanupExpiredImages({ before = new Date().toISOString(), batchSize = 100 } = {}) {
    const images = await db.listExpiredImages(before, batchSize)
    const result = { deleted: 0, failed: 0 }
    for (const image of images) {
      try { await blob.deleteImage(image.blob_url || image.url).catch((error) => { if (error?.statusCode !== 404) throw error }); await db.deleteImageRecord(image.workspace_id, image.id); result.deleted += 1 } catch { result.failed += 1 }
    }
    return result
  }
})

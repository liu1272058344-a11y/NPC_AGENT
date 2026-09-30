import { randomUUID } from 'node:crypto'
import { ASSET_LIMITS, expiresAtFrom } from './config.mjs'
import { fetchSourceImage } from './sourceImage.mjs'

const normalizeImage = (row) => ({
  id: row.id, archiveId: row.archiveId || row.archive_id, promptRecordId: row.promptRecordId || row.prompt_record_id,
  url: row.url || row.blobUrl || row.blob_url, pathname: row.pathname, contentType: row.contentType || row.content_type,
  byteSize: Number(row.byteSize || row.byte_size || 0), width: row.width || undefined, height: row.height || undefined,
  provider: row.provider, modelId: row.modelId || row.model_id, createdAt: row.createdAt || row.created_at, expiresAt: row.expiresAt || row.expires_at
})

const quotaWarning = (usage) => usage.imageCount >= ASSET_LIMITS.maxImages * ASSET_LIMITS.warningRatio || usage.byteCount >= ASSET_LIMITS.maxBytes * ASSET_LIMITS.warningRatio

export const createAssetService = ({ db, blob, source = fetchSourceImage, now = () => new Date(), uuid = randomUUID }) => ({
  async saveGeneratedImage(input) {
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
    const uploaded = await blob.putImage(pathname, image.bytes, image.contentType)
    try {
      await db.upsertArchive(input.workspaceId, input.archive)
      const promptId = input.prompt.id || `prompt-${id}`
      await db.insertPrompt(input.workspaceId, input.archive.id, { ...input.prompt, id: promptId })
      const record = { id, workspaceId: input.workspaceId, archiveId: input.archive.id, promptRecordId: promptId, blobUrl: uploaded.url, pathname: uploaded.pathname || pathname, contentType: image.contentType, byteSize: image.byteSize, width: image.width || input.width, height: image.height || input.height, provider: input.provider, modelId: input.modelId, createdAt, expiresAt: expiresAtFrom(now()), idempotencyKey: input.idempotencyKey }
      const saved = await db.insertImageWithQuota(record, ASSET_LIMITS)
      return { asset: normalizeImage(saved.record), usage: saved.usage, nearLimit: quotaWarning(saved.usage) }
    } catch (error) { await blob.deleteImage(uploaded.url).catch(() => {}); throw error }
  },
  async listArchiveSummaries(workspaceId) { await db.ensureWorkspace(workspaceId); return { archives: await db.listArchives(workspaceId), usage: await db.getWorkspaceUsage(workspaceId) } },
  async getArchiveDetail(workspaceId, archiveId) { return db.getArchiveDetail(workspaceId, archiveId) },
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

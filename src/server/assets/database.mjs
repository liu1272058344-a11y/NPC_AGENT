const usage = (row = {}) => ({ imageCount: Number(row.image_count || 0), byteCount: Number(row.byte_count || 0) })

export const createAssetDatabase = (query) => ({
  ensureWorkspace: async (workspaceId) => query('INSERT INTO workspaces (id) VALUES ($1) ON CONFLICT (id) DO UPDATE SET last_seen_at = NOW()', [workspaceId]),
  upsertArchive: async (workspaceId, archive) => (await query(`INSERT INTO npc_archives (id, workspace_id, name, summary, profile_json)
    VALUES ($1,$2,$3,$4,$5::jsonb) ON CONFLICT (id) DO UPDATE SET name=$3, summary=$4, profile_json=$5::jsonb, updated_at=NOW()
    WHERE npc_archives.workspace_id=$2 RETURNING *`, [archive.id, workspaceId, archive.name, archive.summary || '', JSON.stringify(archive.profile || archive)])).rows[0],
  getWorkspaceUsage: async (workspaceId) => usage((await query('SELECT COUNT(*) AS image_count, COALESCE(SUM(byte_size),0) AS byte_count FROM image_assets WHERE workspace_id=$1', [workspaceId])).rows[0]),
  reserveUsage: async (workspaceId) => usage((await query(`SELECT COUNT(i.id) AS image_count, COALESCE(SUM(i.byte_size),0) AS byte_count FROM workspaces w LEFT JOIN image_assets i ON i.workspace_id=w.id WHERE w.id=$1 GROUP BY w.id FOR UPDATE`, [workspaceId])).rows[0]),
  insertPrompt: async (workspaceId, archiveId, prompt) => (await query(`INSERT INTO prompt_records (id,workspace_id,archive_id,prompt,negative_prompt,provider,model_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO UPDATE SET prompt=EXCLUDED.prompt RETURNING *`, [prompt.id, workspaceId, archiveId, prompt.prompt, prompt.negativePrompt || '', prompt.provider || '', prompt.modelId || ''])).rows[0],
  insertImageAsset: async (record) => (await query(`INSERT INTO image_assets (id,workspace_id,archive_id,prompt_record_id,blob_url,pathname,content_type,byte_size,width,height,provider,model_id,created_at,expires_at,idempotency_key)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`, [record.id, record.workspaceId, record.archiveId, record.promptRecordId, record.blobUrl, record.pathname, record.contentType, record.byteSize, record.width || null, record.height || null, record.provider, record.modelId, record.createdAt, record.expiresAt, record.idempotencyKey])).rows[0],
  findByIdempotencyKey: async (workspaceId, key) => (await query('SELECT * FROM image_assets WHERE workspace_id=$1 AND idempotency_key=$2', [workspaceId, key])).rows[0] || null,
  listArchives: async (workspaceId) => (await query(`SELECT a.*, COUNT(i.id)::int AS image_count, COALESCE(SUM(i.byte_size),0)::bigint AS byte_count,
    (ARRAY_AGG(i.blob_url ORDER BY i.created_at DESC) FILTER (WHERE i.id IS NOT NULL))[1] AS cover_url,
    MIN(i.expires_at) AS nearest_expiry FROM npc_archives a LEFT JOIN image_assets i ON i.archive_id=a.id AND i.workspace_id=a.workspace_id WHERE a.workspace_id=$1 GROUP BY a.id ORDER BY a.updated_at DESC`, [workspaceId])).rows,
  getArchiveDetail: async (workspaceId, archiveId) => {
    const archive = (await query('SELECT * FROM npc_archives WHERE workspace_id=$1 AND id=$2', [workspaceId, archiveId])).rows[0]
    if (!archive) return null
    const prompts = (await query('SELECT * FROM prompt_records WHERE workspace_id=$1 AND archive_id=$2 ORDER BY created_at DESC', [workspaceId, archiveId])).rows
    const images = (await query('SELECT * FROM image_assets WHERE workspace_id=$1 AND archive_id=$2 ORDER BY created_at DESC', [workspaceId, archiveId])).rows
    return { archive, prompts, images }
  },
  findImageAsset: async (workspaceId, id) => (await query('SELECT * FROM image_assets WHERE workspace_id=$1 AND id=$2', [workspaceId, id])).rows[0] || null,
  deleteImageRecord: async (workspaceId, id) => query('DELETE FROM image_assets WHERE workspace_id=$1 AND id=$2', [workspaceId, id]),
  listExpiredImages: async (before, limit = 100) => (await query('SELECT * FROM image_assets WHERE expires_at <= $1 ORDER BY expires_at LIMIT $2', [before, limit])).rows
})

export const createNeonAssetDatabase = async () => {
  const { neon } = await import('@neondatabase/serverless')
  if (!process.env.DATABASE_URL) throw Object.assign(new Error('资产数据库尚未配置。'), { code: 'ASSET_STORAGE_UNAVAILABLE', statusCode: 503 })
  const sql = neon(process.env.DATABASE_URL)
  return createAssetDatabase((text, values) => sql.query(text, values))
}

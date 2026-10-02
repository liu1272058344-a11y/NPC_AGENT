const usage = (row = {}) => ({ imageCount: Number(row.image_count || 0), byteCount: Number(row.byte_count || 0) })

export const createAssetDatabase = (query) => ({
  upsertWorld: async (workspaceId, world) => (await query(`INSERT INTO content_worlds (workspace_id,id,name,profile_json) VALUES ($1,$2,$3,$4::jsonb)
    ON CONFLICT (workspace_id,id) DO UPDATE SET name=EXCLUDED.name,profile_json=EXCLUDED.profile_json,updated_at=now() RETURNING *`, [workspaceId,world.id,world.name,JSON.stringify(world.profile || {})])).rows[0],
  listWorlds: async (workspaceId) => (await query('SELECT id,name,profile_json AS profile FROM content_worlds WHERE workspace_id=$1 ORDER BY updated_at DESC',[workspaceId])).rows,
  findWorld: async (workspaceId,id) => (await query('SELECT id,name,profile_json AS profile FROM content_worlds WHERE workspace_id=$1 AND id=$2',[workspaceId,id])).rows[0],
  ensureWorkspace: async (workspaceId) => query('INSERT INTO workspaces (id) VALUES ($1) ON CONFLICT (id) DO UPDATE SET last_seen_at = NOW()', [workspaceId]),
  upsertArchive: async (workspaceId, archive) => (await query(`INSERT INTO npc_archives (id, workspace_id, name, summary, profile_json)
    VALUES ($1,$2,$3,$4,$5::jsonb) ON CONFLICT (workspace_id,id) DO UPDATE SET name=$3, summary=$4, profile_json=$5::jsonb, updated_at=NOW()
    RETURNING *`, [archive.id, workspaceId, archive.name, archive.summary || '', JSON.stringify(archive.profile || archive)])).rows[0],
  workspaceExists: async (workspaceId) => Boolean((await query('SELECT 1 FROM workspaces WHERE id=$1', [workspaceId])).rowCount),
  deleteEmptyArchive: async (workspaceId, id) => {
    await query('DELETE FROM npc_archives WHERE workspace_id=$1 AND id=$2 AND NOT EXISTS (SELECT 1 FROM image_assets WHERE workspace_id=$1 AND archive_id=$2)', [workspaceId, id])
    if ((await query('SELECT 1 FROM npc_archives WHERE workspace_id=$1 AND id=$2', [workspaceId, id])).rowCount) throw Object.assign(new Error('档案仍有图片正在保存，请稍后重试删除。'), { statusCode: 409 })
  },
  getWorkspaceUsage: async (workspaceId) => usage((await query('SELECT image_count, byte_count FROM workspaces WHERE id=$1', [workspaceId])).rows[0]),
  reserveQuota: async (workspaceId, byteSize, limits) => {
    const result = await query(`WITH locked AS (SELECT pg_advisory_xact_lock(hashtext('internal_beta_project_usage'))), current AS (
      SELECT w.id, w.image_count, w.byte_count, p.image_count AS project_images, p.byte_count AS project_bytes
      FROM workspaces w CROSS JOIN internal_beta_project_usage p CROSS JOIN locked WHERE w.id=$1 AND p.id=1 FOR UPDATE
    ), project_update AS (
      UPDATE internal_beta_project_usage p SET image_count=p.image_count+1, byte_count=p.byte_count+$2
      FROM current c WHERE p.id=1 AND c.image_count < $3 AND c.byte_count+$2 <= $4
        AND c.project_images < $5 AND c.project_bytes+$2 <= $6 RETURNING p.id
    ) UPDATE workspaces w SET image_count=w.image_count+1, byte_count=w.byte_count+$2, last_seen_at=NOW()
      FROM current c, project_update p WHERE w.id=c.id RETURNING w.image_count, w.byte_count`, [workspaceId, byteSize, limits.maxImages, limits.maxBytes, limits.projectMaxImages, limits.projectMaxBytes])
    if (result.rows[0]) return usage(result.rows[0])
    const current = await query('SELECT image_count, byte_count FROM workspaces WHERE id=$1', [workspaceId])
    const value = usage(current.rows[0])
    const project = await query('SELECT image_count, byte_count FROM internal_beta_project_usage WHERE id=1', [])
    const projectUsage = usage(project.rows[0])
    if (projectUsage.imageCount >= limits.projectMaxImages || projectUsage.byteCount + byteSize > limits.projectMaxBytes) throw Object.assign(new Error('项目资产总额度已达到上限。'), { code: 'PROJECT_ASSET_LIMIT_REACHED', statusCode: 429 })
    const code = value.imageCount >= limits.maxImages ? 'QUOTA_COUNT_EXCEEDED' : 'QUOTA_BYTES_EXCEEDED'
    throw Object.assign(new Error(code === 'QUOTA_COUNT_EXCEEDED' ? '图片数量已达到上限。' : '图片存储容量已达到上限。'), { code, statusCode: 409 })
  },
  releaseQuota: async (workspaceId, byteSize) => query(`WITH project_update AS (
      UPDATE internal_beta_project_usage SET image_count=GREATEST(0,image_count-1), byte_count=GREATEST(0,byte_count-$2) WHERE id=1
    ) UPDATE workspaces SET image_count=GREATEST(0,image_count-1), byte_count=GREATEST(0,byte_count-$2) WHERE id=$1`, [workspaceId, byteSize]),
  reserveUsage: async (workspaceId) => usage((await query(`SELECT COUNT(i.id) AS image_count, COALESCE(SUM(i.byte_size),0) AS byte_count FROM workspaces w LEFT JOIN image_assets i ON i.workspace_id=w.id WHERE w.id=$1 GROUP BY w.id FOR UPDATE`, [workspaceId])).rows[0]),
  insertPrompt: async (workspaceId, archiveId, prompt) => {
    const values=[prompt.id,workspaceId,archiveId,prompt.prompt,prompt.negativePrompt || '',prompt.provider || '',prompt.modelId || '',prompt.promptZh || '',JSON.stringify(prompt.snapshot || {})]
    const result=await query(`INSERT INTO prompt_records (id,workspace_id,archive_id,prompt,negative_prompt,provider,model_id,prompt_zh,snapshot_json)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb) ON CONFLICT (workspace_id,id) DO NOTHING RETURNING *`,values)
    const row=result.rows[0] || (await query('SELECT * FROM prompt_records WHERE workspace_id=$1 AND id=$2',[workspaceId,prompt.id])).rows[0]
    if (row?.archive_id && row.archive_id !== archiveId) throw Object.assign(new Error('Prompt 已属于其他条目。'),{statusCode:409})
    return row
  },
  insertImageAsset: async (record) => (await query(`INSERT INTO image_assets (id,workspace_id,archive_id,prompt_record_id,blob_url,pathname,content_type,byte_size,width,height,provider,model_id,created_at,expires_at,idempotency_key)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`, [record.id, record.workspaceId, record.archiveId, record.promptRecordId, record.blobUrl, record.pathname, record.contentType, record.byteSize, record.width || null, record.height || null, record.provider, record.modelId, record.createdAt, record.expiresAt, record.idempotencyKey])).rows[0],
  insertImageWithQuota: async (record, limits) => {
    const result = await query(`WITH locked AS (SELECT pg_advisory_xact_lock(hashtext($2))), current_usage AS (
      SELECT COUNT(*)::int AS image_count, COALESCE(SUM(byte_size),0)::bigint AS byte_count FROM image_assets, locked WHERE workspace_id=$2
    ), inserted AS (
      INSERT INTO image_assets (id,workspace_id,archive_id,prompt_record_id,blob_url,pathname,content_type,byte_size,width,height,provider,model_id,created_at,expires_at,idempotency_key)
      SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15 FROM current_usage
      WHERE image_count < $16 AND byte_count + $8 <= $17 RETURNING *
    ) SELECT inserted.*, current_usage.image_count, current_usage.byte_count FROM current_usage LEFT JOIN inserted ON true`, [record.id, record.workspaceId, record.archiveId, record.promptRecordId, record.blobUrl, record.pathname, record.contentType, record.byteSize, record.width || null, record.height || null, record.provider, record.modelId, record.createdAt, record.expiresAt, record.idempotencyKey, limits.maxImages, limits.maxBytes])
    const row = result.rows[0]
    if (!row?.id) {
      const code = Number(row?.image_count || 0) >= limits.maxImages ? 'QUOTA_COUNT_EXCEEDED' : 'QUOTA_BYTES_EXCEEDED'
      throw Object.assign(new Error(code === 'QUOTA_COUNT_EXCEEDED' ? '图片数量已达到上限。' : '图片存储容量已达到上限。'), { code, statusCode: 409 })
    }
    return { record: row, usage: { imageCount: Number(row.image_count) + 1, byteCount: Number(row.byte_count) + record.byteSize } }
  },
  findByIdempotencyKey: async (workspaceId, key) => (await query('SELECT * FROM image_assets WHERE workspace_id=$1 AND idempotency_key=$2', [workspaceId, key])).rows[0] || null,
  listArchives: async (workspaceId) => (await query(`SELECT a.*, COUNT(i.id)::int AS image_count, COALESCE(SUM(i.byte_size),0)::bigint AS byte_count,
    (ARRAY_AGG(i.blob_url ORDER BY i.created_at DESC) FILTER (WHERE i.id IS NOT NULL))[1] AS cover_url,
    MIN(i.expires_at) AS nearest_expiry,
    (SELECT COUNT(*) FROM prompt_records p WHERE p.workspace_id=a.workspace_id AND p.archive_id=a.id) AS prompt_count
    FROM npc_archives a LEFT JOIN image_assets i ON i.archive_id=a.id AND i.workspace_id=a.workspace_id WHERE a.workspace_id=$1 GROUP BY a.workspace_id, a.id ORDER BY a.updated_at DESC`, [workspaceId])).rows,
  getArchiveDetail: async (workspaceId, archiveId) => {
    const archive = (await query('SELECT * FROM npc_archives WHERE workspace_id=$1 AND id=$2', [workspaceId, archiveId])).rows[0]
    if (!archive) return null
    const prompts = (await query('SELECT * FROM prompt_records WHERE workspace_id=$1 AND archive_id=$2 ORDER BY created_at DESC', [workspaceId, archiveId])).rows
    const images = (await query('SELECT * FROM image_assets WHERE workspace_id=$1 AND archive_id=$2 ORDER BY created_at DESC', [workspaceId, archiveId])).rows
    return { archive, prompts, images }
  },
  findImageAsset: async (workspaceId, id) => (await query('SELECT i.*, a.name AS archive_name FROM image_assets i JOIN npc_archives a ON a.workspace_id=i.workspace_id AND a.id=i.archive_id WHERE i.workspace_id=$1 AND i.id=$2', [workspaceId, id])).rows[0] || null,
  deleteImageRecord: async (workspaceId, id) => query(`WITH deleted AS (
      DELETE FROM image_assets WHERE workspace_id=$1 AND id=$2 RETURNING byte_size
    ), project_update AS (
      UPDATE internal_beta_project_usage SET image_count=GREATEST(0,image_count-(SELECT COUNT(*) FROM deleted)),
        byte_count=GREATEST(0,byte_count-COALESCE((SELECT SUM(byte_size) FROM deleted),0)) WHERE id=1 RETURNING id
    ) UPDATE workspaces SET image_count=GREATEST(0,image_count-(SELECT COUNT(*) FROM deleted)),
      byte_count=GREATEST(0,byte_count-COALESCE((SELECT SUM(byte_size) FROM deleted),0))
      FROM project_update WHERE workspaces.id=$1`, [workspaceId, id]),
  listExpiredImages: async (before, limit = 100) => (await query('SELECT * FROM image_assets WHERE expires_at <= $1 ORDER BY expires_at LIMIT $2', [before, limit])).rows
})

export const createNeonAssetDatabase = async () => {
  const { neon } = await import('@neondatabase/serverless')
  if (!process.env.DATABASE_URL) throw Object.assign(new Error('资产数据库尚未配置。'), { code: 'ASSET_STORAGE_UNAVAILABLE', statusCode: 503 })
  const sql = neon(process.env.DATABASE_URL, { fullResults: true })
  return createAssetDatabase(createNeonQueryAdapter(sql))
}

export const createNeonQueryAdapter = (sql) => async (text, values) => {
  const result = await sql.query(text, values)
  if (Array.isArray(result)) return { rows: result, rowCount: result.length }
  return { rows: result.rows || [], rowCount: Number(result.rowCount ?? result.rows?.length ?? 0) }
}

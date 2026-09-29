import { randomUUID } from 'node:crypto'

const now = () => new Date().toISOString()
const parse = (row) => row ? JSON.parse(row.payload) : null

export function saveAsset(db, input) {
  const assetId = input.asset_id || `asset-${randomUUID()}`
  const projectId = String(input.project_id || '').trim()
  if (!projectId) throw Object.assign(new Error('project_id is required'), { code: 'ASSET_PERSISTENCE_ERROR', statusCode: 400 })
  const createdAt = now()
  const payload = { ...(input.payload || {}), asset_id: assetId, project_id: projectId, source_id: input.source_id || '', type: input.type || 'unknown', status: input.status || 'draft' }
  db.prepare('INSERT OR REPLACE INTO assets (asset_id,project_id,source_id,type,status,payload,created_at) VALUES (?,?,?,?,?,?,?)').run(assetId, projectId, payload.source_id, payload.type, payload.status, JSON.stringify(payload), createdAt)
  const versionPayload = { ...payload, version: 1 }
  db.prepare('INSERT OR REPLACE INTO asset_versions (asset_id,version,payload,created_at) VALUES (?,?,?,?)').run(assetId, 1, JSON.stringify(versionPayload), createdAt)
  return versionPayload
}

export function createAssetVersion(db, assetId, input) {
  const latest = db.prepare('SELECT MAX(version) AS version FROM asset_versions WHERE asset_id = ?').get(assetId)?.version || 0
  const version = Number(latest) + 1
  const payload = { ...input, asset_id: assetId, version, created_at: input.created_at || now() }
  db.prepare('INSERT INTO asset_versions (asset_id,version,payload,created_at) VALUES (?,?,?,?)').run(assetId, version, JSON.stringify(payload), payload.created_at)
  return payload
}

export function listAssetVersions(db, assetId) {
  return db.prepare('SELECT payload FROM asset_versions WHERE asset_id = ? ORDER BY version ASC').all(assetId).map(parse)
}

import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

export function createDatabase(filename = process.env.PIPELINE_DB_PATH || 'data/pipeline.sqlite') {
  mkdirSync(dirname(filename), { recursive: true })
  const db = new DatabaseSync(filename)
  db.exec(`PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS projects (project_id TEXT PRIMARY KEY, name TEXT NOT NULL, genre TEXT DEFAULT '', style TEXT DEFAULT '', payload TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS worlds (world_id TEXT PRIMARY KEY, project_id TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS characters (character_id TEXT PRIMARY KEY, project_id TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS visual_prompts (visual_id TEXT PRIMARY KEY, project_id TEXT NOT NULL, source_id TEXT, payload TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS assets (asset_id TEXT PRIMARY KEY, project_id TEXT NOT NULL, source_id TEXT, type TEXT NOT NULL, status TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS asset_versions (asset_id TEXT NOT NULL, version INTEGER NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (asset_id, version));
    CREATE TABLE IF NOT EXISTS agent_runs (run_id TEXT PRIMARY KEY, project_id TEXT, status TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL);`)
  return db
}

export function savePipelineResult(db, result) {
  const project = result.project || result.data?.project
  if (!project?.project_id) throw new Error('pipeline result project_id is required')
  const now = new Date().toISOString()
  const projectId = project.project_id
  db.prepare('INSERT OR REPLACE INTO projects (project_id,name,genre,style,payload,created_at) VALUES (?,?,?,?,?,?)').run(projectId, project.name || '', project.genre || '', project.style || '', JSON.stringify(project), now)
  if (project.world) db.prepare('INSERT OR REPLACE INTO worlds (world_id,project_id,payload,created_at) VALUES (?,?,?,?)').run(`${projectId}:world`, projectId, JSON.stringify(project.world), now)
  for (const character of project.characters || []) db.prepare('INSERT OR REPLACE INTO characters (character_id,project_id,payload,created_at) VALUES (?,?,?,?)').run(character.character_id, projectId, JSON.stringify(character), now)
  for (const asset of project.assets || []) {
    db.prepare('INSERT OR REPLACE INTO assets (asset_id,project_id,source_id,type,status,payload,created_at) VALUES (?,?,?,?,?,?,?)').run(asset.asset_id, projectId, asset.source_id || '', asset.type || 'unknown', asset.status || 'draft', JSON.stringify(asset), now)
    db.prepare('INSERT OR REPLACE INTO asset_versions (asset_id,version,payload,created_at) VALUES (?,?,?,?)').run(asset.asset_id, asset.version || 1, JSON.stringify(asset), now)
  }
  if (result.run_id) db.prepare('INSERT OR REPLACE INTO agent_runs (run_id,project_id,status,payload,created_at) VALUES (?,?,?,?,?)').run(result.run_id, projectId, result.status || 'success', JSON.stringify(result), now)
  return { projectId, assetCount: (project.assets || []).length }
}

export function listStoredAssets(db, projectId) {
  const query = projectId ? db.prepare('SELECT payload FROM assets WHERE project_id = ? ORDER BY created_at DESC') : db.prepare('SELECT payload FROM assets ORDER BY created_at DESC')
  return query.all(...(projectId ? [projectId] : [])).map((row) => JSON.parse(row.payload))
}

BEGIN;
CREATE TABLE IF NOT EXISTS content_worlds (
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  id text NOT NULL,
  name text NOT NULL,
  profile_json jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, id)
);
ALTER TABLE prompt_records ADD COLUMN IF NOT EXISTS prompt_zh text NOT NULL DEFAULT '';
ALTER TABLE prompt_records ADD COLUMN IF NOT EXISTS snapshot_json jsonb NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS content_archive_category_idx ON npc_archives (workspace_id, (profile_json->>'category'));
CREATE INDEX IF NOT EXISTS content_archive_world_idx ON npc_archives (workspace_id, (profile_json->>'worldId'));
-- Keep unknown legacy records available for manual classification.
UPDATE npc_archives SET profile_json=jsonb_set(profile_json, '{category}', '"character"')
WHERE NOT profile_json ? 'category' AND profile_json ? 'personality';
COMMIT;

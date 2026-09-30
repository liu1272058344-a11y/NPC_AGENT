CREATE TABLE IF NOT EXISTS workspaces (
  id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS npc_archives (
  id text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  summary text NOT NULL DEFAULT '',
  profile_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id)
);
CREATE TABLE IF NOT EXISTS prompt_records (
  id text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  archive_id text NOT NULL REFERENCES npc_archives(id) ON DELETE CASCADE,
  prompt text NOT NULL,
  negative_prompt text NOT NULL DEFAULT '',
  provider text NOT NULL DEFAULT '',
  model_id text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS image_assets (
  id text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  archive_id text NOT NULL REFERENCES npc_archives(id) ON DELETE CASCADE,
  prompt_record_id text REFERENCES prompt_records(id) ON DELETE SET NULL,
  blob_url text NOT NULL,
  pathname text NOT NULL,
  content_type text NOT NULL,
  byte_size bigint NOT NULL CHECK (byte_size > 0),
  width integer,
  height integer,
  provider text NOT NULL DEFAULT '',
  model_id text NOT NULL DEFAULT '',
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  UNIQUE (workspace_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS image_assets_workspace_expiry_idx ON image_assets(workspace_id, expires_at);
CREATE INDEX IF NOT EXISTS image_assets_archive_idx ON image_assets(workspace_id, archive_id, created_at DESC);
CREATE INDEX IF NOT EXISTS prompt_records_archive_idx ON prompt_records(workspace_id, archive_id, created_at DESC);

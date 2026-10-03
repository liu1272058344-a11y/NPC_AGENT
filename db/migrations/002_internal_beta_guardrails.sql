CREATE TABLE IF NOT EXISTS internal_beta_daily_usage (
  usage_date date NOT NULL,
  action_kind text NOT NULL,
  action_count integer NOT NULL DEFAULT 0 CHECK (action_count >= 0),
  PRIMARY KEY (usage_date, action_kind)
);

CREATE INDEX IF NOT EXISTS internal_beta_daily_usage_date_idx
  ON internal_beta_daily_usage (usage_date);

CREATE TABLE IF NOT EXISTS internal_beta_project_usage (
  id smallint PRIMARY KEY CHECK (id = 1),
  image_count integer NOT NULL DEFAULT 0 CHECK (image_count >= 0),
  byte_count bigint NOT NULL DEFAULT 0 CHECK (byte_count >= 0)
);

INSERT INTO internal_beta_project_usage (id, image_count, byte_count)
SELECT 1, COUNT(*)::integer, COALESCE(SUM(byte_size), 0)::bigint FROM image_assets
ON CONFLICT (id) DO NOTHING;

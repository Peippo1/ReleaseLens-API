CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  repository TEXT NOT NULL,
  base_ref TEXT NOT NULL,
  head_ref TEXT NOT NULL,
  installation_id BIGINT NOT NULL,
  audience TEXT NOT NULL CHECK (audience IN ('public', 'internal', 'both')),
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  content JSONB,
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS reports_tenant_id_idx ON reports (tenant_id, created_at DESC);
CREATE TABLE IF NOT EXISTS deletion_audit (report_id UUID NOT NULL, deleted_at TIMESTAMPTZ NOT NULL);

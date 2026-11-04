-- Multi-Tenant SaaS Connector High Availability, Enrollment & Remote Config
CREATE TABLE IF NOT EXISTS public.fiorix_connector_ha_nodes (
  connector_id TEXT PRIMARY KEY REFERENCES "Connector"("id") ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'PRIMARY',
  operational_state TEXT NOT NULL DEFAULT 'STANDBY',
  priority INT NOT NULL DEFAULT 10,
  hostname TEXT,
  os_version TEXT,
  lan_url TEXT,
  installed_path TEXT,
  remote_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  config_version INT NOT NULL DEFAULT 1,
  target_version TEXT,
  update_status TEXT NOT NULL DEFAULT 'IDLE',
  update_message TEXT,
  last_update_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fiorix_ha_nodes_tenant
  ON public.fiorix_connector_ha_nodes (tenant_id, priority ASC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_fiorix_ha_single_active_per_tenant
  ON public.fiorix_connector_ha_nodes (tenant_id)
  WHERE operational_state = 'ACTIVE';

CREATE TABLE IF NOT EXISTS public.fiorix_tenant_connector_settings (
  tenant_id TEXT PRIMARY KEY,
  failover_mode TEXT NOT NULL DEFAULT 'MANUAL',
  auto_failover_timeout_sec INT NOT NULL DEFAULT 180,
  rolling_update_state JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.fiorix_connector_enrollment_tokens (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  connector_name TEXT NOT NULL,
  intended_role TEXT NOT NULL DEFAULT 'PRIMARY',
  initial_state TEXT NOT NULL DEFAULT 'STANDBY',
  initial_remote_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  consumed_by_connector_id TEXT,
  created_by_user_id TEXT,
  created_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fiorix_enrollment_tokens_tenant
  ON public.fiorix_connector_enrollment_tokens (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.fiorix_tenant_sync_checkpoints (
  tenant_id TEXT NOT NULL,
  source TEXT NOT NULL,
  cursor_value TEXT NOT NULL,
  secondary_cursor TEXT,
  last_success_at TIMESTAMPTZ,
  updated_by_connector_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, source)
);


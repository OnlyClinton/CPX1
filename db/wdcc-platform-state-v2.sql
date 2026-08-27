-- WDCC provider-neutral state storage v2.
-- This schema is staged on Neon branch wdcc-state-provider-v2-20260827 only.
-- Do not apply to a production database until canonical Blob revision parity is proven.

CREATE TABLE IF NOT EXISTS public.wdcc_platform_state (
  singleton_id smallint PRIMARY KEY DEFAULT 1 CHECK (singleton_id = 1),
  revision bigint NOT NULL CHECK (revision >= 0),
  state jsonb NOT NULL,
  checksum_sha256 text NOT NULL CHECK (checksum_sha256 ~ '^[0-9a-f]{64}$'),
  source_provider text NOT NULL,
  source_locator text,
  source_revision bigint,
  source_checksum_sha256 text,
  imported_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wdcc_platform_state_history (
  snapshot_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  revision bigint NOT NULL CHECK (revision >= 0),
  state jsonb NOT NULL,
  checksum_sha256 text NOT NULL CHECK (checksum_sha256 ~ '^[0-9a-f]{64}$'),
  source_provider text NOT NULL,
  source_locator text,
  source_revision bigint,
  source_checksum_sha256 text,
  cause text NOT NULL DEFAULT 'write',
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (revision, checksum_sha256)
);

CREATE INDEX IF NOT EXISTS wdcc_platform_state_history_revision_idx
  ON public.wdcc_platform_state_history (revision DESC, recorded_at DESC);

CREATE TABLE IF NOT EXISTS public.wdcc_platform_state_imports (
  import_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_provider text NOT NULL,
  source_locator text NOT NULL,
  source_revision bigint,
  source_checksum_sha256 text,
  target_revision bigint,
  target_checksum_sha256 text,
  status text NOT NULL CHECK (status IN ('planned','verified','imported','rejected')),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz,
  imported_at timestamptz
);

CREATE INDEX IF NOT EXISTS wdcc_platform_state_imports_created_idx
  ON public.wdcc_platform_state_imports (created_at DESC);

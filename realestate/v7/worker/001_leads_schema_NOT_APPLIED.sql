-- Development-only proposed migration for a new isolated CPX lead intake D1 database.
-- NOT APPLIED to any live database. Consent records require a final privacy review.
CREATE TABLE IF NOT EXISTS cpx_leads (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL,
 company TEXT NOT NULL, role TEXT NOT NULL,
 marketing_opt_in INTEGER NOT NULL DEFAULT 0,
 consent_recorded_at TEXT NOT NULL, created_at TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'new'
);
CREATE INDEX IF NOT EXISTS idx_cpx_leads_created ON cpx_leads(created_at);
CREATE TABLE IF NOT EXISTS cpx_lead_rate (
 fingerprint TEXT PRIMARY KEY, n INTEGER NOT NULL DEFAULT 1,updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cpx_lead_rate_updated ON cpx_lead_rate(updated_at);
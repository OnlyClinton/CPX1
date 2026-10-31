-- Isolated D1 staging database only. NOT APPLIED. Final privacy/retention approval required.
CREATE TABLE IF NOT EXISTS cpx_leads (
 id TEXT PRIMARY KEY,
 product TEXT NOT NULL CHECK(product IN ('estateos','marketplace','flexstay','hiddenmarket','prive')),
 interest TEXT NOT NULL,
 name TEXT NOT NULL,
 email TEXT NOT NULL,
 company TEXT NOT NULL DEFAULT '',
 role TEXT NOT NULL,
 marketing_opt_in INTEGER NOT NULL DEFAULT 0 CHECK(marketing_opt_in IN (0,1)),
 consent_recorded_at TEXT NOT NULL,
 created_at TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','reviewing','closed','deleted'))
);
CREATE INDEX IF NOT EXISTS idx_cpx_leads_recent ON cpx_leads(product,email,created_at);
CREATE INDEX IF NOT EXISTS idx_cpx_leads_status ON cpx_leads(status,created_at);
-- Retention cleanup, export, access logging, deletion & email-optout are RELEASE BLOCKERS.
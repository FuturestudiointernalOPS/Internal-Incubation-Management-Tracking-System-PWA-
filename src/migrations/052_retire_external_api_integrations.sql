-- =============================================================================
-- IMPACTOS — RETIRE THE EXTERNAL API SURFACE
-- Drops the API keys, the outbound webhooks and their delivery logs.
-- =============================================================================

-- The API-key / webhook surface was never reachable from any screen (no
-- navigation entry, no caller) and has been removed from the code. These three
-- tables held its only records, so nothing reads or writes them any more.
--
-- NOT dropped: `api_usage_logs`. It came from the same original migration, but
-- the system monitoring counters still read it, so it stays.
--
-- Child first: the delivery log carries a foreign key to its webhook, so
-- dropping the parent before the child would be refused.

DROP TABLE IF EXISTS webhook_delivery_logs;
DROP TABLE IF EXISTS webhooks;
DROP TABLE IF EXISTS api_keys;

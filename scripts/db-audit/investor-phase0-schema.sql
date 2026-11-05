-- Investor Platform v2 Phase 0: metadata only, no application rows or writes.
SET default_transaction_read_only = on;
SELECT current_database() AS database_name, current_user AS database_role,
       current_setting('transaction_read_only') AS read_only;
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (table_name IN (
    'investor_profiles', 'investor_preferences', 'investment_pipeline',
    'investor_watchlist', 'fundraising_campaigns', 'investment_decisions',
    'relationship_workspaces', 'relationship_meetings', 'feature_flags',
    'system_settings', 'decline_reasons', 'investor_activity_log',
    'investor_invitations', 'introduction_requests', 'legal_documents',
    'investor_legal_acceptances'
  ) OR table_name LIKE '%investor%activity%'
    OR table_name LIKE '%intro%request%')
ORDER BY table_name, ordinal_position;

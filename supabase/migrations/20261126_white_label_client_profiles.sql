-- Additive commercial contact metadata. No operational client data is exposed.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE TABLE IF NOT EXISTS organization_client_profiles (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE RESTRICT,
  contact_name TEXT NOT NULL DEFAULT '' CHECK(length(contact_name)<=160),
  contact_email TEXT NOT NULL DEFAULT '' CHECK(length(contact_email)<=254),
  contact_phone TEXT NOT NULL DEFAULT '' CHECK(length(contact_phone)<=60),
  website TEXT NOT NULL DEFAULT '' CHECK(length(website)<=2048)
);
ALTER TABLE organization_client_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON organization_client_profiles FROM anon, authenticated;
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='organization_client_profiles'::regclass AND tgname='wl_client_profile_identity') THEN
    CREATE TRIGGER wl_client_profile_identity BEFORE UPDATE ON organization_client_profiles
      FOR EACH ROW EXECUTE FUNCTION wl_preserve_record_identity('organization_id');
    CREATE TRIGGER wl_client_profile_no_delete BEFORE DELETE ON organization_client_profiles
      FOR EACH ROW EXECUTE FUNCTION wl_forbid_history_delete();
    CREATE TRIGGER wl_client_profile_no_truncate BEFORE TRUNCATE ON organization_client_profiles
      FOR EACH STATEMENT EXECUTE FUNCTION wl_forbid_history_delete();
  END IF;
END $$;
COMMIT;

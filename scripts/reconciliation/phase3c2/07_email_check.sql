-- Check whether cyberstreetmart@gmail.com exists in this environment.
SELECT cid, name, email, role, status, created_at
FROM contacts
WHERE LOWER(email) = 'cyberstreetmart@gmail.com'
   OR LOWER(COALESCE(name,'')) = LOWER('cyberstreetmart');

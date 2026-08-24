-- Forensic reproduction of GET /api/responsibilities/assign against staging.
-- Exactly the statements the route runs (read-only).

-- 1. getAllResponsibilities() query
SELECT * FROM responsibilities WHERE is_active = 1 ORDER BY name;

-- 2. The "assigned" query (with the failing user)
SELECT r.id, r.name, r.key
FROM responsibilities r
JOIN user_responsibilities ur ON ur.responsibility_id = r.id
WHERE ur.user_cid = 'USR_9ED327DED39F' AND r.is_active = 1
ORDER BY r.name;

-- 3. The "user" query
SELECT cid, name, role FROM contacts WHERE cid = 'USR_9ED327DED39F';

-- 4. Sanity: does the user exist and what rows exist in user_responsibilities?
SELECT count(*)::int AS resp_rows FROM responsibilities;
SELECT count(*)::int AS assigned_rows FROM user_responsibilities WHERE user_cid = 'USR_9ED327DED39F';
SELECT count(*)::int AS user_resp_total FROM user_responsibilities;

-- Confirms the constraint name the embed hints at actually exists.
-- Expect two rows: inspections_inspector_id_fkey (inspector_id)
--                  inspections_finalized_by_fkey (finalized_by)
SELECT con.conname AS constraint_name,
       att.attname AS column_name
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_class fref ON fref.oid = con.confrelid
JOIN unnest(con.conkey) AS k(attnum) ON true
JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = k.attnum
WHERE rel.relname = 'inspections'
  AND fref.relname = 'profiles'
  AND con.contype = 'f'
ORDER BY con.conname;

// Metadata only. Never imports the application DB adapter or runs runtime DDL.
import { readFileSync, writeFileSync } from 'node:fs';
import pg from 'pg';
const envPath = process.argv[2];
const output = process.argv[3];
if (!envPath || !output) throw new Error('Usage: export-schema.mjs <env-file> <output-json>');
const match = readFileSync(envPath, 'utf8').match(/^DATABASE_URL=(.*)$/m);
if (!match) throw new Error('DATABASE_URL is missing');
const url = match[1].trim().replace(/^["']|["']$/g, '');
const client = new pg.Client({ connectionString: url, ssl: /sslmode=/.test(url) ? undefined : { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
try {
  await client.connect();
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  await client.query("SET LOCAL statement_timeout = '30s'");
  const state = (await client.query("SELECT current_setting('transaction_read_only') AS read_only, current_setting('server_version_num') AS version")).rows[0];
  if (state.read_only !== 'on') throw new Error('Read-only transaction required');
  const tables = (await client.query(`SELECT c.oid::text, n.nspname AS schema, c.relname AS name, c.relkind
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p') ORDER BY c.relname`)).rows;
  const columns = (await client.query(`SELECT c.relname AS table_name, a.attname AS name,
    pg_catalog.format_type(a.atttypid,a.atttypmod) AS type, a.attnotnull AS not_null,
    a.attidentity AS identity, a.attgenerated AS generated, pg_catalog.pg_get_expr(d.adbin,d.adrelid) AS default_expression
    FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_class c ON c.oid=a.attrelid
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
    WHERE n.nspname='public' AND c.relkind IN ('r','p') AND a.attnum>0 AND NOT a.attisdropped
    ORDER BY c.relname,a.attnum`)).rows;
  const constraints = (await client.query(`SELECT c.relname AS table_name,k.conname AS name,k.contype AS type,
    pg_catalog.pg_get_constraintdef(k.oid) AS definition, rn.nspname AS referenced_schema,rc.relname AS referenced_table
    FROM pg_catalog.pg_constraint k JOIN pg_catalog.pg_class c ON c.oid=k.conrelid
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    LEFT JOIN pg_catalog.pg_class rc ON rc.oid=k.confrelid LEFT JOIN pg_catalog.pg_namespace rn ON rn.oid=rc.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p') ORDER BY c.relname,k.conname`)).rows;
  const sequences = (await client.query(`SELECT c.relname AS name,s.seqstart::text AS start,s.seqincrement::text AS increment,
    s.seqmin::text AS minimum,s.seqmax::text AS maximum,s.seqcache::text AS cache,s.seqcycle AS cycle
    FROM pg_catalog.pg_sequence s JOIN pg_catalog.pg_class c ON c.oid=s.seqrelid
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_depend d WHERE d.objid=c.oid AND d.deptype='i') ORDER BY c.relname`)).rows;
  const enums = (await client.query(`SELECT t.typname AS name,array_agg(e.enumlabel ORDER BY e.enumsortorder) AS labels
    FROM pg_catalog.pg_type t JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace
    JOIN pg_catalog.pg_enum e ON e.enumtypid=t.oid WHERE n.nspname='public' GROUP BY t.typname`)).rows;
  await client.query('ROLLBACK');
  writeFileSync(output, JSON.stringify({ metadataOnly:true,readOnly:true,state,tables,columns,constraints,sequences,enums },null,2)+'\n');
  console.log(JSON.stringify({ metadataOnly:true,readOnly:true,tables:tables.length,columns:columns.length,constraints:constraints.length,sequences:sequences.length,enums:enums.length }));
} catch (error) {
  console.error('Metadata export failed:', error.code || error.name);
  process.exitCode=1;
} finally { await client.end().catch(()=>{}); }

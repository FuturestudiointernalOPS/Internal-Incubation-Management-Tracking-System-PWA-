#!/usr/bin/env python3
"""Reproduce catalog table shapes/constraints in a dedicated offline container.
Not a full database clone: source functions, triggers, policies and non-constraint
indexes are outside this validation. No source credentials or business rows.
"""
import argparse
import json
import subprocess
from pathlib import Path

p=argparse.ArgumentParser()
p.add_argument('--container',required=True)
p.add_argument('--metadata',required=True)
p.add_argument('--output',required=True)
a=p.parse_args()
if not a.container.startswith('impactos-wl-synthetic-'): raise SystemExit('Dedicated container required')
i=json.loads(subprocess.check_output(['docker','inspect',a.container],text=True))[0]
if i['HostConfig']['NetworkMode']!='none' or i.get('Mounts') or i['Config']['Image']!='postgres:16-alpine': raise SystemExit('Offline synthetic PostgreSQL required')
container_id=i['Id']
def sql(text):
 r=subprocess.run(['docker','exec','-i',container_id,'psql','-X','-q','-v','ON_ERROR_STOP=1','-U','postgres','-d','impactos_wl_synthetic'],input=text,text=True,capture_output=True,timeout=120)
 if r.returncode: raise RuntimeError(r.stderr)
 return r.stdout
s=json.loads(Path(a.metadata).read_text())
if not s.get('metadataOnly') or not s.get('readOnly'): raise SystemExit('Read-only catalog export required')
if sql("SELECT count(*) FROM pg_catalog.pg_tables WHERE schemaname='public';").strip()!='count\n-------\n     0\n(1 row)':
 # Use an explicit invariant instead of relying on psql presentation.
 sql("DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_catalog.pg_tables WHERE schemaname='public') THEN RAISE EXCEPTION 'Empty database required'; END IF; END $$;")
def ident(v): return '"'+v.replace('"','""')+'"'
statements=['BEGIN;']
for sequence in s['sequences']:
 statements.append(f"CREATE SEQUENCE public.{ident(sequence['name'])} START WITH {sequence['start']} INCREMENT BY {sequence['increment']} MINVALUE {sequence['minimum']} MAXVALUE {sequence['maximum']} CACHE {sequence['cache']} {'CYCLE' if sequence['cycle'] else 'NO CYCLE'};")
for table in s['tables']:
 if table['schema']!='public' or table['relkind']!='r': raise ValueError('Unsupported table kind')
 columns=[]
 for c in s['columns']:
  if c['table_name']!=table['name']: continue
  value=ident(c['name'])+' '+c['type']
  if c['generated']: raise ValueError('Generated source column requires explicit support')
  if c['identity']: value+=' GENERATED '+('ALWAYS' if c['identity']=='a' else 'BY DEFAULT')+' AS IDENTITY'
  elif c['default_expression'] is not None: value+=' DEFAULT '+c['default_expression']
  if c['not_null']: value+=' NOT NULL'
  columns.append(value)
 statements.append(f"CREATE TABLE public.{ident(table['name'])} ("+',\n'.join(columns)+');')
for kind in ['p','u','c','f']:
 for constraint in s['constraints']:
  if constraint['type']!=kind: continue
  if kind=='f' and constraint['referenced_schema']!='public': raise ValueError('External FK requires explicit support')
  statements.append(f"ALTER TABLE public.{ident(constraint['table_name'])} ADD CONSTRAINT {ident(constraint['name'])} {constraint['definition']};")
statements+=['COMMIT;']
sql('\n'.join(statements))
sql("""INSERT INTO contacts(cid,name,email,role,status) VALUES ('SYNTH-REPRESENTATIVE','Synthetic only','representative@example.invalid','member','active');
INSERT INTO v2_programs(id,name) VALUES ('11111111-1111-4111-8111-111111111111','Synthetic representative programme');
INSERT INTO user_sessions(token,user_cid,role,expires_at) VALUES ('synthetic-representative-token','SYNTH-REPRESENTATIVE','member','2099-01-01');
CREATE TABLE wl_representative_baseline AS SELECT 'program' AS kind,to_jsonb(p) AS snapshot FROM v2_programs p UNION ALL SELECT 'session',to_jsonb(s) FROM user_sessions s;
""")
root=Path(__file__).resolve().parents[2]
migrations=sorted((root/'supabase/migrations').glob('*_white_label_*.sql'))
# Explicit dependency order.
migrations=sorted(migrations,key=lambda f:['foundation','history','supervision','management','sessions','branding'].index(f.stem.rsplit('_',1)[1]))
for _ in range(2):
 for migration in migrations: sql(migration.read_text())
sql("""DO $$ BEGIN
 ASSERT (SELECT to_jsonb(p)-'organization_id'=(SELECT snapshot FROM wl_representative_baseline WHERE kind='program') FROM v2_programs p), 'Legacy programme changed';
 ASSERT (SELECT to_jsonb(s)-'active_organization_id'=(SELECT snapshot FROM wl_representative_baseline WHERE kind='session') FROM user_sessions s), 'Legacy session changed';
END $$;
INSERT INTO v2_programs(name) VALUES ('New synthetic platform programme');
DO $$ BEGIN ASSERT (SELECT organization_id='00000000-0000-4000-8000-000000000001'::uuid FROM v2_programs WHERE name='New synthetic platform programme'), 'Legacy insert default broken'; END $$;
""")
report={'status':'passed','source':'read-only catalog metadata; no source business rows','tables':len(s['tables']),'columns':len(s['columns']),'constraints':len(s['constraints']),'migrations':[m.name for m in migrations],'applicationsPerMigration':2,'checks':['legacy row preservation','legacy insertion default'],'productionWrites':False,'fullClone':False,'exclusions':['source functions','source triggers','source RLS policies','non-constraint indexes','performance and restoration pilot']}
Path(a.output).write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))

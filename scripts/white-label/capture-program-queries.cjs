// Capture real repository SQL without loading the app DB adapter or .env.
const path = require('path');
const Module = require('module');
const babel = require('@babel/core');
const root = path.resolve(__dirname, '../..');
const cache = new Map();
const queries = {};
let current = null;
let batchIndex = null;
const query = async (sql, args = []) => {
  if (current) queries[batchIndex === null ? current : `${current}.${batchIndex++}`] = { sql, args };
  return { rows: [] };
};
const db = { execute: (q) => query(typeof q === 'string' ? q : q.sql, q.args || []), transaction: (cb) => cb(query) };
function load(file) {
  const filename = path.resolve(root, file);
  if (cache.has(filename)) return cache.get(filename).exports;
  if (!filename.startsWith(path.join(root, 'src/models') + path.sep)) {
    throw new Error('Only model files are allowed');
  }
  const compiled = babel.transformFileSync(filename, { configFile: false, babelrc: false,
    presets: [[require.resolve('@babel/preset-env'), { targets: { node: 'current' } }]] }).code;
  const mod = new Module(filename);
  cache.set(filename, mod);
  mod.require = (name) => {
    if (name === '@/lib/db') return db;
    if (name.startsWith('@/models/')) return load('src/' + name.slice(2) + '.js');
    if (name.startsWith('./')) return load(path.relative(root, path.resolve(path.dirname(filename), name + '.js')));
    throw new Error('Unexpected model dependency: ' + name);
  };
  mod._compile(compiled, filename);
  return mod.exports;
}
async function capture(name, read) { current = name; try { await read(); } finally { current = null; } }
async function main() {
  const quick = load('src/models/programs/core/quickPrograms.js');
  const detail = load('src/models/programs/extended.js');
  const lists = load('src/models/programs/core/programList.js');
  await capture('internal.list', () => quick.getAllPrograms());
  await capture('internal.detail', () => detail.getProgramDetailById('44444444-4444-4444-8444-444444444444'));
  await capture('internal.templates', () => detail.listProgramTemplates());
  await capture('internal.managed', () => lists.listProgramsByManagementFilters({ showAll: true, session: { role: 'super_admin' } }));
  await capture('internal.activate', () => lists.autoActivatePlannedPrograms());
  await capture('internal.update', () => quick.updateProgramFields(['name = ?'], ['Should not be written', '44444444-4444-4444-8444-444444444444']));
  const supervision = load('src/models/organizations/supervisionReads.js');
  const credentials = { organizationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', cid: 'SYNTH-STAFF',
    token: 'synthetic-staff-token', tokenHash: 'synthetic-hash' };
  await supervision.withSupervisedProgramRead(credentials, async (reader) => {
    await capture('supervision.mandate', () => reader.mandate());
    const scope = { organizationId: credentials.organizationId, allPrograms: true, programIds: [], deniedProgramIds: [] };
    await capture('supervision.list', () => reader.listPrograms({ scope, search: '', offset: 0, limit: 21 }));
    await capture('supervision.detail', () => reader.findProgram({ scope, programId: '44444444-4444-4444-8444-444444444444' }));
    await capture('supervision.foreignDetail', () => reader.findProgram({ scope, programId: '55555555-5555-4555-8555-555555555555' }));
    await capture('supervision.audit', () => reader.recordUsage({ mandateId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      action: 'supervision.programs.list', entityId: credentials.organizationId, count: 1, requestId: 'synthetic-supervision-request' }));
    await capture('supervision.auditDeadline', () => reader.recordUsage({ mandateId: 'ffffffff-ffff-4fff-8fff-fffffffffff2',
      action: 'supervision.programs.list', entityId: credentials.organizationId, count: 1, requestId: 'synthetic-supervision-deadline' }));
  });
  await supervision.withSupervisedProgramRead({ ...credentials, organizationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
    (reader) => capture('supervision.otherOrganization', () => reader.mandate()));
  const workspace = load('src/models/programWorkspace.js');
  const clientId = '44444444-4444-4444-8444-444444444444';
  const legacyId = '11111111-1111-4111-8111-111111111111';
  for (const [name, id] of [['client', clientId], ['platform', legacyId]]) {
    batchIndex = 0;
    await capture(`workspace.${name}`, () => workspace.getProgramFullStateData(id));
    batchIndex = null;
    for (const type of ['participants', 'attendance', 'submissions', 'teams', 'ical']) {
      await capture(`workspace.${name}.export.${type}`, () => workspace.getProgramExportRows(type, id));
    }
    await capture(`workspace.${name}.kpi`, () => workspace.getPersistedKpiProgress(id));
  }
  await capture('workspace.schedule', () => workspace.getSuperAdminSchedule());
  await capture('workspace.ownSchedule', () => workspace.getOwnSchedule('SYNTH-STAFF'));
  await capture('workspace.assigned', () => workspace.getProgramsByAssignedPm('SYNTH-STAFF'));
  await capture('workspace.submissions', () => workspace.getSubmissionsByProgramIds([clientId, legacyId]));
  const guard = load('src/models/organizations/internalPrograms.js');
  await capture('guard.client', () => guard.findInternalProgram(clientId));
  await capture('guard.platform', () => guard.findInternalProgram(legacyId));
  const context = load('src/models/organizations/context.js');
  await context.withOrganizationSession({ organizationId: credentials.organizationId, cid: 'SYNTH-PERSON', token: 'synthetic-token', tokenHash: 'synthetic-client-hash' }, async (reader) => {
    await capture('context.session', () => reader.session());
    await capture('context.memberships', () => reader.memberships());
    await capture('context.access', () => reader.access(credentials.organizationId));
    await capture('context.current', () => reader.access());
    await capture('context.switch', () => reader.switchTo(credentials.organizationId, null));
    await capture('context.staleSwitch', () => reader.switchTo('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', null));
    await capture('context.audit', () => reader.audit({ organizationId: credentials.organizationId, previousOrganizationId: null, actorRole: 'member', requestId: 'synthetic-context-change' }));
  });
  const metrics = load('src/models/programs/core/programMetrics.js');
  for (const fn of ['countSessionsByProgram','countActiveParticipantsByProgram','countDocumentRequirementsByProgram','countReportWeeksByProgram','getAssignedFamiliesByProgram','countSubmissionsByProgram']) {
    await capture(`metrics.${fn}`, () => metrics[fn]());
  }
  process.stdout.write(JSON.stringify(queries));
}
main().catch((error) => { process.stderr.write(error.stack); process.exitCode = 1; });

/**
 * AUTHZ METRICS — Lot 0 instrumentation (READ ONLY).
 *
 * This module computes the indicators of the permissions plan from the source
 * tree. It never changes application behaviour: it only reads files and counts.
 *
 * Two consumers:
 *   - scripts/authz-metrics.js          (human dashboard / JSON / list)
 *   - src/__tests__/authz-metrics-ratchet.test.js (CI ratchet)
 *
 * Definitions are deliberately explicit: a counter is only useful if the thing
 * it counts is stated. The comments below are the contract.
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..", "..");
const SRC = path.join(ROOT, "src");
const API = path.join(SRC, "app", "api");

const ENGINE_PREFIXES = [
  path.join(SRC, "server", "authz") + path.sep,
  path.join(SRC, "models", "authorization") + path.sep,
  path.join(SRC, "services", "authorization") + path.sep,
];
const EXCLUDED_PREFIXES = [path.join(SRC, "__tests__") + path.sep];

/**
 * The four role-name mechanisms already ratcheted by
 * permissions-static-guards.test.js. A "line" is the unit: a line that matches
 * two motifs counts in both, exactly like the existing guard.
 */
const ROLE_MOTIFS = {
  M1: { label: "requireAuth([...])", re: /requireAuth\(\s*\[/ },
  M2: { label: "roles: [...]", re: /roles\s*:\s*\[/ },
  M3: { label: "role === / role !==", re: /role\s*===|role\s*!==/ },
  M4: { label: ".includes(...role...)", re: /\.includes\(.*role/ },
};

const CAPABILITY_MECHANISMS = [
  "requireAuthorization(",
  "requireScopedAccess(",
  "requireVentureScopedAccess(",
  "requireInvestorSelfServiceAuthorization(",
];

const SCOPED_MECHANISMS = [
  "requireVentureScopedAccess(",
  "requireAssignmentAccess(",
  "requireProgramScope(",
  "requireVentureAccess(",
  "requireProjectAccess(",
  "requireProgramFacilitator(",
];

const HARDCODED_ENGLISH_REFUSALS = [
  "You do not have permission",
  "Only the task creator or assignee",
  "Project not found",
  "Venture not found",
  "Task not found",
];

// ─── file helpers ───────────────────────────────────────────────────────────

function walk(directory, keep, out = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full, keep, out);
    else if (keep(entry.name)) out.push(full);
  }
  return out;
}

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function rel(file) {
  return path.relative(ROOT, file).split(path.sep).join("/");
}

function between(text, start, end) {
  const from = text.indexOf(start);
  if (from < 0) return "";
  const to = text.indexOf(end, from + start.length);
  if (to < 0) return "";
  return text.slice(from + start.length, to);
}

function lineNumber(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

function quotedValues(block) {
  return [...block.matchAll(/"([^"]+)"|'([^']+)'/g)]
    .map((match) => match[1] || match[2])
    .filter(Boolean);
}

function countLines(text, re) {
  return text.split(/\r?\n/).filter((line) => re.test(line)).length;
}

function countMatches(text, re) {
  return [...text.matchAll(re)].length;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Every call to `callee(...)` in the text, with balanced parentheses. Used to
 * answer "does THIS call pass a capability?" without a fragile line regex.
 */
function callSnippets(text, callee) {
  const snippets = [];
  const needle = new RegExp(`${escapeRegExp(callee)}\\s*\\(`, "g");
  let match;
  while ((match = needle.exec(text))) {
    const open = text.indexOf("(", match.index);
    let depth = 0;
    let quote = null;
    let escaped = false;
    for (let index = open; index < text.length; index += 1) {
      const char = text[index];
      if (quote) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === quote) quote = null;
        continue;
      }
      if (char === '"' || char === "'" || char === "`") {
        quote = char;
        continue;
      }
      if (char === "(") depth += 1;
      else if (char === ")") {
        depth -= 1;
        if (depth === 0) {
          snippets.push(text.slice(open, index + 1));
          break;
        }
      }
    }
  }
  return snippets;
}

function parseSetFromGuardTest(name) {
  const testFile = path.join(SRC, "__tests__", "permissions-static-guards.test.js");
  const text = read(testFile);
  const block = between(text, `const ${name} = new Set([`, "]);");
  return new Set(quotedValues(block).filter((value) => value.startsWith("src/")));
}

// ─── route inventory ────────────────────────────────────────────────────────

function routeFiles() {
  return walk(API, (name) => name === "route.js");
}

function routeEntries() {
  return routeFiles().map((file) => {
    const text = read(file);
    return {
      file: rel(file),
      text,
      hasRequireAuth: /requireAuth\s*\(/.test(text),
      hasCreateHandler: /createHandler\s*\(/.test(text),
      hasGetSession: /getSession\s*\(/.test(text),
      hasAuthorization: /requireAuthorization\s*\(/.test(text),
      hasCapability: hasCapabilityGate(text),
      hasScoped: hasScopedGate(text),
    };
  });
}

function hasCapabilityGate(text) {
  if (CAPABILITY_MECHANISMS.some((mechanism) => text.includes(mechanism))) {
    return true;
  }
  for (const snippet of callSnippets(text, "requireAssignmentAccess")) {
    if (/\bcapability\s*:/.test(snippet)) return true;
  }
  for (const snippet of callSnippets(text, "requireProgramScope")) {
    if (/\bmodule\s*:/.test(snippet) && /\bcapability\s*:/.test(snippet)) {
      return true;
    }
  }
  return false;
}

function hasScopedGate(text) {
  return SCOPED_MECHANISMS.some((mechanism) => text.includes(mechanism));
}

function hasSessionGate(entry) {
  return entry.hasRequireAuth || entry.hasCreateHandler || entry.hasGetSession;
}

/**
 * Exact audit counter: a route file that calls the authentication helper but
 * never calls the central capability helper. This is the "106" of the audit.
 */
function strictRequireAuthOnly(entries) {
  return entries.filter(
    (entry) => entry.hasRequireAuth && !entry.hasAuthorization,
  );
}

/**
 * Worklist: every route file that has a session/role gate but NO capability
 * gate at all (the stricter definition also catches the wrapper and manual
 * session reads). A route declared self-scoped, open-assumed, a hub or a
 * documented stub is classified separately.
 */
function worklist(entries, declarations) {
  const selfFiles = new Set(declarations.SELF_SCOPED_ROUTES.map((entry) => entry.file));
  const openFiles = new Set(declarations.OPEN_ASSUMED_ROUTES.map((entry) => entry.file));
  const prefixes = declarations.SELF_SCOPED_PREFIXES || [];
  const hubs = parseSetFromGuardTest("ROUTE_HUBS");
  const stubs = parseSetFromGuardTest("NO_GUARD_ALLOWED");

  return entries
    .filter((entry) => hasSessionGate(entry) && !entry.hasCapability)
    .map((entry) => {
      let category;
      if (
        selfFiles.has(entry.file) ||
        prefixes.some((prefix) => entry.file.startsWith(prefix))
      ) {
        category = "personnelle_legitime";
      } else if (openFiles.has(entry.file) || hubs.has(entry.file) || stubs.has(entry.file)) {
        category = "ouverte_assumee";
      } else if (entry.hasScoped) {
        // A perimeter decision exists, but no capability decision: it may be a
        // delegated decision (to verify) or a hole. Never call it safe.
        category = "a_verifier_decision_deleguee";
      } else {
        category = "a_proteger";
      }
      return {
        file: entry.file,
        category,
        auth: entry.hasRequireAuth ? "requireAuth" : entry.hasCreateHandler ? "createHandler" : "getSession",
        scoped: entry.hasScoped,
        strictAudit: entry.hasRequireAuth && !entry.hasAuthorization,
      };
    });
}

// ─── role vocabulary ────────────────────────────────────────────────────────

function roleGateEntries(entries) {
  const found = [];
  for (const entry of entries) {
    for (const match of entry.text.matchAll(/requireAuth\(\s*\[([^\]]*)\]/g)) {
      found.push({
        file: entry.file,
        form: "requireAuth",
        line: lineNumber(entry.text, match.index),
        roles: quotedValues(match[1]),
      });
    }
    for (const match of entry.text.matchAll(/roles\s*:\s*\[([^\]]*)\]/g)) {
      found.push({
        file: entry.file,
        form: "roles",
        line: lineNumber(entry.text, match.index),
        roles: quotedValues(match[1]),
      });
    }
  }
  return found;
}

function roleVocabulary(entries) {
  const featureAccess = read(path.join(SRC, "lib", "featureAccess.js"));
  const historicalRoles = quotedValues(
    between(featureAccess, "export const ALL_FEATURE_ROLES = [", "];"),
  );

  const sessionLogin = read(path.join(SRC, "app", "api", "auth", "session-login", "route.js"));
  const loginResolver = read(path.join(SRC, "models", "platform", "roles.js"));
  const resolverBlock = between(
    loginResolver,
    "export function resolveEffectiveRole",
    "\n}\n\n/**",
  );
  const resolverValues = new Set(
    [...resolverBlock.matchAll(/return\s+"([a-z_]+)"/g)].map((match) => match[1]),
  );
  // The explicit identities preserved outside the group are returned through a
  // variable; add the literal list so the union reflects what the branch can
  // actually produce.
  const preservedMatch = loginResolver.match(
    /if \(\[([^\]]*)\]\.includes\(normalizedRole\)\)/,
  );
  quotedValues(preservedMatch ? preservedMatch[1] : "").forEach((value) =>
    resolverValues.add(value),
  );
  const defaultRole = (loginResolver.match(/export const DEFAULT_ROLE\s*=\s*"([^"]+)"/) || [])[1];
  if (defaultRole) resolverValues.add(defaultRole);

  // The reversible D-1 switch produces one value for a stored program_manager:
  // the legacy role (default) or staff (AUTHZ_PM_IDENTITY=staff). Count the
  // ACTIVE mode so the dashboard can show both sides of the switch.
  resolverValues.add(
    process.env.AUTHZ_PM_IDENTITY === "staff" ? "staff" : "program_manager",
  );

  const sessionUsesSharedResolver = /resolveEffectiveRole\s*\(/.test(sessionLogin);
  const sessionLiterals = [
    ...new Set(
      [...sessionLogin.matchAll(/finalRole\s*=\s*"([^"]+)"/g)].map((match) => match[1]),
    ),
  ].sort();
  const sessionLoginValues = sessionUsesSharedResolver
    ? [...resolverValues].sort()
    : sessionLiterals;

  const profileCatalog = read(path.join(SRC, "models", "authorization", "profile-catalog.js"));
  const profileFunctions = [
    ...new Set(
      [...between(profileCatalog, "export const PROFILE_CATALOG = [", "];").matchAll(
        /\bkey:\s*"([^"]+)"/g,
      )].map((match) => match[1]),
    ),
  ];

  const pmEntries = roleGateEntries(entries).filter(
    (entry) => entry.roles.includes("program_manager") && !entry.roles.includes("staff"),
  );

  const pmFiles = new Set();
  for (const directory of ["app/api", "services", "lib", "models"]) {
    const start = path.join(SRC, directory);
    if (!fs.existsSync(start)) continue;
    for (const file of walk(start, (name) => name.endsWith(".js") || name.endsWith(".jsx"))) {
      const text = read(file);
      if (text.includes("program_manager")) pmFiles.add(rel(file));
    }
  }

  return {
    historicalRoles,
    sessionLoginValues,
    loginResolverValues: [...resolverValues].sort(),
    loginRoleValuesUnion: [
      ...new Set([...sessionLoginValues, ...resolverValues]),
    ].sort(),
    profileFunctions,
    pmRoleGateEntries: pmEntries,
    pmOccurrenceFiles: pmFiles.size,
    // The audit counted LINES, not raw occurrences. Keep the same unit so the
    // figure can be compared with the 227 of the starting point.
    pmOccurrences: [...pmFiles].reduce(
      (total, file) =>
        total + countLines(read(path.join(ROOT, file)), /program_manager/),
      0,
    ),
  };
}

// ─── scope inventory ────────────────────────────────────────────────────────

function scopeVocabulary(entries) {
  const scopeCatalog = read(
    path.join(SRC, "models", "authorization", "scope-catalog.js"),
  );
  const policies = quotedValues(
    between(scopeCatalog, "export const SCOPE_POLICY_KEYS = [", "];"),
  );

  let programScopeCalls = 0;
  let programScopeWithCapability = 0;
  const programScopeFiles = new Set();
  let ventureFull = 0;
  let legacyVenture = 0;
  let unified = 0;

  for (const entry of entries) {
    const programSnips = callSnippets(entry.text, "requireProgramScope");
    if (programSnips.length > 0) programScopeFiles.add(entry.file);
    programScopeCalls += programSnips.length;
    programScopeWithCapability += programSnips.filter(
      (snippet) => /\bmodule\s*:/.test(snippet) && /\bcapability\s*:/.test(snippet),
    ).length;

    ventureFull += countMatches(entry.text, /requireVentureScopedAccess\s*\(/g);
    legacyVenture += countMatches(entry.text, /requireVentureAccess\s*\(/g);
    unified += countMatches(entry.text, /requireScopedAccess\s*\(/g);
  }

  return {
    policies,
    programScopeCalls,
    programScopeWithCapability,
    programScopeFiles: programScopeFiles.size,
    ventureFullCalls: ventureFull,
    legacyVentureCalls: legacyVenture,
    unifiedScopedCalls: unified,
  };
}

// ─── guard ratchets ─────────────────────────────────────────────────────────

function guardRatchet() {
  const testFile = path.join(SRC, "__tests__", "permissions-static-guards.test.js");
  const testText = read(testFile);
  const exceptionsBlock = between(
    testText,
    "const ROLE_MOTIF_EXCEPTIONS = new Set([",
    "]);",
  );
  const exceptions = new Set(
    [...exceptionsBlock.matchAll(/"(src\/[^"]+#M[1-9])"/g)].map((match) => match[1]),
  );

  const foundPairs = new Set();
  const lineCounts = {};
  for (const key of Object.keys(ROLE_MOTIFS)) lineCounts[key] = 0;

  // The existing guard scans ALL production .js/.jsx files outside the engine,
  // not just route files. Reproduce that scope exactly.
  const files = walk(SRC, (name) => name.endsWith(".js") || name.endsWith(".jsx"));
  for (const file of files) {
    if (EXCLUDED_PREFIXES.some((prefix) => file.startsWith(prefix))) continue;
    if (ENGINE_PREFIXES.some((prefix) => file.startsWith(prefix))) continue;
    const filePath = rel(file);
    const lines = read(file).split(/\r?\n/);
    for (const [key, { re }] of Object.entries(ROLE_MOTIFS)) {
      lines.forEach((line) => {
        if (re.test(line)) {
          lineCounts[key] += 1;
          foundPairs.add(`${filePath}#${key}`);
        }
      });
    }
  }

  const unexpected = [...foundPairs].filter((pair) => !exceptions.has(pair)).sort();
  const stale = [...exceptions].filter((pair) => !foundPairs.has(pair)).sort();

  const extended = require(path.join(
    SRC,
    "__tests__",
    "helpers",
    "roleGateExceptionsExtended.js",
  ));
  const extendedCount = (extended.decision || []).length + (extended.display || []).length;

  return {
    staticGuardExceptions: exceptions.size,
    staticGuardUnexpected: unexpected.length,
    staticGuardStale: stale.length,
    roleMotifLineCounts: lineCounts,
    roleMotifLineTotal: Object.values(lineCounts).reduce((total, value) => total + value, 0),
    roleMotifPairCount: foundPairs.size,
    extendedGuardExceptions: extendedCount,
  };
}

// ─── fact checks (Lot 0, point 3) ───────────────────────────────────────────

function factChecks() {
  const loginResolver = read(path.join(SRC, "models", "platform", "roles.js"));
  const sessionLogin = read(path.join(SRC, "app", "api", "auth", "session-login", "route.js"));
  const ventureMembers = read(path.join(SRC, "models", "ventureMemberAccess.js"));
  const programAccess = read(path.join(SRC, "server", "authz", "programAccess.js"));
  const grantJustification = read(
    path.join(SRC, "services", "authorization", "contextGrantJustification.js"),
  );

  const englishSites = [];
  for (const directory of ["services", "lib"]) {
    const start = path.join(SRC, directory);
    if (!fs.existsSync(start)) continue;
    for (const file of walk(start, (name) => name.endsWith(".js") || name.endsWith(".jsx"))) {
      const text = read(file);
      const hits = HARDCODED_ENGLISH_REFUSALS.filter((phrase) => text.includes(phrase));
      if (hits.length > 0) {
        englishSites.push({ file: rel(file), phrases: hits });
      }
    }
  }

  return {
    // Lot 1, step 1.1 — both sign-in paths now use the same resolver.
    loginRoutesShareResolver:
      /resolveEffectiveRole\s*\(/.test(loginResolver) &&
      /resolveEffectiveRole\s*\(/.test(sessionLogin),
    sessionLoginHasNoOwnProgramManagerBranch:
      !/finalRole\s*=\s*"program_manager"/.test(sessionLogin),
    // D-1 is reversible: the default keeps the legacy role until the profile
    // coverage audit (step 1.4); AUTHZ_PM_IDENTITY=staff enables the target.
    programManagerIdentityMode:
      process.env.AUTHZ_PM_IDENTITY === "staff" ? "staff" : "role",
    canonicalResolverSupportsStaffMode:
      /resolveProgramManagerIdentity\s*\(/.test(loginResolver) &&
      /INTERNAL_STAFF_ROLE/.test(read(path.join(SRC, "lib", "identity.js"))),
    // D-2 — the roster comment and code now say the same thing.
    ventureRosterCommentMatchesCode:
      /platform owner sees the roster/i.test(ventureMembers) &&
      /isPlatformOwnerRole\(userRole\)/.test(ventureMembers),
    facilitatorGuardReadsAssignmentJson: /assignment\?\.permissions/.test(programAccess),
    facilitatorGrantsWritePersonalRights: /deriveFacilitatorDesiredCaps/.test(
      grantJustification,
    ),
    hardcodedEnglishRefusalSites: englishSites,
  };
}

// ─── public API ─────────────────────────────────────────────────────────────

function collectMetrics() {
  const declarations = require(path.join(
    SRC,
    "services",
    "authorization",
    "actionDeclarations.js",
  ));
  const entries = routeEntries();
  const strict = strictRequireAuthOnly(entries);
  const list = worklist(entries, declarations);
  const capabilities = entries.filter((entry) => entry.hasCapability);
  const centralCapabilities = entries.filter((entry) => entry.hasAuthorization);
  const requireAuthFiles = entries.filter((entry) => entry.hasRequireAuth);

  // The audit counted every JS file under the server action tree, including the
  // platform form-run handlers. Keep that figure (169) AND the route-file-only
  // figure (147), because they answer different questions.
  const apiFiles = walk(API, (name) => name.endsWith(".js"));
  const centralCapabilityFiles = apiFiles.filter((file) =>
    /requireAuthorization\s*\(/.test(read(file)),
  ).length;
  const capabilityFiles = apiFiles.filter((file) => hasCapabilityGate(read(file))).length;
  const both = entries.filter(
    (entry) => entry.hasRequireAuth && entry.hasAuthorization,
  );

  const byCategory = {
    a_proteger: list.filter((entry) => entry.category === "a_proteger"),
    a_verifier_decision_deleguee: list.filter(
      (entry) => entry.category === "a_verifier_decision_deleguee",
    ),
    personnelle_legitime: list.filter(
      (entry) => entry.category === "personnelle_legitime",
    ),
    ouverte_assumee: list.filter((entry) => entry.category === "ouverte_assumee"),
  };

  const vocabulary = roleVocabulary(entries);
  const ratchet = guardRatchet();

  return {
    generatedAt: new Date().toISOString(),
    routes: {
      routeFiles: entries.length,
      centralCapabilityFiles,
      capabilityFiles,
      centralCapabilityRouteFiles: centralCapabilities.length,
      capabilityRouteFiles: capabilities.length,
      requireAuthRouteFiles: requireAuthFiles.length,
      bothRouteFiles: both.length,
      strictRequireAuthOnlyNoCapability: strict.length,
      strictRequireAuthOnlyList: strict.map((entry) => ({
        file: entry.file,
        composedCapability: entry.hasCapability,
        scoped: entry.hasScoped,
      })),
      withoutCapabilityWorklist: list.length,
      withoutCapabilityByCategory: {
        a_proteger: byCategory.a_proteger.length,
        a_verifier_decision_deleguee: byCategory.a_verifier_decision_deleguee.length,
        personnelle_legitime: byCategory.personnelle_legitime.length,
        ouverte_assumee: byCategory.ouverte_assumee.length,
      },
      withoutCapabilityList: list,
    },
    roleGates: {
      ...ratchet,
      hardcodedRoleListsInActions: roleGateEntries(entries).length,
      pmOnlyRoleGates: vocabulary.pmRoleGateEntries.length,
    },
    roleVocabulary: vocabulary,
    scope: scopeVocabulary(entries),
    facts: factChecks(),
  };
}

/** Debt metrics go DOWN; capability metrics go UP. */
const DIRECTIONS = {
  strictRequireAuthOnlyNoCapability: "down",
  withoutCapabilityWorklist: "down",
  "withoutCapabilityByCategory.a_proteger": "down",
  "withoutCapabilityByCategory.a_verifier_decision_deleguee": "down",
  hardcodedRoleListsInActions: "down",
  staticGuardExceptions: "down",
  staticGuardUnexpected: "down",
  staticGuardStale: "down",
  roleMotifLineTotal: "down",
  roleMotifPairCount: "down",
  extendedGuardExceptions: "down",
  pmOnlyRoleGates: "down",
  pmOccurrences: "down",
  "roleVocabulary.historicalRoles": "down",
  "roleVocabulary.sessionLoginValues": "down",
  "roleVocabulary.loginResolverValues": "down",
  "roleVocabulary.loginRoleValuesUnion": "down",
  "scope.programScopeCalls": "down",
  "scope.programScopeWithCapability": "up",
  "scope.legacyVentureCalls": "down",
  "scope.unifiedScopedCalls": "up",
  "scope.policies": "down",
  capabilityRouteFiles: "up",
  ventureFullCalls: "up",
};

function readPath(object, pathText) {
  return pathText.split(".").reduce((value, key) => (value ? value[key] : undefined), object);
}

function compareToBaseline(metrics, baseline) {
  const problems = [];
  for (const [key, expected] of Object.entries(baseline.metrics || {})) {
    const actual = readPath(metrics, key);
    if (actual === undefined) {
      problems.push(`${key}: absent du calcul`);
      continue;
    }
    const direction = expected.direction || DIRECTIONS[key] || "stable";
    if (typeof actual === "object") {
      const actualLength = Array.isArray(actual) ? actual.length : NaN;
      if (Number.isNaN(actualLength)) {
        problems.push(`${key}: valeur non numérique`);
        continue;
      }
      if (direction === "down" && actualLength > expected.value) {
        problems.push(`${key}: ${actualLength} > ${expected.value} (dette en hausse)`);
      } else if (direction === "up" && actualLength < expected.value) {
        problems.push(`${key}: ${actualLength} < ${expected.value} (couverture en baisse)`);
      }
      continue;
    }
    if (direction === "down" && actual > expected.value) {
      problems.push(`${key}: ${actual} > ${expected.value} (dette en hausse)`);
    } else if (direction === "up" && actual < expected.value) {
      problems.push(`${key}: ${actual} < ${expected.value} (couverture en baisse)`);
    } else if (direction === "stable" && actual !== expected.value) {
      problems.push(`${key}: ${actual} ≠ ${expected.value}`);
    }
  }
  return problems;
}

module.exports = {
  ROOT,
  SRC,
  collectMetrics,
  compareToBaseline,
  DIRECTIONS,
};

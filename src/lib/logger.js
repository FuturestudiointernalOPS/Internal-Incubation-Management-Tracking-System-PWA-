/**
 * STRUCTURED LOGGER — one event, one line, nothing sensitive.
 *
 * Why this exists: production diagnosis needs events that can be filtered by
 * name and joined by request id — "how many `program_update_failed` in the last
 * hour, and on which requests" — which free-form `console.log("something broke")`
 * cannot answer. This module is deliberately tiny: no transport, no
 * dependencies, no network. It formats a record and writes one line.
 *
 * Two rules are enforced HERE, not by convention:
 *
 *   1. SECRETS AND PERSONAL DATA ARE REDACTED BY KEY, recursively, before the
 *      record is serialised. A password, a session token, a cookie, an API key,
 *      a connection string or an email never reaches a sink because a caller
 *      forgot. See SECRET_KEY / PII_KEY below.
 *   2. A REQUEST/RESPONSE OBJECT IS NEVER DUMPED. Passing `req` directly yields
 *      `"[request]"`, because a request carries headers (cookies, Authorization)
 *      and a body that must not be logged wholesale.
 *
 * Usage:
 *   logger.info("program_updated", { requestId, userId, programId });
 *   logger.error("program_update_failed", { requestId, userId, error: err });
 *
 * In production (`NODE_ENV=production`) a record is a single JSON line, ready for
 * a log drain. Everywhere else it is a readable line. The level comes from
 * `LOG_LEVEL` (`debug|info|warn|error|silent`); the default is `info` in
 * production, `warn` under test (so the suite stays quiet) and `debug` locally.
 */

import { getRequestId } from "@/lib/request-context";

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };

const REDACTED = "[redacted]";

/**
 * Keys whose VALUE is a credential. Matched case-insensitively against the key
 * name at every depth, so `{ headers: { Authorization: "…" } }` is caught too.
 * Broad on purpose: a false positive loses a log field, a false negative leaks a
 * secret.
 */
const SECRET_KEY =
  /pass(word|wd|phrase)?|token|secret|api[_-]?key|apikey|cookie|authorization|auth[_-]?header|credential|private[_-]?key|connection[_-]?string|database[_-]?url|dsn|signature|client[_-]?secret|refresh|access[_-]?token|session[_-]?id/i;

/**
 * Keys whose value is personal data. Redacted by default; a caller that truly
 * needs the value for a controlled, non-log path should not be logging at all.
 * (Diagnostics that must correlate a person use `userId` / `cid`, not an email.)
 */
const PII_KEY = /e[_-]?mail|phone|mobile|address|ssn|iban|card[_-]?number|date[_-]?of[_-]?birth|dob|passport/i;

const MAX_DEPTH = 6;
const MAX_ARRAY = 50;
const MAX_STRING = 2000;

/** Resolve the active level on every call, so a test can set LOG_LEVEL. */
function resolveLevel() {
  const explicit = String(process.env.LOG_LEVEL || "").toLowerCase();
  if (explicit in LEVELS) return LEVELS[explicit];
  if (process.env.NODE_ENV === "production") return LEVELS.info;
  if (process.env.NODE_ENV === "test") return LEVELS.warn;
  return LEVELS.debug;
}

/** A Request/Response (or anything shaped like one) is never serialised. */
function isRequestLike(value) {
  return (
    value &&
    typeof value === "object" &&
    typeof value.headers?.get === "function" &&
    (typeof value.json === "function" || typeof value.text === "function")
  );
}

/** An Error becomes name/message/stack — the diagnostic parts, nothing else. */
export function sanitizeError(error) {
  if (!error) return null;
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  if (typeof error === "object") {
    return {
      name: error.name || "Error",
      message: error.message || String(error),
      ...(error.code ? { code: error.code } : {}),
      ...(error.stack ? { stack: error.stack } : {}),
    };
  }
  return { message: String(error) };
}

function truncate(text) {
  const str = String(text);
  return str.length > MAX_STRING ? `${str.slice(0, MAX_STRING)}…[truncated]` : str;
}

/**
 * Deep-copy `input`, replacing any value under a secret/PII key with
 * `"[redacted]"` and any request/response object with `"[request]"`.
 * Cycles are cut at MAX_DEPTH. Never throws.
 */
export function redact(input, { depth = 0, allowPii = false } = {}) {
  try {
    if (input === null || input === undefined) return input;
    if (depth >= MAX_DEPTH) return "[truncated]";

    const type = typeof input;
    if (type === "string") return truncate(input);
    if (type !== "object") return input;

    if (input instanceof Date) return input.toISOString();
    if (input instanceof Error) return sanitizeError(input);
    if (isRequestLike(input)) return "[request]";

    if (Array.isArray(input)) {
      return input
        .slice(0, MAX_ARRAY)
        .map((item) => redact(item, { depth: depth + 1, allowPii }));
    }

    const out = {};
    for (const [key, value] of Object.entries(input)) {
      if (SECRET_KEY.test(key) || (!allowPii && PII_KEY.test(key))) {
        out[key] = REDACTED;
      } else {
        out[key] = redact(value, { depth: depth + 1, allowPii });
      }
    }
    return out;
  } catch {
    return "[unserializable]";
  }
}

/** Build the record that will be written (exported for tests). */
export function buildRecord(level, event, fields = {}) {
  const base = {
    ts: new Date().toISOString(),
    level,
    event: String(event),
  };
  const extra = redact(fields);
  // Caller fields must not overwrite the reserved envelope keys.
  for (const [key, value] of Object.entries(extra)) {
    if (!(key in base)) base[key] = value;
  }
  // Attach the ambient correlation id when the caller did not carry one, so a
  // line written deep in a request can always be joined to the request.
  if (!("requestId" in base)) {
    try {
      const requestId = getRequestId();
      if (requestId) base.requestId = requestId;
    } catch {
      // No request context (a cron script, a test): nothing to attach.
    }
  }
  return base;
}

function write(level, event, fields) {
  if (LEVELS[level] < resolveLevel()) return;

  let record;
  try {
    record = buildRecord(level, event, fields);
  } catch {
    return; // logging must never break the request it describes
  }

  const sink = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  try {
    if (process.env.NODE_ENV === "production") {
      sink(JSON.stringify(record));
    } else {
      const { ts: _ts, level: lvl, event: evt, ...rest } = record;
      const tail = Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : "";
      sink(`[${lvl}] ${evt}${tail}`);
    }
  } catch {
    // A broken stdout (EPIPE) is not the caller's problem.
  }
}

export const logger = {
  debug: (event, fields) => write("debug", event, fields),
  info: (event, fields) => write("info", event, fields),
  warn: (event, fields) => write("warn", event, fields),
  error: (event, fields) => write("error", event, fields),
};

export default logger;

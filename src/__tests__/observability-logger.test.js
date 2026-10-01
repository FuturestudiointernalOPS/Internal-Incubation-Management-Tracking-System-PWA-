/**
 * OBSERVABILITY — structured logging and sanitization (regression tests).
 *
 * The point of these tests is the RULE they pin: a secret or a personal value
 * must never reach a sink because a caller forgot. They are deliberately written
 * against the serialized OUTPUT (the JSON string), not against internal calls,
 * because it is the output that leaks.
 *
 * Covered:
 *   - credentials (password, token, cookie, authorization, api key, DSN) redacted
 *     at every depth,
 *   - personal data (email, phone) redacted by default,
 *   - a request/response object is never dumped,
 *   - an Error is reduced to name/message/stack,
 *   - the envelope keys (ts/level/event) cannot be overwritten by caller fields,
 *   - the level gate is honoured, and production emits one JSON line.
 */

const {
  logger,
  redact,
  buildRecord,
  sanitizeError,
} = require("@/lib/logger");

const withEnv = (vars, fn) => {
  const saved = {};
  for (const [key, value] of Object.entries(vars)) {
    saved[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return fn();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
};

describe("redact — secrets are removed by key, at every depth", () => {
  test("top-level credentials are replaced, not logged", () => {
    const out = redact({
      password: "hunter2",
      token: "abc.def.ghi",
      sessionToken: "sess_123",
      apiKey: "sk-live-xxx",
      authorization: "Bearer xyz",
      cookie: "impactos_session=deadbeef",
      databaseUrl: "postgres://user:pw@host/db",
      userId: "USR-1",
    });

    expect(out.userId).toBe("USR-1"); // the diagnostic id survives
    for (const key of [
      "password",
      "token",
      "sessionToken",
      "apiKey",
      "authorization",
      "cookie",
      "databaseUrl",
    ]) {
      expect(out[key]).toBe("[redacted]");
    }
    expect(JSON.stringify(out)).not.toContain("hunter2");
    expect(JSON.stringify(out)).not.toContain("sk-live-xxx");
    expect(JSON.stringify(out)).not.toContain("deadbeef");
  });

  test("secrets nested inside headers/objects are still caught", () => {
    const out = redact({
      headers: { Authorization: "Bearer xyz", Cookie: "a=b", "x-trace": "keep" },
      body: { user: { password: "p", email: "person@example.com" } },
    });

    expect(out.headers.Authorization).toBe("[redacted]");
    expect(out.headers.Cookie).toBe("[redacted]");
    expect(out.headers["x-trace"]).toBe("keep");
    expect(out.body.user.password).toBe("[redacted]");
  });

  test("personal data is redacted by default, and only by an explicit opt-in", () => {
    const withPii = redact({ email: "person@example.com", phone: "+22501020304" });
    expect(withPii.email).toBe("[redacted]");
    expect(withPii.phone).toBe("[redacted]");

    const allowed = redact(
      { email: "person@example.com" },
      { allowPii: true },
    );
    expect(allowed.email).toBe("person@example.com");
  });

  test("a request/response object is never serialised wholesale", () => {
    const requestLike = {
      url: "https://app.example/api/x",
      headers: { get: () => "Bearer secret" },
      json: async () => ({}),
    };
    expect(redact({ req: requestLike }).req).toBe("[request]");
  });

  test("arrays are redacted element-wise and bounded", () => {
    const out = redact({ items: [{ password: "a" }, { password: "b" }] });
    expect(out.items).toEqual([{ password: "[redacted]" }, { password: "[redacted]" }]);

    const many = redact({ items: Array.from({ length: 100 }, (_, i) => i) });
    expect(many.items).toHaveLength(50);
  });

  test("cycles terminate without throwing", () => {
    const cycle = { name: "x" };
    cycle.self = cycle;

    let out;
    expect(() => {
      out = redact(cycle);
    }).not.toThrow();
    // The recursion is bounded: somewhere down the chain it stops.
    expect(JSON.stringify(out)).toContain("[truncated]");
  });
});

describe("sanitizeError — the diagnostic parts, nothing else", () => {
  test("an Error becomes name/message/stack", () => {
    const err = new Error("boom");
    const out = sanitizeError(err);
    expect(out.name).toBe("Error");
    expect(out.message).toBe("boom");
    expect(typeof out.stack).toBe("string");
  });

  test("a non-Error error object keeps its code", () => {
    expect(sanitizeError({ name: "PgError", message: "dup", code: "23505" })).toEqual({
      name: "PgError",
      message: "dup",
      code: "23505",
    });
  });

  test("null/undefined degrade to null", () => {
    expect(sanitizeError(null)).toBeNull();
    expect(sanitizeError(undefined)).toBeNull();
  });
});

describe("buildRecord — a stable envelope", () => {
  test("carries ts/level/event and cannot be overwritten by caller fields", () => {
    const record = buildRecord("info", "program_updated", {
      event: "spoofed",
      level: "error",
      ts: "nope",
      programId: "P-1",
    });

    expect(record.event).toBe("program_updated");
    expect(record.level).toBe("info");
    expect(record.ts).not.toBe("nope");
    expect(record.programId).toBe("P-1");
  });

  test("redacts the caller's fields inside the record", () => {
    const record = buildRecord("warn", "auth_login_failed", {
      password: "p",
      email: "e@x.com",
      userId: "U-1",
    });
    expect(record.password).toBe("[redacted]");
    expect(record.email).toBe("[redacted]");
    expect(record.userId).toBe("U-1");
  });
});

describe("logger — the level gate and the wire format", () => {
  test("a message below the configured level is dropped", () => {
    const log = jest.spyOn(console, "log").mockImplementation(() => {});
    withEnv({ LOG_LEVEL: "error" }, () => {
      logger.info("should_not_appear", { a: 1 });
    });
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });

  test("production writes exactly one JSON line", () => {
    const log = jest.spyOn(console, "log").mockImplementation(() => {});
    withEnv({ NODE_ENV: "production", LOG_LEVEL: "info" }, () => {
      logger.info("program_created", { programId: "P-9", token: "leak" });
    });

    expect(log).toHaveBeenCalledTimes(1);
    const line = log.mock.calls[0][0];
    const parsed = JSON.parse(line);
    expect(parsed.event).toBe("program_created");
    expect(parsed.level).toBe("info");
    expect(parsed.programId).toBe("P-9");
    expect(parsed.token).toBe("[redacted]");
    expect(line).not.toContain("leak");
    log.mockRestore();
  });

  test("errors go to the error sink", () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    withEnv({ LOG_LEVEL: "debug" }, () => {
      logger.error("request_failed", { error: new Error("kaboom") });
    });
    const line = error.mock.calls.map((call) => call[0]).join(" ");
    expect(line).toContain("request_failed");
    expect(line).toContain("kaboom");
    error.mockRestore();
  });

  test("silent level writes nothing anywhere", () => {
    const log = jest.spyOn(console, "log").mockImplementation(() => {});
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    withEnv({ LOG_LEVEL: "silent" }, () => {
      logger.debug("d");
      logger.info("i");
      logger.warn("w");
      logger.error("e");
    });
    expect(log).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    log.mockRestore();
    warn.mockRestore();
    error.mockRestore();
  });
});

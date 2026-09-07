/**
 * Phase 2 — Contact identity reconciliation tests
 *
 * Covers resolvePersonIdentity (primary email → alternative email → phone →
 * matched / conflict / new), duplicate flagging, alternative-email add
 * conflicts across people, and pending-contact creation.
 */

jest.mock("@/lib/db", () => {
  const execute = jest.fn();
  return {
    __esModule: true,
    default: { execute },
    initDb: jest.fn().mockResolvedValue(true),
  };
});

const db = require("@/lib/db").default;
const {
  resolvePersonIdentity,
  addContactEmail,
  resolveOrCreateContactIdentity,
  normalizeEmail,
  normalizePhone,
} = require("@/lib/contactIdentity");

// Simulated rows per query family (reset per test)
const DB = {
  primary: [], // SELECT cid, deleted FROM contacts WHERE LOWER(email)
  alt: [],     // contact_emails join contacts
  phone: [],   // contacts.phone_norm
  existingByEmail: [], // SELECT cid FROM contacts WHERE LOWER(email)
  primaryRow: [], // SELECT email FROM contacts WHERE cid
  takenElsewhere: [], // contact_emails same email other contact
  insertIds: [],
};

function installMock() {
  db.execute.mockImplementation(async ({ sql }) => {
    const s = sql || "";
    if (
      s.includes("CREATE TABLE") || s.includes("CREATE UNIQUE INDEX") ||
      s.includes("CREATE INDEX") || s.includes("ALTER TABLE") ||
      s.includes("UPDATE contacts") ||
      s.includes("INSERT INTO contact_roles") || s.includes("UPDATE contact_roles")
    ) {
      return { rows: [] };
    }
    if (s.includes("INSERT INTO contact_duplicate_flags")) {
      return { rows: DB.insertIds.length ? [{ id: DB.insertIds.shift() }] : [] };
    }
    if (s.includes("SELECT cid, deleted FROM contacts WHERE LOWER(email)")) {
      return { rows: DB.primary };
    }
    if (s.includes("ce.contact_cid <> ?")) {
      return { rows: DB.takenElsewhere };
    }
    if (s.includes("FROM contact_emails ce")) {
      return { rows: DB.alt };
    }
    if (s.includes("phone_norm = ?")) {
      return { rows: DB.phone };
    }
    if (s.includes("SELECT email FROM contacts WHERE cid = ?")) {
      return { rows: DB.primaryRow };
    }
    if (s.includes("ce.contact_cid <> ?")) {
      return { rows: DB.takenElsewhere };
    }
    if (s.includes("SELECT cid FROM contacts WHERE LOWER(email)")) {
      return { rows: DB.existingByEmail };
    }
    if (s.includes("RETURNING id")) {
      return { rows: DB.insertIds.length ? [{ id: DB.insertIds.shift() }] : [] };
    }
    return { rows: [] };
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  Object.keys(DB).forEach((k) => { DB[k] = []; });
  installMock();
});

describe("normalization", () => {
  it("normalizes email to lowercase/trimmed and phone to digits", () => {
    expect(normalizeEmail("  John@FarmLink.COM ")).toBe("john@farmlink.com");
    expect(normalizePhone("+229 97 00 00 00")).toBe("22997000000");
  });
});

describe("resolvePersonIdentity", () => {
  it("matches an existing contact by primary email", async () => {
    DB.primary = [{ cid: "CID-1", deleted: 0 }];
    const result = await resolvePersonIdentity({ email: "john@farmlink.com" });
    expect(result.status).toBe("matched");
    expect(result.contact_cid).toBe("CID-1");
    expect(result.sources).toContain("primary_email");
  });

  it("matches an existing contact by alternative email", async () => {
    DB.alt = [{ cid: "CID-2" }];
    const result = await resolvePersonIdentity({ email: "john@company.com" });
    expect(result.status).toBe("matched");
    expect(result.contact_cid).toBe("CID-2");
    expect(result.sources).toContain("alternative_email");
  });

  it("matches by phone when email matches nobody", async () => {
    DB.phone = [{ cid: "CID-3" }];
    const result = await resolvePersonIdentity({ email: "nobody@x.com", phone: "+229 97 00 00 00" });
    expect(result.status).toBe("matched");
    expect(result.contact_cid).toBe("CID-3");
    expect(result.sources).toContain("phone");
  });

  it("flags a conflict when email and phone resolve to different contacts (no auto-create, no merge)", async () => {
    DB.primary = [{ cid: "CID-A", deleted: 0 }];
    DB.phone = [{ cid: "CID-B" }];
    DB.insertIds = [1];
    const result = await resolvePersonIdentity({ email: "a@x.com", phone: "+229 97 00 00 00" });
    expect(result.status).toBe("conflict");
    expect(result.matches.length).toBe(2);
    expect(result.flagged).toBe(true);
    const dupCall = db.execute.mock.calls.find(([c]) => c.sql.includes("contact_duplicate_flags"));
    expect(dupCall).toBeDefined();
  });

  it("returns new when nothing matches", async () => {
    const result = await resolvePersonIdentity({ email: "brand-new@x.com", phone: null });
    expect(result.status).toBe("new");
  });
});

describe("addContactEmail", () => {
  it("refuses an email that already belongs to another contact", async () => {
    DB.primaryRow = [{ email: "john@farmlink.com" }];
    DB.takenElsewhere = [{ contact_cid: "CID-OTHER" }];
    const result = await addContactEmail({ contactCid: "CID-1", email: "john@company.com" });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/another Contact/i);
  });

  it("adds an alternative email when free", async () => {
    DB.primaryRow = [{ email: "john@farmlink.com" }];
    DB.insertIds = [42];
    const result = await addContactEmail({ contactCid: "CID-1", email: "john@company.com" });
    expect(result.ok).toBe(true);
    expect(result.id).toBe(42);
  });
});

describe("resolveOrCreateContactIdentity", () => {
  it("reuses an existing contact matched via an alternative email", async () => {
    DB.alt = [{ cid: "CID-EXISTING" }];
    const cid = await resolveOrCreateContactIdentity({ email: "john@company.com", name: "John" });
    expect(cid).toBe("CID-EXISTING");
  });

  it("creates a pending contact when the person is new", async () => {
    const cid = await resolveOrCreateContactIdentity({ email: "mary@new.com", name: "Mary" });
    expect(cid).toMatch(/^USR_/);
    const insertCall = db.execute.mock.calls.find(([c]) => c.sql.includes("INSERT INTO contacts"));
    expect(insertCall).toBeDefined();
    expect(insertCall[0].args[4]).toBe("pending");
  });
});

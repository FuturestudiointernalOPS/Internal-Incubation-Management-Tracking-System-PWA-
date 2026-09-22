/**
 * Stored object names — the key is written by the code, never by the browser.
 *
 * Reported failure: attaching an .xlsx whose name contained an en dash "–" came
 * back "Upload failed: Invalid key: …" and stored nothing. The name went to
 * storage exactly as the browser sent it, and the storage service accepts only
 * a narrow ASCII subset of characters in a key — so the whole upload failed
 * over the way the file happened to be named on someone's desktop.
 *
 * These tests lock the rule: whatever the file is called, the key handed to
 * storage is one storage accepts.
 */
const { safeStorageName, safeStoragePath } = require("@/lib/storageNames");

/**
 * The subset the storage service accepts in an object key. A single character
 * outside it makes the service refuse the ENTIRE upload, so every key we build
 * must match this.
 */
const STORAGE_ACCEPTED_KEY = /^[A-Za-z0-9_/!.*'() &$=@;:+,?-]*$/;

const REPORTED_NAME =
  "Future Studio – Formulaire de candidature fondateurs Run-participants.xlsx";

describe("a file name becomes a key storage accepts", () => {
  test("the name that failed the upload now produces a valid key", () => {
    const rawKey = `1790080155953_${REPORTED_NAME}`;
    // Exactly what storage was sent, and refused.
    expect(STORAGE_ACCEPTED_KEY.test(rawKey)).toBe(false);

    const key = safeStoragePath(
      `deliverables/VNT-3ECFB390/2b7feb6c-763a-48e1-84a0-d768cd4abfbf/${rawKey}`,
    );

    expect(STORAGE_ACCEPTED_KEY.test(key)).toBe(true);
    expect(key).toContain("1790080155953_Future_Studio");
    expect(key).toContain("Run-participants");
  });

  test("the extension survives, so the stored file still opens the right way", () => {
    expect(safeStorageName(REPORTED_NAME)).toMatch(/\.xlsx$/);
    expect(safeStorageName("Rapport financier – Q3.pdf")).toMatch(/\.pdf$/);
  });

  test("accents, dashes and spaces are all replaced", () => {
    const name = safeStorageName("Décision – comité #2 (2026).pdf");
    expect(name).toBe("D_cision___comit___2__2026_.pdf");
    expect(STORAGE_ACCEPTED_KEY.test(name)).toBe(true);
  });

  test("a file name can never escape the folder it is stored in", () => {
    const name = safeStorageName("../../etc/passwd.pdf");
    expect(name).not.toContain("/");
    expect(STORAGE_ACCEPTED_KEY.test(name)).toBe(true);
  });

  test("a name outside the accepted characters at all still yields a key", () => {
    expect(safeStorageName("", "evidence")).toBe("evidence");
    expect(safeStorageName(null, "evidence")).toBe("evidence");
    expect(safeStorageName(undefined, "file")).toBe("file");
  });

  test("a very long name keeps its tail, so the key stays usable", () => {
    const name = safeStorageName(`${"a".repeat(200)}.pdf`);
    expect(name).toHaveLength(120);
    expect(name).toMatch(/\.pdf$/);
  });
});

describe("a whole object key", () => {
  test("every segment is sanitized, not just the file name", () => {
    expect(safeStoragePath("deliverables/VNT 1/dv 2/mon plan.xlsx")).toBe(
      "deliverables/VNT_1/dv_2/mon_plan.xlsx",
    );
  });

  test("empty segments are dropped instead of moving the object", () => {
    expect(safeStoragePath("runs/12/ /1234-rubric.pdf")).toBe("runs/12/1234-rubric.pdf");
    expect(safeStoragePath("sections/C-1/S-1/")).toBe("sections/C-1/S-1");
  });

  test("an empty path still names an object", () => {
    expect(safeStoragePath("")).toBe("file");
  });
});

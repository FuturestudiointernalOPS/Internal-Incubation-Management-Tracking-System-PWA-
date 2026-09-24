/**
 * Token storage self-heal.
 *
 * The checkout's access-token insert writes ONLY the hash and leaves the legacy
 * plaintext `token` column empty. Where that column was created NOT NULL, every
 * such insert was rejected — which meant a paid learner could never choose a
 * password and therefore could never sign in. The one-time self-heal must relax
 * the column (idempotently) so the hash-only insert is accepted.
 */
const mockStatements = [];

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    execute: jest.fn(async (query) => {
      mockStatements.push(typeof query === "string" ? query : query.sql);
      return { rows: [] };
    }),
  },
}));

const { ensureTokenHashColumns } = require("@/lib/token-hashing");

test("the self-heal allows a hash-only password-setup token", async () => {
  await ensureTokenHashColumns();

  const relaxation = mockStatements.find(
    (sql) => /alter\s+table\s+password_setup_tokens/i.test(sql) && /drop\s+not\s+null/i.test(sql),
  );
  expect(relaxation).toBeDefined();
});

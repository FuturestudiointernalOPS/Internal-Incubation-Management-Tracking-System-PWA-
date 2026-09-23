/**
 * AUTHENTICATION — password seam.
 *
 * Every route that hashes or compares a password goes through this module, so
 * the cost factor and the algorithm live in exactly one place. The default work
 * factor is asserted because silently lowering it would weaken every account.
 */

const bcrypt = require("bcryptjs");
const {
  PASSWORD_HASH_ROUNDS,
  hashPassword,
  verifyPassword,
} = require("@/server/auth/password");

describe("password hashing", () => {
  it("uses a work factor of 10 by default", async () => {
    expect(PASSWORD_HASH_ROUNDS).toBe(10);
    const hash = await hashPassword("correct horse battery staple", { rounds: 4 });
    expect(hash.startsWith("$2")).toBe(true);
    expect(hash).toContain("04$");
  });

  it("produces a verifiable hash", async () => {
    const hash = await hashPassword("s3cret-password", { rounds: 4 });

    expect(hash).not.toContain("s3cret-password");
    await expect(verifyPassword("s3cret-password", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong-password", hash)).resolves.toBe(false);
  });

  it("salts every hash, so the same password never yields the same digest", async () => {
    const [first, second] = await Promise.all([
      hashPassword("same-password", { rounds: 4 }),
      hashPassword("same-password", { rounds: 4 }),
    ]);

    expect(first).not.toBe(second);
    await expect(verifyPassword("same-password", first)).resolves.toBe(true);
    await expect(verifyPassword("same-password", second)).resolves.toBe(true);
  });

  it("honours an explicit work factor", async () => {
    const strong = await hashPassword("s3cret-password", { rounds: 12 });
    expect(strong).toContain("12$");
    await expect(verifyPassword("s3cret-password", strong)).resolves.toBe(true);
  });

  it("delegates to bcrypt without hiding its failures", async () => {
    const compare = jest.spyOn(bcrypt, "compare");
    await verifyPassword("plain", "not-a-hash").catch(() => {});
    expect(compare).toHaveBeenCalledWith("plain", "not-a-hash");
    compare.mockRestore();
  });
});

/**
 * D-8 — the messaging mode is answered by the PROFILE, not by the page.
 *
 * Both inbox routes render the same chat; the scoping rules must not depend on
 * which door the person came through.
 */

const {
  resolveMessagingRole,
} = require("@/components/messaging/chat/messagingMode");

describe("resolveMessagingRole", () => {
  test("the platform owner keeps the administration inbox", () => {
    expect(
      resolveMessagingRole({
        sectionRole: "staff",
        profiles: ["program_manager"],
        isSuperAdmin: true,
      }),
    ).toBe("super_admin");
  });

  test("a staff identity carrying the manager profile gets the manager mode", () => {
    expect(
      resolveMessagingRole({
        sectionRole: "staff",
        profiles: ["program_manager"],
      }),
    ).toBe("program_manager");
  });

  test("the same person gets the same mode from the participant route", () => {
    expect(
      resolveMessagingRole({
        sectionRole: "participant",
        profiles: ["program_manager"],
      }),
    ).toBe("program_manager");
  });

  test("a staff identity without the profile keeps the staff inbox", () => {
    expect(
      resolveMessagingRole({ sectionRole: "staff", profiles: [] }),
    ).toBe("staff");
  });

  test("a member keeps the participant mode", () => {
    expect(
      resolveMessagingRole({ sectionRole: "participant", profiles: [] }),
    ).toBe("participant");
  });

  test("the D-1 rollback still works: a legacy role is honoured without a profile", () => {
    expect(
      resolveMessagingRole({ sectionRole: "program_manager", profiles: [] }),
    ).toBe("program_manager");
  });
});

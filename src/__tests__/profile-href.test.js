import { profileHrefFor } from "@/components/layout/shell/navigation";
import { PROGRAM_MANAGER_PROFILE } from "@/lib/identity";

describe("profileHrefFor", () => {
  it.each([
    ["super_admin", "/admin/profile"],
    ["program_manager", "/pm/profile"],
    ["facilitator", "/facilitator/profile"],
    ["investor", "/investor/profile"],
    ["member", "/participant/profile"],
    ["staff", "/participant/profile"],
  ])("sends %s to %s", (role, href) => {
    expect(profileHrefFor(role)).toBe(href);
  });

  it("sends staff holding the program-manager profile to the PM space", () => {
    expect(profileHrefFor("staff", [PROGRAM_MANAGER_PROFILE])).toBe("/pm/profile");
  });
});

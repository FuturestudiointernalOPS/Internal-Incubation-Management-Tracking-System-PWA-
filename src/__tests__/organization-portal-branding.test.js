import { resolveOrganizationPortalBranding } from "@/components/ui/organizationPortalBranding";

test("uses a trimmed organisation brand and a safe HTTPS logo", () => {
  expect(resolveOrganizationPortalBranding({
    name: "Original name",
    branding: {
      displayName: "  Client name  ",
      logoUrl: "https://assets.example.test/logo.png",
      primaryColor: "#123456",
    },
  })).toEqual({
    displayName: "Client name",
    logoUrl: "https://assets.example.test/logo.png",
    primaryColor: "#123456",
  });
});

test.each(["javascript:alert(1)", "http://example.test/logo.png", "//example.test/logo.png"])(
  "rejects unsafe logo URL %s",
  (logoUrl) => {
    expect(resolveOrganizationPortalBranding({
      name: "Original name",
      branding: { displayName: "Client name", logoUrl, primaryColor: "#123456" },
    })).toEqual({
      displayName: "Client name",
      logoUrl: null,
      primaryColor: "#123456",
    });
  },
);

test("falls back to the organisation name and brand colour when invalid", () => {
  expect(resolveOrganizationPortalBranding({
    name: "Original name",
    branding: { displayName: " ", logoUrl: null, primaryColor: "#ffffff" },
  })).toEqual({
    displayName: "Original name",
    logoUrl: null,
    primaryColor: null,
  });
});

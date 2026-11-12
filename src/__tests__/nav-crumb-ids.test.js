import { navCrumb } from "@/components/layout/shell/navigation";

describe("navCrumb never shows a record id", () => {
  it("names a participant program by its section", () => {
    expect(navCrumb("/participant/b700f1a8-e588-4b58-9044-94b1a148b829")).toBe("navigation.programs");
  });
  it("falls back to the parent segment for a numeric id", () => {
    expect(navCrumb("/participant/assignments/42")).toBe(navCrumb("/participant/assignments"));
  });
  it("leaves named pages unchanged", () => {
    expect(navCrumb("/participant/profile")).toBe("navigation.profile");
    expect(navCrumb("/participant/ventures/VNT-1")).toBe("VNT-1");
  });
});

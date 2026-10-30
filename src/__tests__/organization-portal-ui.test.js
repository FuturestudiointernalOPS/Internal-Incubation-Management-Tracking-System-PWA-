/** @jest-environment jsdom */
import { render, screen, fireEvent } from "@testing-library/react";
import { useRouter } from "next/navigation";
jest.mock("next/navigation", () => ({ useRouter: jest.fn() }));
import OrganizationProgramPortal from "@/components/ui/OrganizationProgramPortal";
import { useApi } from "@/lib/hooks/useApi";
jest.mock("@/lib/i18n", () => ({ useI18n: () => ({ t: (key) => key, lang: "en" }) }));
jest.mock("@/lib/hooks/useApi", () => ({ useApi: jest.fn() }));
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
let context, programmes, lms, lmsCourse, ventures;
beforeEach(() => {
  useApi.mockClear();
  useRouter.mockReturnValue({ push: jest.fn() });
  context = { success: true, activeOrganizationId: id, organization: { id, name: "Synthetic Alpha", code: "alpha", modules: ["programs"] }, organizations: [{ id, name: "Synthetic Alpha", code: "alpha" }] };
  programmes = { success: true, organizationId: id, programs: [{ id: "program", name: "Synthetic private programme", status: "planned" }], pagination: { hasMore: false } };
  lms = { success: true, organizationId: id, permissions: { catalog: true, learning: true },
    catalog: [{ id: "course-1", title: "Synthetic Course", status: "published", access_source: "licensed" }],
    learning: { enrollments: [{ enrollment_id: "enrollment-1", course_id: "course-1", title: "My Course", description: "My course description", status: "active",
      required_lessons: 2, completed_required_lessons: 1, enrolled_at: "2026-10-29T00:00:00.000Z" }],
    attempts: [], certificates: [] } };
  lmsCourse = { success: true, organizationId: id, course: { id: "course-1", title: "My Course", description: "Course overview" },
    enrollment: { id: "enrollment-1", status: "active" },
    progress: { percent: 50, completedRequired: 1, totalRequired: 2, completedLessons: 1, totalLessons: 2 },
    sections: [{ id: "section-1", title: "Section one", lessons: [
      { id: "lesson-1", title: "Lesson one", is_required: true, progress_status: "completed", description: "Lesson text" },
      { id: "lesson-2", title: "Lesson two", is_required: true, progress_status: "not_started", description: "Next lesson" },
    ] }] };
  ventures = { success: true, organizationId: id, permissions: { readAssigned: true },
    ventures: [{ id: "venture-1", code: "VNT-1", company_name: "Synthetic Venture",
      status: "active", assignment_type: "member", industry: "Climate technology",
      business_stage: "Seed", description: "Synthetic venture description",
      website: "https://venture.example.test", logo_url: "https://assets.example.test/venture.png" }] };
  useApi.mockImplementation((url) => ({
    data: url === "/api/org/context" ? context
      : url === "/api/org/lms" ? lms
        : url.startsWith("/api/org/lms/") ? lmsCourse
          : url === "/api/org/ventures" ? ventures : programmes,
    loading: false, error: null, refresh: jest.fn(),
  }));
});
test("the route code does not select an organisation", () => {
  render(<OrganizationProgramPortal organizationCode="forged" />);
  expect(screen.queryByText("Synthetic private programme")).toBeNull();
  expect(screen.getByText("errors.organizationContextChanged")).toBeTruthy();
});
test("client reads bypass shared caches and bind only a freshness header", () => {
  render(<OrganizationProgramPortal organizationCode="alpha" view="programs" />);
  expect(screen.getByText("Synthetic private programme")).toBeTruthy();
  expect(screen.getByText("Synthetic Alpha")).toBeTruthy();
  expect(useApi).toHaveBeenCalledWith(expect.stringContaining("/api/org/programs?"), expect.objectContaining({ cache: false, fetchOptions: { cache: "no-store", headers: { "X-Organization-Id": id } } }));
});

test("the client header applies validated organisation branding with a readable fallback", () => {
  context.organization.branding = { displayName: "Alpha Academy", primaryColor: "#123456", logoUrl: "https://assets.example.test/logo.png" };
  render(<OrganizationProgramPortal organizationCode="alpha" view="programs" />);
  const header = screen.getByRole("banner");
  expect(screen.getByText("Alpha Academy")).toBeTruthy();
  expect(screen.getByAltText("Alpha Academy").getAttribute("src")).toBe("https://assets.example.test/logo.png");
  expect(header.parentElement.style.getPropertyValue("--brand-orange")).toBe("#123456");
});

test("only an organisation with the branding capability gets the branding editor", () => {
  context.organization.brandingEditable = true;
  render(<OrganizationProgramPortal organizationCode="alpha" view="programs" />);
  fireEvent.click(screen.getByText("common.organizationPortal.brandingSettings"));
  expect(screen.getByRole("dialog")).toBeTruthy();
  expect(screen.getByText("common.organizationPortal.brandingTitle")).toBeTruthy();
});

test("unsafe logo URLs and low-contrast brand colors fall back to the organization identity", () => {
  context.organization.branding = { displayName: "  ", logoUrl: "javascript:alert(1)", primaryColor: "#ffffff" };
  render(<OrganizationProgramPortal organizationCode="alpha" view="programs" />);
  expect(screen.getByText("Synthetic Alpha")).toBeTruthy();
  expect(screen.queryByRole("img", { name: "Synthetic Alpha" })).toBeNull();
  expect(screen.getByRole("banner").parentElement.style.getPropertyValue("--brand-orange")).toBe("");
});
test("a response belonging to a different organisation is never rendered", () => {
  programmes.organizationId = "foreign";
  render(<OrganizationProgramPortal organizationCode="alpha" view="programs" />);
  expect(screen.queryByText("Synthetic private programme")).toBeNull();
});
test("revocation in another tab invalidates the entire current view", () => {
  render(<OrganizationProgramPortal organizationCode="alpha" view="programs" />);
  context = { success: true, organization: null, organizations: [], activeOrganizationId: id };
  fireEvent(window, new StorageEvent("storage", { key: "impactos_organization_changed", newValue: "changed" }));
  expect(screen.queryByText("Synthetic private programme")).toBeNull();
  expect(screen.getByText("common.organizationPortal.noOrganizations")).toBeTruthy();
});

test("programme navigation has a stable URL without selecting an organisation from it", () => {
  render(<OrganizationProgramPortal organizationCode="alpha" view="programs" />);
  fireEvent.click(screen.getByText("common.organizationPortal.details"));
  expect(useRouter().push).toHaveBeenCalledWith("/o/alpha/programs/program");
});
test("an expired session offers login instead of trapping the reader in retries", () => {
  context = { success: false, error: "errors.authRequired" };
  render(<OrganizationProgramPortal organizationCode="alpha" />);
  fireEvent.click(screen.getByText("common.organizationPortal.signIn"));
  expect(useRouter().push).toHaveBeenCalledWith(expect.stringContaining("/login?redirect="));
});

test("the organisation home shows only server-enabled modules as open", () => {
  context.organization.modules = ["programs"];
  render(<OrganizationProgramPortal organizationCode="alpha" view="home" />);
  expect(screen.getByText("common.organizationPortal.module.programs")).toBeTruthy();
  expect(screen.getByText("common.organizationPortal.module.lms")).toBeTruthy();
  expect(screen.getByText("common.organizationPortal.module.venture")).toBeTruthy();
  expect(screen.getAllByText("common.organizationPortal.comingSoon")).toHaveLength(2);
  expect(useApi.mock.calls.some(([url]) => url.startsWith("/api/org/programs"))).toBe(false);
});

test("the active programme module opens its organisation-scoped route", () => {
  render(<OrganizationProgramPortal organizationCode="alpha" view="home" />);
  fireEvent.click(screen.getByText("common.organizationPortal.openModule"));
  expect(useRouter().push).toHaveBeenCalledWith("/o/alpha/programs");
});

test("the LMS portal is private, shows catalogue and only the active member's learning", () => {
  context.organization.modules = ["lms"];
  render(<OrganizationProgramPortal organizationCode="alpha" view="lms" />);
  expect(screen.getByText("Synthetic Course")).toBeTruthy();
  expect(screen.getByText("My Course")).toBeTruthy();
  expect(screen.getByText("common.organizationPortal.lms.progress")).toBeTruthy();
  expect(useApi).toHaveBeenCalledWith("/api/org/lms", expect.objectContaining({
    cache: false,
    fetchOptions: { cache: "no-store", headers: { "X-Organization-Id": id } },
  }));
});

test("a learner without catalogue rights can still search their own enrollments", () => {
  context.organization.modules = ["lms"];
  lms.permissions = { catalog: false, learning: true };
  render(<OrganizationProgramPortal organizationCode="alpha" view="lms" />);
  const search = screen.getByLabelText("common.organizationPortal.lms.searchCourses");
  fireEvent.change(search, { target: { value: "not found" } });
  expect(screen.getByText("common.noResults")).toBeTruthy();
  expect(screen.queryByText("Synthetic Course")).toBeNull();
});

test("an enrolled client can open its organisation-scoped course reader", () => {
  context.organization.modules = ["lms"];
  render(<OrganizationProgramPortal organizationCode="alpha" view="lms" />);
  fireEvent.click(screen.getByText("common.organizationPortal.lms.openCourse"));
  expect(useRouter().push).toHaveBeenCalledWith("/o/alpha/lms/course-1");
});

test("the LMS course frontend shows enrolled content and lets learners select lessons", () => {
  context.organization.modules = ["lms"];
  render(<OrganizationProgramPortal organizationCode="alpha" view="lms-course" programId="course-1" />);
  expect(screen.getByText("Course overview")).toBeTruthy();
  expect(screen.getByText("Lesson text")).toBeTruthy();
  const secondLesson = screen.getByRole("button", { name: /Lesson two/ });
  fireEvent.click(secondLesson);
  expect(secondLesson.getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByText("Next lesson")).toBeTruthy();
  expect(useApi).toHaveBeenCalledWith("/api/org/lms/course-1", expect.objectContaining({
    cache: false,
    fetchOptions: { cache: "no-store", headers: { "X-Organization-Id": id } },
  }));
});

test("the active LMS module opens its organisation-scoped route", () => {
  context.organization.modules = ["lms"];
  render(<OrganizationProgramPortal organizationCode="alpha" view="home" />);
  fireEvent.click(screen.getByText("common.organizationPortal.openModule"));
  expect(useRouter().push).toHaveBeenCalledWith("/o/alpha/lms");
});

test("the Venture portal is private and renders only assigned ventures", () => {
  context.organization.modules = ["venture"];
  render(<OrganizationProgramPortal organizationCode="alpha" view="venture" />);
  expect(screen.getByText("Synthetic Venture")).toBeTruthy();
  expect(screen.getByText("VNT-1")).toBeTruthy();
  expect(screen.getByText("common.organizationPortal.venture.assignment.member")).toBeTruthy();
  expect(useApi).toHaveBeenCalledWith("/api/org/ventures", expect.objectContaining({
    cache: false,
    fetchOptions: { cache: "no-store", headers: { "X-Organization-Id": id } },
  }));
});

test("the Venture frontend searches assigned ventures and opens their details", () => {
  context.organization.modules = ["venture"];
  render(<OrganizationProgramPortal organizationCode="alpha" view="venture" />);
  fireEvent.change(screen.getByLabelText("common.organizationPortal.venture.search"), {
    target: { value: "Climate" },
  });
  expect(screen.getByText("Synthetic Venture")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("common.organizationPortal.venture.search"), {
    target: { value: "not found" },
  });
  expect(screen.getByText("common.noResults")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("common.organizationPortal.venture.search"), {
    target: { value: "Climate" },
  });
  fireEvent.click(screen.getByText("common.organizationPortal.venture.details"));
  expect(screen.getByRole("dialog")).toBeTruthy();
  expect(screen.getByText("Synthetic venture description")).toBeTruthy();
  expect(screen.getByRole("dialog").querySelector("img").getAttribute("src"))
    .toBe("https://assets.example.test/venture.png");
  expect(screen.getByRole("link", { name: "common.organizationPortal.venture.website" }).getAttribute("href"))
    .toBe("https://venture.example.test/");
});

test("the active Venture module opens its organisation-scoped route", () => {
  context.organization.modules = ["venture"];
  render(<OrganizationProgramPortal organizationCode="alpha" view="home" />);
  fireEvent.click(screen.getByText("common.organizationPortal.openModule"));
  expect(useRouter().push).toHaveBeenCalledWith("/o/alpha/venture");
});

test("the shared portal header opens the workspace selector through client navigation", () => {
  render(<OrganizationProgramPortal organizationCode="alpha" view="home" />);
  fireEvent.click(screen.getByText("common.organizationPortal.change"));
  expect(useRouter().push).toHaveBeenCalledWith("/o/select");
});

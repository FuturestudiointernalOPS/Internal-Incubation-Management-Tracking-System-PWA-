/** @jest-environment jsdom */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import OrganizationProgramEditor from "@/components/ui/OrganizationProgramEditor";
import OrganizationProgramWorkspace from "@/components/ui/OrganizationProgramWorkspace";
import { useApi } from "@/lib/hooks/useApi";
jest.mock("@/lib/i18n", () => ({ useI18n: () => ({ t: (key) => key, lang: "en" }) }));
jest.mock("@/lib/hooks/useApi", () => ({ useApi: jest.fn() }));
jest.mock("@/components/ui/DialogProvider", () => ({ useDialogs: () => ({ confirm: jest.fn(async () => true) }) }));
const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", programId = "11111111-1111-4111-8111-111111111111";
let saved;
beforeEach(() => {
  saved = jest.fn();
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ success: true, organizationId, result: { id: programId } }) }));
});
test("programme creation submits a bounded body with a freshness header, no owner selector", async () => {
  render(<OrganizationProgramEditor organizationId={organizationId} url="/api/org/programs" onClose={jest.fn()} onSaved={saved} />);
  fireEvent.change(screen.getByLabelText("common.organizationPortal.name"), { target: { value: "Synthetic programme" } });
  fireEvent.click(screen.getByText("common.save"));
  await waitFor(() => expect(saved).toHaveBeenCalled());
  const [url, options] = fetch.mock.calls[0], body = JSON.parse(options.body);
  expect(url).toBe("/api/org/programs"); expect(options.method).toBe("POST");
  expect(options.headers["X-Organization-Id"]).toBe(organizationId);
  expect(body).toEqual({ name: "Synthetic programme", description: null, start_date: null, end_date: null, duration_weeks: 13, duration_days: 0 });
});
test("cohort editing retains its revision and never sends the year or programme owner", async () => {
  render(<OrganizationProgramEditor organizationId={organizationId} url="/api/cohort" cohort initial={{ name: "2027 cohort", year: 2027, status: "active", revision: 4 }} onClose={jest.fn()} onSaved={saved} />);
  expect(screen.queryByLabelText("common.organizationPortal.year")).toBeNull();
  fireEvent.change(screen.getByLabelText("common.organizationPortal.name"), { target: { value: "Updated name" } });
  fireEvent.click(screen.getByText("common.save"));
  await waitFor(() => expect(saved).toHaveBeenCalled());
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ name: "Updated name", start_date: null, end_date: null, status: "active", revision: 4 });
});
test("a conflict is shown with no success callback and no retry against a legacy API", async () => {
  fetch.mockResolvedValue({ ok: false, json: async () => ({ success: false, error: "errors.organizationProgramConflict" }) });
  render(<OrganizationProgramEditor organizationId={organizationId} url="/api/cohort" cohort initial={{ name: "2027", status: "active", revision: 1 }} onClose={jest.fn()} onSaved={saved} />);
  fireEvent.click(screen.getByText("common.save"));
  await screen.findByRole("alert");
  expect(screen.getByText("errors.organizationProgramConflict")).toBeTruthy(); expect(saved).not.toHaveBeenCalled(); expect(fetch).toHaveBeenCalledTimes(1);
});
test("a wrong-organisation mutation response cannot navigate or report success", async () => {
  fetch.mockResolvedValue({ ok: true, json: async () => ({ success: true, organizationId: "foreign", result: { id: programId } }) });
  render(<OrganizationProgramEditor organizationId={organizationId} url="/api/org/programs" onClose={jest.fn()} onSaved={saved} />);
  fireEvent.change(screen.getByLabelText("common.organizationPortal.name"), { target: { value: "Synthetic" } });
  fireEvent.click(screen.getByText("common.save")); await screen.findByRole("alert"); expect(saved).not.toHaveBeenCalled();
});
test("a read-only viewer sees cohort history without management actions", () => {
  useApi.mockReturnValue({ data: { success: true, organizationId, program: { id: programId, name: "Read-only programme", status: "active" }, permissions: {}, items: [{ id: "C1", name: "Year 2027", year: 2027, status: "completed", active_enrollments: 0 }], pagination: { hasMore: false } }, loading: false, refresh: jest.fn() });
  render(<OrganizationProgramWorkspace organizationId={organizationId} programId={programId} onChanged={jest.fn()} onBack={jest.fn()} />);
  expect(screen.getByText("Year 2027 · 2027")).toBeTruthy();
  expect(screen.queryByText("common.organizationPortal.editProgram")).toBeNull();
  expect(screen.queryByText("common.organizationPortal.viewEnrollments")).toBeNull();
});

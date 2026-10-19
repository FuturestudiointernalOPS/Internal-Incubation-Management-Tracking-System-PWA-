/** @jest-environment jsdom */
import React from "react";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import ParticipantDashboardPage from "@/app/participant/page";
const mockReplace = jest.fn();
let mockRole = "participant";
let mockInvestor = false;
jest.mock("next/navigation", () => ({ useRouter: () => ({ replace: mockReplace }) }));
jest.mock("@/lib/hooks/useSessionUser", () => ({ useSessionUser: () => ({ user: { cid: "p1" }, role: mockRole }) }));
jest.mock("@/lib/hooks/useApi", () => ({ useApi: () => ({ data: { success: true, isInvestor: mockInvestor }, loading: false }) }));
jest.mock("@/components/dashboard/ParticipantDashboardHome", () => ({ __esModule: true, default: () => <div>Participant home</div> }));
beforeEach(() => { mockRole = "participant"; mockInvestor = false; mockReplace.mockClear(); });
afterEach(cleanup);
test.each([["investor", false], ["member", true]])("%s investor reaches Investor Space instead of the common home", async (role, investor) => {
  mockRole = role; mockInvestor = investor;
  render(<ParticipantDashboardPage />);
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/investor/dashboard"));
  expect(screen.queryByText("Participant home")).toBeNull();
});
test("participant keeps their own dashboard", () => {
  render(<ParticipantDashboardPage />);
  expect(screen.getByText("Participant home")).toBeTruthy();
  expect(mockReplace).not.toHaveBeenCalled();
});

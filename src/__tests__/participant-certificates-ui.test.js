/** @jest-environment jsdom */
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";

jest.mock("@/lib/i18n", () => ({ useI18n: () => ({ lang: "en", t: (key) => {
  const namespaces = { ...require("@/locales/en/participant.json"), ...require("@/locales/en/common.json"), ...require("@/locales/en/navigation.json") };
  return key.split(".").reduce((obj, part) => obj?.[part], namespaces) || key;
} }) }));
jest.mock("@/components/lms/CertificateCard", () => function CertificateCard({ certificate }) {
  return <div data-testid="course-certificate">{certificate.id}</div>;
});

let mockProgramCertificates = [];
let mockCourses = [];
jest.mock("@/lib/hooks/useApi", () => ({
  useApi: (url, options) => {
    const payload = url === "/api/participant/certificates"
      ? { success: true, certificates: mockProgramCertificates }
      : { success: true, courses: mockCourses };
    return { data: options.transform(payload), loading: false, error: null, refresh: jest.fn() };
  },
}));
const ParticipantCertificatesPage = require("@/app/participant/certificates/page").default;

const EMPTY = "No certificates yet. Certificates appear here once issued.";
afterEach(() => { cleanup(); mockProgramCertificates = []; mockCourses = []; });

test("a course certificate alone does not show the 'no certificates' message", () => {
  mockCourses = [{ course: { id: "c1" }, progress: { complete: true }, certificate: { id: "CERT-1" } }];
  render(<ParticipantCertificatesPage />);
  expect(screen.getByTestId("course-certificate").textContent).toBe("CERT-1");
  expect(screen.queryByText(EMPTY)).toBeNull();
});

test("the empty message shows when there is no certificate at all", () => {
  render(<ParticipantCertificatesPage />);
  expect(screen.getByText(EMPTY)).toBeTruthy();
});

test("program certificates are still listed beside course certificates", () => {
  mockProgramCertificates = [{ program_id: "p1", program_name: "Internship", completed_at: "2026-10-09" }];
  mockCourses = [{ course: { id: "c1" }, progress: { complete: true }, certificate: { id: "CERT-1" } }];
  render(<ParticipantCertificatesPage />);
  expect(screen.getByText("Internship")).toBeTruthy();
  expect(screen.getByTestId("course-certificate")).toBeTruthy();
  expect(screen.queryByText(EMPTY)).toBeNull();
});

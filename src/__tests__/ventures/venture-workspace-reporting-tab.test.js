/**
 * @jest-environment jsdom
 *
 * THE REPORTING DOOR IN THE FOUNDER'S WORKSPACE.
 *
 * `/founder/ventures/<id>` is rewritten to `/participant/ventures/<id>`
 * (next.config.mjs), so the Venture Data Foundation lives INSIDE that workspace
 * as one more tab. Two properties have to hold:
 *
 *   • a reader without `ventures.edit` never sees the door;
 *   • the door leads to the reporting screen when it is shown.
 *
 * The flag is the guard's own verdict (`/api/ventures/[id]/my-access` →
 * `capabilities.edit.allowed`), which is why nothing here tries to infer it
 * from a role string.
 */
import { render, screen, fireEvent } from "@testing-library/react";

jest.mock("@/components/ventures/reporting/VentureReportingScreen", () => {
  const React = require("react");
  return function VentureReportingScreen() {
    return React.createElement("div", { "data-testid": "reporting-screen" });
  };
});

const { tabsFor, REPORTING_TAB, TABS } = require("@/components/participant/ventures/ventureScreenModel");
const VentureWorkspaceView = require("@/components/participant/ventures/VentureWorkspaceView").default;

const venture = {
  venture_id: "VNT-1",
  company_name: "AgroTech",
  business_stage: "idea",
  status: "active",
  industry: "AgriTech",
  country: "BJ",
};

const label = (key) => key;

function view({ canReport, activeTab = "reporting", onSection = () => {} } = {}) {
  return render(
    <VentureWorkspaceView
      venture={venture}
      brandColor="#f60"
      activeTab={activeTab}
      onSection={onSection}
      onBack={() => {}}
      canReport={canReport}
      t={label}
    />,
  );
}

const reportingButton = () =>
  screen.queryByText("venture.reporting.tabLabel");

describe("tabsFor", () => {
  test("a reader gets the six workspace doors and no Reporting", () => {
    expect(tabsFor({ canReport: false })).toEqual(TABS);
    expect(tabsFor()).toEqual(TABS);
    expect(tabsFor({ canReport: false })).not.toContain(REPORTING_TAB);
  });

  test("a writer gets Reporting last, after the doors the workspace already had", () => {
    const tabs = tabsFor({ canReport: true });
    expect(tabs).toHaveLength(TABS.length + 1);
    expect(tabs[tabs.length - 1]).toBe(REPORTING_TAB);
    // Order of the existing doors is untouched.
    expect(tabs.slice(0, TABS.length)).toEqual(TABS);
  });
});

describe("the workspace tab bar", () => {
  test("hides Reporting from someone who may not write", () => {
    view({ canReport: false });
    expect(reportingButton()).toBeNull();
  });

  test("a hidden door cannot be opened by its address either", () => {
    // `activeTab` is already the validated answer from the screen; asking for a
    // door that is hidden must still render nothing.
    view({ canReport: false });
    expect(screen.queryByTestId("reporting-screen")).toBeNull();
  });

  test("shows Reporting to someone who may write", () => {
    view({ canReport: true });
    expect(reportingButton()).not.toBeNull();
  });

  test("the door opens the reporting screen", () => {
    view({ canReport: true });
    expect(screen.getByTestId("reporting-screen")).toBeTruthy();
  });

  test("clicking the door asks the screen to navigate to it", () => {
    const onSection = jest.fn();
    view({ canReport: true, onSection });
    fireEvent.click(reportingButton().closest("button"));
    expect(onSection).toHaveBeenCalledWith(REPORTING_TAB);
  });
});

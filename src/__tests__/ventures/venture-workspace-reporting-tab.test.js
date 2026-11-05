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
 * Reporting sits BEFORE SetUp when it is shown. SetUp remains the last
 * top-level door and groups Profile / Venture Baseline / Team.
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

jest.mock("@/components/ventures/workspace/tabs/ProfileSettingsTabs", () => {
  const React = require("react");
  return {
    ProfileTab: () => React.createElement("div", { "data-testid": "profile-tab" }),
  };
});
jest.mock("@/components/ventures/workspace/tabs/VentureBaselineTab", () => {
  const React = require("react");
  return function VentureBaselineTab() {
    return React.createElement("div", { "data-testid": "baseline-tab" });
  };
});
jest.mock("@/components/ventures/workspace/tabs/MembersTabs", () => {
  const React = require("react");
  return {
    TeamTab: () => React.createElement("div", { "data-testid": "team-tab" }),
  };
});
jest.mock("@/components/ventures/workspace/tabs/DashboardHistoryTabs", () => {
  const React = require("react");
  return {
    DashboardTab: () => React.createElement("div", { "data-testid": "dashboard-tab" }),
  };
});
jest.mock("@/components/ventures/workspace/tabs/JourneyPlaybookTabs", () => {
  const React = require("react");
  return {
    JourneyTab: () => React.createElement("div", { "data-testid": "journey-tab" }),
  };
});
jest.mock("@/components/ventures/data-room/VentureDataRoom", () => {
  const React = require("react");
  return function VentureDataRoom() {
    return React.createElement("div", { "data-testid": "data-room" });
  };
});
jest.mock("@/components/ventures/workspace/tabs/GrowthTabs", () => {
  const React = require("react");
  return {
    DataRoomReadinessCard: () => null,
    RoadmapReadinessCard: () => null,
  };
});

const {
  tabsFor,
  REPORTING_TAB,
  SETUP_TAB,
  SETUP_SECTIONS,
  TABS,
  resolveWorkspaceTab,
} = require("@/components/participant/ventures/ventureScreenModel");
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

function view({
  canReport,
  activeTab = "reporting",
  setupSection = "profile",
  onSection = () => {},
} = {}) {
  return render(
    <VentureWorkspaceView
      venture={venture}
      brandColor="#f60"
      activeTab={activeTab}
      setupSection={setupSection}
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
  test("a reader gets the four workspace doors and no Reporting", () => {
    expect(tabsFor({ canReport: false })).toEqual(TABS);
    expect(tabsFor()).toEqual(TABS);
    expect(tabsFor({ canReport: false })).not.toContain(REPORTING_TAB);
    expect(TABS).toEqual(["dashboard", "journey", "dataRoom", SETUP_TAB]);
  });

  test("a writer gets Reporting before SetUp (SetUp stays last)", () => {
    const tabs = tabsFor({ canReport: true });
    expect(tabs).toHaveLength(TABS.length + 1);
    expect(tabs[tabs.length - 1]).toBe(SETUP_TAB);
    expect(tabs[tabs.length - 2]).toBe(REPORTING_TAB);
    expect(tabs).toEqual([
      "dashboard", "journey", "dataRoom", REPORTING_TAB, SETUP_TAB,
    ]);
  });
});

describe("resolveWorkspaceTab", () => {
  test("legacy ?tab=profile|baseline|team opens SetUp on that section", () => {
    for (const section of SETUP_SECTIONS) {
      expect(resolveWorkspaceTab({ requestedTab: section })).toEqual({
        activeTab: SETUP_TAB,
        setupSection: section,
      });
    }
  });

  test("canonical ?tab=setup&section=… keeps the section", () => {
    expect(resolveWorkspaceTab({
      requestedTab: SETUP_TAB,
      requestedSection: "team",
    })).toEqual({ activeTab: SETUP_TAB, setupSection: "team" });
  });

  test("bare ?tab=setup defaults to profile", () => {
    expect(resolveWorkspaceTab({ requestedTab: SETUP_TAB })).toEqual({
      activeTab: SETUP_TAB,
      setupSection: "profile",
    });
  });

  test("a reader cannot open reporting via the address", () => {
    expect(resolveWorkspaceTab({
      requestedTab: REPORTING_TAB,
      canReport: false,
    })).toEqual({ activeTab: "dashboard", setupSection: "profile" });
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

  test("SetUp shows Profile / Baseline / Team sub-nav and the open section", () => {
    const onSection = jest.fn();
    view({
      canReport: true,
      activeTab: SETUP_TAB,
      setupSection: "baseline",
      onSection,
    });
    expect(screen.getByText("venture.setup")).toBeTruthy();
    expect(screen.getByTestId("baseline-tab")).toBeTruthy();
    fireEvent.click(screen.getByText("venture.team").closest("button"));
    expect(onSection).toHaveBeenCalledWith("team");
  });
});

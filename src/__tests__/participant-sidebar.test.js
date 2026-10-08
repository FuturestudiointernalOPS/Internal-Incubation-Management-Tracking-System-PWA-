/** @jest-environment jsdom */
import React, { useState } from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { SidebarContent } from "@/components/layout/shell/SidebarContent";
import { User } from "lucide-react";
jest.mock("@/lib/i18n", () => ({ useI18n: () => ({ switchLang: jest.fn() }) }));
jest.mock("next/image", () => ({ __esModule: true, default: function Image(props) { return <span role="img" aria-label={props.alt} />; } }));
afterEach(cleanup);
function Rail({ mobile = false, initiallyCollapsed = false }) {
  const [collapsed, setCollapsed] = useState(initiallyCollapsed);
  const [openMenus, setOpen] = useState({});
  return <SidebarContent mobile={mobile} collapsed={mobile ? false : collapsed} setCollapsed={setCollapsed} role="participant" pathname="/participant" activePathIds={new Set()} navItems={[{ id: "prog_one", name: "One", icon: User, children: [{ id: "prog_child_one", name: "First child", href: "/participant/one" }] }, { id: "prog_two", name: "Two", icon: User, children: [{ id: "prog_child_two", name: "Second child", href: "/participant/two" }] }]} openMenus={openMenus} toggleMenu={id => setOpen(prev => ({ ...prev, [id]: !prev[id] }))} setMobileMenuOpen={() => {}} handleLogout={() => {}} t={key => key} />;
}
test("collapsed participant group expands the rail and opens its children", () => {
  render(<Rail initiallyCollapsed />);
  const group = screen.getByRole("button", { name: "One" });
  expect(group.title).toBe("One");
  expect(screen.queryByText("First child")).toBeNull();
  fireEvent.click(group);
  expect(screen.getByText("First child")).toBeTruthy();
  expect(screen.getByText("One")).toBeTruthy();
});
test("participant groups stay open together and clicking a parent closes it", () => {
  render(<Rail />);
  fireEvent.click(screen.getByRole("button", { name: "One" }));
  fireEvent.click(screen.getByRole("button", { name: "Two" }));
  expect(screen.getByText("First child")).toBeTruthy();
  expect(screen.getByText("Second child")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "One" }));
  fireEvent.mouseEnter(screen.getByRole("button", { name: "One" }));
  expect(screen.queryByText("First child")).toBeNull();
  expect(screen.getByText("Second child")).toBeTruthy();
});
test("mobile keeps labels and omits the collapse control", () => {
  render(<Rail mobile initiallyCollapsed />);
  expect(screen.getByText("One")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "navigation.collapseSidebar" })).toBeNull();
});

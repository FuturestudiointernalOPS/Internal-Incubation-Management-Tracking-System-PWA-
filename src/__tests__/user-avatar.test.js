/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import UserAvatar from "@/components/ui/UserAvatar";

describe("UserAvatar", () => {
  it("shows the photo instead of the initial", () => {
    render(<UserAvatar name="Chris" image="https://example.com/a.png" />);
    expect(screen.getByRole("img", { name: "Chris" }).getAttribute("src")).toBe("https://example.com/a.png");
    expect(screen.queryByText("C")).toBeNull();
  });

  it("shows the initial when there is no photo", () => {
    render(<UserAvatar name="Chris" image={null} />);
    expect(screen.getByText("C")).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("falls back to the initial when the photo fails, and retries a new one", () => {
    const { rerender } = render(<UserAvatar name="Chris" image="https://example.com/broken.png" />);
    fireEvent.error(screen.getByRole("img"));
    expect(screen.getByText("C")).toBeTruthy();

    rerender(<UserAvatar name="Chris" image="https://example.com/new.png" />);
    expect(screen.getByRole("img").getAttribute("src")).toBe("https://example.com/new.png");
  });
});

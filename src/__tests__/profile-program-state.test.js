import {
  isProgramActive,
  isProgramEnded,
  programStatusKey,
} from "@/lib/programState";

const TODAY = "2026-11-06";

describe("profile program state", () => {
  it("reads the stored status without regard to case", () => {
    expect(isProgramActive("Active", "2026-11-22", TODAY)).toBe(true);
    expect(isProgramActive("active", "2026-11-22", TODAY)).toBe(true);
    expect(isProgramActive(null, null, TODAY)).toBe(true);
    expect(isProgramActive("paused", "2026-11-22", TODAY)).toBe(false);
  });

  it("treats a program whose last day is over as ended, not current", () => {
    expect(isProgramEnded("2026-10-30", TODAY)).toBe(true);
    expect(isProgramEnded("2026-11-06", TODAY)).toBe(false); // the last day itself still counts
    expect(isProgramEnded(null, TODAY)).toBe(false);
    expect(isProgramActive("active", "2026-10-30", TODAY)).toBe(false);
  });

  it("gives a translation key for the badge", () => {
    expect(programStatusKey("Active", "2026-11-22", TODAY)).toBe("status.active");
    expect(programStatusKey("active", "2026-10-30", TODAY)).toBe("status.completed");
    expect(programStatusKey("", null, TODAY)).toBe("status.active");
    expect(programStatusKey("paused", null, TODAY)).toBe("status.paused");
    expect(programStatusKey("something-new", null, TODAY)).toBeNull();
  });
});

describe("programDisplayStatus", () => {
  const { programDisplayStatus } = require("@/lib/programState");
  it("normalises the stored status and marks an ended program completed", () => {
    expect(programDisplayStatus("Active", "2026-11-22", TODAY)).toBe("active");
    expect(programDisplayStatus("active", "2026-10-30", TODAY)).toBe("completed");
    expect(programDisplayStatus("In Progress", null, TODAY)).toBe("inProgress");
    expect(programDisplayStatus("custom", null, TODAY)).toBe("custom");
  });
});

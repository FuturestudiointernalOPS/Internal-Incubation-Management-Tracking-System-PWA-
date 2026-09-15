/**
 * JOURNEY STATUS LEXICON — one word per state, every surface.
 *
 * The defect this locks out: the SAME state was called different things
 * depending on who was looking —
 *
 *   a milestone waiting to start   → "Not Started" (founder) / "Not started" (VM)
 *   a deliverable waiting to start → "Pending"
 *   a deliverable handed in        → "Submitted" (VM) / nothing (founder)
 *   a journey stage under way      → "Active"
 *   a task submission sent back    → "Revision Requested" vs "Changes Requested"
 *
 * Super Admin (admin timeline + reports), the Venture Manager panel and the
 * founder's journey tab must all resolve labels through
 * `src/lib/ventureStatuses.js`, which owns the vocabulary, the precedence and
 * the colours. These tests fail if any surface grows its own opinions again.
 */

const fs = require("fs");
const path = require("path");

const {
  STATUS_WORDS,
  STATUS_WORD_IDS,
  STATUS_TONE_CLASSES,
  statusWord,
  storedStatusWord,
  stageStatusWord,
  milestoneStatusWord,
  deliverableStatusWord,
  statusLabel,
  statusChipClass,
  statusDotClass,
} = require("@/lib/ventureStatuses");

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const en = require("@/locales/en/status.json").status;
const fr = require("@/locales/fr/status.json").status;

const FOUNDER = "src/components/ventures/workspace/tabs/JourneyPlaybookTabs.js";
const MANAGER = "src/components/ventures/JourneyManagerPanel.js";
const ADMIN_TIMELINE = "src/app/admin/ventures/[id]/timeline/page.js";
const ADMIN_REPORTS = "src/app/admin/ventures/[id]/reports/page.js";
const ADMIN_SESSIONS = "src/app/admin/ventures/[id]/sessions/page.js";

describe("the vocabulary — every word exists in both languages", () => {
  test("the ladder is the seven agreed words", () => {
    expect(STATUS_WORD_IDS).toEqual([
      "locked",
      "not_started",
      "in_progress",
      "awaiting_review",
      "changes_requested",
      "completed",
      "approved",
    ]);
  });

  test("every word has an English and a French string", () => {
    for (const id of STATUS_WORD_IDS) {
      const key = STATUS_WORDS[id].key;
      const short = key.replace("status.", "");
      expect(en[short]).toBeTruthy();
      expect(fr[short]).toBeTruthy();
      // French must not silently fall back to English.
      expect(fr[short]).not.toBe(en[short]);
    }
  });

  test("the agreed words are exactly these", () => {
    expect(en.notStarted).toBe("Not Started");
    expect(en.inProgress).toBe("In Progress");
    expect(en.awaitingReview).toBe("Awaiting Review");
    expect(en.changesRequested).toBe("Changes Requested");
    expect(en.completed).toBe("Completed");
    expect(en.approved).toBe("Approved");
    expect(en.locked).toBe("Locked");
  });

  test("the retired duplicates are gone from the journey ladder", () => {
    // "Pending" is still a shared status word for other features (investor
    // approvals, user approvals) — but it is NOT a journey word any more.
    expect(STATUS_WORD_IDS).not.toContain("pending");
    expect(STATUS_WORDS.submitted).toBeUndefined();
    expect(STATUS_WORDS.revision_requested).toBeUndefined();
  });
});

describe("one word per state", () => {
  test("a deliverable waiting to start and a milestone waiting to start agree", () => {
    expect(deliverableStatusWord({ status: "pending" }).id).toBe("not_started");
    expect(milestoneStatusWord("not_started").id).toBe("not_started");
    expect(statusLabel(deliverableStatusWord({ status: "pending" }), (k) => en[k.replace("status.", "")]))
      .toBe(statusLabel(milestoneStatusWord("not_started"), (k) => en[k.replace("status.", "")]));
  });

  test("a handed-in deliverable reads Awaiting Review, not Submitted", () => {
    const word = deliverableStatusWord({ status: "submitted" });
    expect(word.id).toBe("awaiting_review");
    expect(word.key).toBe("status.awaitingReview");
  });

  test("a stage under way reads In Progress, not Active", () => {
    expect(stageStatusWord("active").id).toBe("in_progress");
    expect(stageStatusWord("completed").id).toBe("completed");
    expect(stageStatusWord("locked").id).toBe("locked");
  });

  test("a milestone awaiting review agrees with a deliverable awaiting review", () => {
    expect(milestoneStatusWord("under_review").id).toBe("awaiting_review");
    expect(deliverableStatusWord({ status: "submitted" }).id).toBe("awaiting_review");
  });
});

describe("deliverable precedence — total and explicit", () => {
  test("approved wins over everything", () => {
    expect(deliverableStatusWord({ approval_status: "approved", status: "submitted" }).id).toBe("approved");
    expect(deliverableStatusWord({ status: "completed" }).id).toBe("approved");
  });

  test("a rejection wins over the submitted state", () => {
    // status stays "submitted" after a rejection — approval_status is the truth.
    expect(deliverableStatusWord({ status: "submitted", approval_status: "rejected" }).id).toBe("changes_requested");
  });

  test("REGRESSION: an in-progress deliverable is not silently called Not Started", () => {
    // The founder view used to have no in_progress branch, so it fell through
    // to "Pending" while the manager saw "In progress".
    expect(deliverableStatusWord({ status: "in_progress" }).id).toBe("in_progress");
    expect(deliverableStatusWord({ status: "in_progress", approval_status: "pending" }).id).toBe("in_progress");
  });

  test("an empty deliverable is Not Started, not a guessed state", () => {
    expect(deliverableStatusWord({}).id).toBe("not_started");
    expect(deliverableStatusWord().id).toBe("not_started");
  });
});

describe("unknown states are surfaced, never renamed", () => {
  test("an unmapped stored value keeps its raw text", () => {
    const word = milestoneStatusWord("escalated_to_board");
    expect(word.id).toBe("unknown");
    expect(word.key).toBeNull();
    expect(word.raw).toBe("escalated_to_board");
  });

  test("the label helper shows the raw value instead of a wrong word or a bare key", () => {
    const word = milestoneStatusWord("escalated_to_board");
    // A translator that misses returns the key itself — must not leak to the UI.
    expect(statusLabel(word, (k) => k)).toBe("escalated_to_board");
  });

  test("a missing word returns a dash rather than blank", () => {
    expect(statusLabel(null)).toBe("—");
  });
});

describe("one tone map — the same colour for the same state everywhere", () => {
  test("every word id has a tone with chip and dot classes", () => {
    for (const id of STATUS_WORD_IDS) {
      const tone = STATUS_WORDS[id].tone;
      expect(STATUS_TONE_CLASSES[tone]).toBeTruthy();
      expect(STATUS_TONE_CLASSES[tone].chip).toBeTruthy();
      expect(STATUS_TONE_CLASSES[tone].dot).toBeTruthy();
    }
  });

  test("green means done, amber means waiting on someone else, rose means needs fixing", () => {
    expect(statusChipClass(statusWord("completed"))).toBe(statusChipClass(statusWord("approved")));
    expect(statusChipClass(statusWord("awaiting_review"))).not.toBe(statusChipClass(statusWord("completed")));
    expect(statusDotClass(statusWord("changes_requested"))).toContain("rose");
    expect(statusDotClass(statusWord("awaiting_review"))).toContain("amber");
  });
});

describe("every surface reads the one source", () => {
  test("the founder journey tab delegates and keeps no local milestone map", () => {
    const src = read(FOUNDER);
    expect(src).toContain('from "@/lib/ventureStatuses"');
    expect(src).toContain("milestoneStatusWord");
    expect(src).toContain("deliverableStatusWord");
    // the old second opinions
    expect(src).not.toContain("MILESTONE_LABEL_KEYS");
    expect(src).not.toContain("dvStatus");
    expect(src).not.toContain("deliverableStatuses");
  });

  test("the Venture Manager panel delegates for milestones, deliverables and stages", () => {
    const src = read(MANAGER);
    expect(src).toContain('from "@/lib/ventureStatuses"');
    expect(src).toContain("stageStatusWord");
    expect(src).toContain("milestoneStatusWord");
    expect(src).toContain("deliverableStatusWord");
    expect(src).not.toContain("milestoneStatuses");
    expect(src).not.toContain("deliverableStatuses");
  });

  test("the Super Admin timeline, reports and session scheduling delegate too", () => {
    for (const file of [ADMIN_TIMELINE, ADMIN_REPORTS, ADMIN_SESSIONS]) {
      const src = read(file);
      expect(src).toContain('from "@/lib/ventureStatuses"');
      expect(src).toContain("stageStatusWord");
      // the old per-page stage wording is gone
      expect(src).not.toContain("vadmin.journey.statusActive");
      expect(src).not.toContain("vadmin.journey.statusLocked");
    }
    expect(read(ADMIN_TIMELINE)).toContain("milestoneStatusWord");
  });
});

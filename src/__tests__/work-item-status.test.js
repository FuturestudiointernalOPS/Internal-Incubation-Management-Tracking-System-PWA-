/**
 * The status catalogue — one meaning for every word.
 *
 * The Project lens shows milestones, activities and deliverables in one table,
 * and each kind stores its own vocabulary. "Backlog" and "Not started" are
 * therefore allowed to sit side by side — what must not differ is the STAGE
 * they represent. Colour, the filter and every count read the category.
 */
const {
  STATUS_CATEGORIES,
  CATEGORY_COLOR,
  categoryKey,
  statusCategory,
} = require("@/lib/workItemStatus");
const {
  DELIVERABLE_PROGRESS_WORDS,
  DELIVERABLE_REVIEW_WORDS,
  DELIVERABLE_STATUS_BY_WORD,
  deliverableStatusWord,
} = require("@/lib/ventureStatuses");

test("the four categories are the only ones", () => {
  expect(STATUS_CATEGORIES).toEqual(["to_do", "in_progress", "blocked", "done"]);
});

test("every category is coloured, so no row falls back to uncoloured", () => {
  for (const category of STATUS_CATEGORIES) {
    expect(CATEGORY_COLOR[category]).toBeTruthy();
  }
});

test.each([
  ["backlog", "to_do"],
  ["todo", "to_do"],
  ["not_started", "to_do"],
  ["pending", "to_do"],
  ["in_progress", "in_progress"],
  ["review", "in_progress"],
  ["submitted", "in_progress"],
  ["awaiting_review", "in_progress"],
  ["changes_requested", "in_progress"],
  ["blocked", "blocked"],
  ["done", "done"],
  ["completed", "done"],
  ["approved", "done"],
])("%s reads as %s", (status, category) => {
  expect(statusCategory(status)).toBe(category);
});

test("an unknown word is a to-do, never invisible", () => {
  expect(statusCategory("something_new")).toBe("to_do");
  expect(statusCategory(null)).toBe("to_do");
});

test("a category key is camelCase for the locale", () => {
  expect(categoryKey("to_do")).toBe("toDo");
  expect(categoryKey("in_progress")).toBe("inProgress");
});

test("a deliverable's settable words exclude every review outcome", () => {
  expect(DELIVERABLE_PROGRESS_WORDS).toEqual(["not_started", "in_progress", "blocked"]);
  for (const word of DELIVERABLE_REVIEW_WORDS) {
    expect(DELIVERABLE_PROGRESS_WORDS).not.toContain(word);
  }
});

test("each settable word maps to the value the column stores", () => {
  expect(DELIVERABLE_STATUS_BY_WORD).toEqual({
    not_started: "pending",
    in_progress: "in_progress",
    blocked: "blocked",
  });
});

test("a blocked deliverable reads back as blocked, not as not started", () => {
  expect(deliverableStatusWord({ status: "blocked" }).id).toBe("blocked");
});

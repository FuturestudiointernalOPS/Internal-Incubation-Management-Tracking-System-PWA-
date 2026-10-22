/**
 * The prose of the Venture Project screen, declared ONCE.
 *
 * The screen translates these paths at render time, and the background warm-up
 * translates the very same ones ahead of time. Two lists would drift: a field
 * added to the screen and not to the warm-up would silently stay in its source
 * language until someone happened to look at that page from another language.
 *
 * Pure data, no imports: usable from a client component and from a server
 * service alike.
 *
 * NOT here on purpose: people's names, references, statuses, dates. None of them
 * is prose, and sending a person's name to a translation engine would be a
 * privacy mistake rather than a translation.
 */
export const WORK_ITEM_TEXT_PATHS = [
  "items[].title",
  "items[].activity",
  "items[].deliverable",
  "items[].definition_of_done",
  "items[].journey.name",
  "items[].milestone.title",
  "items[].parent.title",
  "items[].depends_on[].label",
  "items[].blocks[].label",
  "options.journeys[].name",
  "options.milestones[].title",
];

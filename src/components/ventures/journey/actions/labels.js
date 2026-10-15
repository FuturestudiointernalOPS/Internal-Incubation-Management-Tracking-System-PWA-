/**
 * Presentation helpers
 *
 * Pure: a status becomes a label, a chip class or a dot class, an ISO date
 * becomes a locale date, a textarea grows to its content.
 *
 * Cut out of src/components/ventures/JourneyManagerPanel.js as-is: no state of
 * its own, no reads. The panel keeps every state value and every read, and hands
 * this factory what it reads through `values` — plus what the factories above
 * it return. The names it need are listed in the signature — nothing else.
 */

import {
  stageStatusWord,
  milestoneStatusWord,
  statusLabel,
  statusDotClass,
} from "@/lib/ventureStatuses";

export function journeyLabels({
  t,
  lang,
}) {
  const stageNodeClass = (status) => (status === "completed" ? "is-done" : status === "active" ? "is-active" : "");

  const milestoneStatusKey = (status) => statusLabel(milestoneStatusWord(status), t);

  // The kit's tag for a status word: the same tones every surface uses.
  const TAG_TONE = { blocked: "r", in_progress: "b", awaiting_review: "w", changes_requested: "r", completed: "g", approved: "g" };
  const tagClass = (word) => `stf-tag ${TAG_TONE[word?.tone] || ""}`;
  const milestoneStatusClass = (status) => tagClass(milestoneStatusWord(status));

  const milestoneDotClass = (status) => statusDotClass(milestoneStatusWord(status));

  // ONE vocabulary (lib/ventureStatuses): the same words the founder and Super
  // Admin see for the same state. Stage: Upcoming → In Progress → Completed.
  const statusPill = (stage) => {
    const word = stageStatusWord(stage.status);
    return <span className={tagClass(word)}>{statusLabel(word, t)}</span>;
  };

  const fmtDate = (iso) => (iso ? new Date(`${String(iso).slice(0, 10)}T00:00:00`).toLocaleDateString(lang) : "");

  // A textarea that grows with its content (paragraph note, never a scrollbar).
  const autoGrow = (event) => { const element = event.target; element.style.height = "auto"; element.style.height = `${element.scrollHeight}px`; };

  return {
    stageNodeClass,
    milestoneStatusKey,
    milestoneStatusClass,
    milestoneDotClass,
    statusPill,
    fmtDate,
    autoGrow,
  };
}

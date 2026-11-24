"use client";

/** A raw status → localized label, falling back to a status.* / participant.*
 *  key and finally to the raw value. Shared by the badge and the details tab. */
export function translateStatus(raw, t) {
  const statusKey = `status.${raw}`;
  let label = t(statusKey);
  if (label === statusKey) {
    const participantKey = `participant.${raw}`;
    label = t(participantKey);
    if (label === participantKey) label = raw.replace(/_/g, " ");
  }
  return label;
}

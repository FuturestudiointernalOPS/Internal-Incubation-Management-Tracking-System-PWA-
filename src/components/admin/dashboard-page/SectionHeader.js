"use client";

import SectionHead from "@/components/ui/SectionHead";

const TONE = { A: "o", B: "b", C: "g", D: "o", E: "b" };

/** The banner of a lettered dashboard section (the shared section heading). */
export default function SectionHeader({ number, title, subtitle, icon, action }) {
  return <SectionHead letter={number} tone={TONE[number] || "o"} icon={icon} title={title} subtitle={subtitle} action={action} />;
}

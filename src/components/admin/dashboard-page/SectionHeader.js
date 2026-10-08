"use client";

const TONE = { A: "o", B: "b", C: "g", D: "o", E: "b" };

/**
 * The banner of a dashboard section: its letter, its icon, its title and
 * subtitle, and an optional action.
 */
export default function SectionHeader({ number, title, subtitle, icon: Icon, action }) {
  return (
    <div className="stf-sech">
      <div>
        <span className={`ltr ${TONE[number] || "o"}`}>{number}</span>
        <div>
          <h4>
            {Icon && <Icon size={15} />}
            {title}
          </h4>
          {subtitle && <div className="stf-k">{subtitle}</div>}
        </div>
      </div>
      {action}
    </div>
  );
}

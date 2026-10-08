"use client";

/** The heading of a lettered page section: letter, icon, title, subtitle and an action. */
export default function SectionHead({ letter, tone = "o", icon: Icon, title, subtitle, action }) {
  return (
    <div className="stf-sech">
      <div>
        {letter && <span className={`ltr ${tone}`}>{letter}</span>}
        <div>
          <h4>
            {Icon && <Icon size={15} />}
            {title}
          </h4>
          {subtitle && <div className="stf-k">{subtitle}</div>}
        </div>
      </div>
      {action && action.label ? (
        <button type="button" className="stf-link-btn" onClick={action.onClick}>
          {action.label}
        </button>
      ) : (
        action
      )}
    </div>
  );
}

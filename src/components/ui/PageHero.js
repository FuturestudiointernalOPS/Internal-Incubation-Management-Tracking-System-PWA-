"use client";

/**
 * The banner every role's home page opens with: a kicker (usually the date), the
 * title, a sentence of context and the page's main action.
 */
export default function PageHero({ kicker, title, subtitle, action }) {
  return (
    <div className="stf-hero">
      <div>
        {kicker && <div className="stf-k">{kicker}</div>}
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

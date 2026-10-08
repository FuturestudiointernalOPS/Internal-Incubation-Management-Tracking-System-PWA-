"use client";

import Link from "next/link";

/** A navigation card: icon and caption on top, one line of explanation, an optional tag. */
export default function LinkCard({ icon: Icon, tone = "", title, text, tag, onClick, href }) {
  const body = (
    <>
      <div className="t">
        {Icon && <Icon size={15} />}
        {title}
      </div>
      <p>{text}</p>
      {tag}
    </>
  );
  if (href) {
    return <Link href={href} className={`stf-lk ${tone}`}>{body}</Link>;
  }
  return <button type="button" className={`stf-lk ${tone}`} onClick={onClick}>{body}</button>;
}

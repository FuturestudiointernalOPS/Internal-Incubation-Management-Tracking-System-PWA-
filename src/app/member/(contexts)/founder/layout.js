/**
 * FOUNDER SURFACE — the founder context's wrapper.
 *
 * The shell is rendered once by the member space layout.
 */
export const dynamic = "force-dynamic";

export default function FounderLayout({ children }) {
  return <div className="w-full">{children}</div>;
}

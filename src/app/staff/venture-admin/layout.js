import { redirect } from "next/navigation";
import { getSession } from "@/server/auth/session";
import { resolveVenturePortfolioAccess } from "@/services/ventures/portfolioAccess";
import { spaceHomeForRole } from "@/spaces/registry";

export const dynamic = "force-dynamic";

/**
 * VENTURE ADMINISTRATION — server-side gate for the dedicated area.
 *
 * The sidebar only paints the door when the portfolio WRITE right is held
 * (`ventures.edit_all`), but a door is not a lock: anyone can type the address.
 * This layout asks the SAME decision the Venture routes ask, so the page and the
 * API can never disagree.
 *
 * Two things make it a real gate:
 *   - the right is read from the effective matrix (a revoked right closes the
 *     area even for the platform owner), and
 *   - the portfolio perimeter is INTERNAL-only (`resolveVenturePortfolioAccess`),
 *     so a member who somehow received the profile is still refused.
 *
 * A refusal sends the person to their own home rather than to a blank screen.
 */
export default async function VentureAdminLayout({ children }) {
  const session = await getSession();
  if (!session) redirect("/login");

  // The area both READS every Venture and lets its holder act on them, so it
  // requires the two perimeter rights the sidebar door also requires. Checking
  // both here keeps the page and the menu from disagreeing about who belongs.
  const [readAccess, writeAccess] = await Promise.all([
    resolveVenturePortfolioAccess({ session, action: "view" }),
    resolveVenturePortfolioAccess({ session, action: "edit" }),
  ]);
  if (!readAccess.allowed || !writeAccess.allowed) {
    redirect(spaceHomeForRole(session.role) || "/member");
  }

  return children;
}

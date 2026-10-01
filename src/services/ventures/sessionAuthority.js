/**
 * services/ventures/sessionAuthority — who may define a Venture's calendar.
 *
 * Moved verbatim out of `src/app/api/ventures/[id]/sessions/route.js` (lane
 * L2). The controller turns a refusal into the HTTP 403 it always sent.
 *
 * Same facades as the controller used, so route-level test mocks still apply.
 * No SQL, no HTTP.
 */
import { hasVentureCapability } from "@/lib/venturePermissions";
import { resolveVentureCode } from "@/lib/ventureOperatingPlans";

/**
 * WHO MAY DEFINE THE CALENDAR.
 *
 * A delegated staff member may create, move or cancel a session only when
 * their RESPONSIBILITY grants `calendar.schedule`: a Coach supports the Venture
 * and attends sessions — they do not schedule them. Requiring a capability
 * every staff member already holds would block nobody, which is why the answer
 * comes from the permission matrix: the one place a responsibility differs.
 *
 * This is the only Venture permission matrix cell enforced anywhere today. It
 * is readable back through GET /api/ventures/[id]/my-access, which reports
 * exactly the cells wired here and no others — wire more, report more.
 *
 * Three deliberate exclusions:
 *   - The Venture's OWN members are untouched. A founder books and manages
 *     their own Venture's sessions; only the staff path is governed here.
 *   - Global authority is read from the gate's verdict (`access.path`), never
 *     re-derived from a role string: two derivations would drift.
 *   - PARTICIPATION is not management. Writing the memo, recording attendance
 *     and raising action items stay open — that is what a Coach is FOR.
 *
 * Returns the 403 body to send, or null to continue.
 */
export async function checkSessionManagement({ ventureParam, access, actor, staffActor }) {
  const id = ventureParam;
  if (!staffActor) return null;
  if (access.path === "super-admin") return null;
  // Assignments store the VNT code; the route may receive the UUID. Zeroing
  // this conversion would deny every delegated manager on a UUID route.
  const ventureCode = await resolveVentureCode(id);
  const canSchedule = await hasVentureCapability({
    ventureId: ventureCode,
    contactId: actor?.cid,
    area: "calendar",
    action: "schedule",
  });
  if (canSchedule) return null;
  return {
    success: false,
    error: "errors.insufficientPermissions",
    missing: { capability: "ventures.calendar.schedule" },
  };
}

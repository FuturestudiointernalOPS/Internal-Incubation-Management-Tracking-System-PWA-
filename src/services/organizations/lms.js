import { hashToken } from "@/lib/token-hashing";
import { withOrganizationLmsRead } from "@/models/organizations/lmsReads";
import { evaluateLmsReadAccess } from "./programAccess";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const refused = (reason, errorKey = "errors.insufficientPermissions") => ({
  success: false,
  reason,
  errorKey,
});

export async function getOrganizationLmsOverview({ session, expectedOrganizationId }) {
  if (!session?.cid || !session?.token) return refused("no-session", "errors.authRequired");
  if (typeof expectedOrganizationId !== "string" || !UUID.test(expectedOrganizationId)) {
    return refused("invalid-query", "errors.invalidRequest");
  }

  return withOrganizationLmsRead(
    { cid: session.cid, token: session.token, tokenHash: hashToken(session.token) },
    async (reader) => {
      const decision = evaluateLmsReadAccess(reader.snapshot);
      if (!decision.allowed) return refused(decision.reason);
      if (decision.scope.organizationId.toLowerCase() !== expectedOrganizationId.toLowerCase()) {
        return refused("context-changed", "errors.organizationContextChanged");
      }

      const catalog = decision.scope.catalog
        ? await reader.listCatalog(decision.scope.organizationId)
        : [];
      const learning = decision.scope.learning
        ? await reader.listOwnLearning(decision.scope.organizationId, session.cid)
        : { enrollments: [], attempts: [], certificates: [] };
      return {
        success: true,
        organizationId: decision.scope.organizationId,
        permissions: { catalog: decision.scope.catalog, learning: decision.scope.learning },
        catalog,
        learning,
      };
    },
  );
}

export async function getOrganizationLmsCourse({
  session,
  expectedOrganizationId,
  courseId,
}) {
  if (!session?.cid || !session?.token) return refused("no-session", "errors.authRequired");
  if (typeof expectedOrganizationId !== "string" || !UUID.test(expectedOrganizationId)
    || typeof courseId !== "string" || !UUID.test(courseId)) {
    return refused("invalid-query", "errors.invalidRequest");
  }

  return withOrganizationLmsRead(
    { cid: session.cid, token: session.token, tokenHash: hashToken(session.token) },
    async (reader) => {
      const decision = evaluateLmsReadAccess(reader.snapshot);
      if (!decision.allowed) return refused(decision.reason);
      if (decision.scope.organizationId.toLowerCase() !== expectedOrganizationId.toLowerCase()) {
        return refused("context-changed", "errors.organizationContextChanged");
      }
      if (!decision.scope.learning) return refused("capability-missing");

      const course = await reader.getEnrolledCourse(
        decision.scope.organizationId,
        session.cid,
        courseId,
      );
      if (!course) return refused("not-found", "errors.insufficientPermissions");

      const lessons = course.sections.flatMap((section) => section.lessons);
      const requiredLessons = lessons.filter((lesson) => lesson.is_required !== false);
      const completedRequired = requiredLessons.filter(
        (lesson) => lesson.progress_status === "completed",
      ).length;
      const completedLessons = lessons.filter(
        (lesson) => lesson.progress_status === "completed",
      ).length;
      const totalRequired = requiredLessons.length;
      const percent = totalRequired
        ? Math.round((completedRequired / totalRequired) * 100)
        : lessons.length && completedLessons === lessons.length ? 100 : 0;

      return {
        success: true,
        organizationId: decision.scope.organizationId,
        ...course,
        progress: {
          percent,
          completedLessons,
          totalLessons: lessons.length,
          completedRequired,
          totalRequired,
        },
      };
    },
  );
}

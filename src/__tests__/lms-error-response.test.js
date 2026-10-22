/**
 * lmsErrorResponse — only an LmsError's i18n key reaches the client; any other
 * error (a failed query, a bug) is answered with the generic key and a 500,
 * never with its raw message.
 */

import { LmsError, lmsErrorResponse } from "@/models/lms/errors";

const read = async (res) => ({ status: res.status, body: await res.json() });

beforeEach(() => jest.spyOn(console, "error").mockImplementation(() => {}));
afterEach(() => console.error.mockRestore());

test("an LmsError keeps its key, status and details", async () => {
  const { status, body } = await read(lmsErrorResponse(new LmsError("lms.errors.notEnrolled", 403)));
  expect(status).toBe(403);
  expect(body).toEqual({ success: false, error: "lms.errors.notEnrolled" });

  const withDetails = await read(lmsErrorResponse(new LmsError("lms.errors.publishValidationFailed", 422, [{ key: "x" }])));
  expect(withDetails.status).toBe(422);
  expect(withDetails.body.details).toEqual([{ key: "x" }]);
});

test("a raw database error is never sent to the client", async () => {
  const dbError = Object.assign(new Error('relation "lms_sections" does not exist'), { code: "42P01" });
  const { status, body } = await read(lmsErrorResponse(dbError));
  expect(status).toBe(500);
  expect(body).toEqual({ success: false, error: "errors.somethingWrong" });
  expect(console.error).toHaveBeenCalled();
});

test("a plain error carrying a status is still treated as unexpected", async () => {
  const { status, body } = await read(lmsErrorResponse(Object.assign(new Error("boom"), { status: 418 })));
  expect(status).toBe(500);
  expect(body.error).toBe("errors.somethingWrong");
});

test("a missing error answers the generic key", async () => {
  const { status, body } = await read(lmsErrorResponse(undefined));
  expect(status).toBe(500);
  expect(body.error).toBe("errors.somethingWrong");
});

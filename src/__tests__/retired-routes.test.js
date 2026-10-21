/**
 * RETIRED ROUTES — the refusal shape, and the evidence that lets them be deleted.
 *
 * A retired path refuses every authenticated identity with the ONE refusal shape
 * and records one structured line per hit. The log is not decoration: it is the
 * only proof, outside the repository, that nobody calls the route any more.
 */

const { retiredRouteResponse } = require("@/server/http/refusal");

describe("retiredRouteResponse", () => {
  let warn;

  beforeEach(() => {
    warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
  });

  test("answers 403 with the shared refusal body and decision header", async () => {
    const response = retiredRouteResponse("segments");

    expect(response.status).toBe(403);
    expect(response.headers.get("X-Authz-Decision")).toBe("retired");
    expect(await response.json()).toEqual({
      success: false,
      error: "errors.featureRetired",
    });
  });

  test("records one line per hit, naming the retired surface", () => {
    retiredRouteResponse("responses/review");

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      "[retired-route] responses/review was called",
    );
  });
});

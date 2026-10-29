import { proxy } from "@/proxy";
const request = (pathname, signedIn = false) => ({ nextUrl: { pathname }, url: `https://impact.test${pathname}`,
  headers: new Headers(), cookies: { get: () => signedIn ? { value: "synthetic-cookie" } : undefined } });
test.each(["/api/org/context", "/api/org/programs", "/api/platform/organizations/client/programs"])("anonymous %s responses are private and translatable before reaching a handler", async (path) => {
  const response = proxy(request(path));
  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({ success: false, error: "errors.authRequired" });
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toContain("Cookie");
});
test("authenticated organisation requests also carry the private boundary headers", () => {
  const response = proxy(request("/api/org/programs", true));
  expect(response.headers.get("x-middleware-next")).toBe("1");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});
test("legacy internal authentication errors retain their response contract", async () => {
  const response = proxy(request("/api/pm/programs"));
  expect(response.status).toBe(401); expect((await response.json()).error).toBe("Authentication required.");
});
test("anonymous programme links redirect to login with the original path", () => {
  const response = proxy(request("/o/alpha/programs/programme"));
  const url = new URL(response.headers.get("location"));
  expect(url.pathname).toBe("/login"); expect(url.searchParams.get("redirect")).toBe("/o/alpha/programs/programme");
});

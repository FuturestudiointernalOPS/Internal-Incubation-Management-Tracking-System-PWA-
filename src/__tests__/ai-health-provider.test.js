/**
 * The bug this guards: the AI health check advertised a provider nothing
 * implemented, and hardcoded both the provider and the model name. A health
 * check that describes a service you stopped using is worse than none, because
 * it still reports "ready". These assertions tie the answer to the code that
 * really serves AI requests, and to the key that really gates them.
 */
process.env.DEEPSEEK_API_KEY = "test-key";

jest.mock("@/lib/auth", () => ({
  getSession: jest.fn(async () => ({ id: 1, role: "super_admin" })),
}));

jest.mock("@/lib/platform/integrations", () => ({
  summarizeSubmission: jest.fn(),
  analyzeSubmission: jest.fn(),
}));

const { GET } = require("@/app/api/platform/ai/route");
const { DEFAULT_MODEL } = require("@/lib/deepseek");

const health = async () => {
  const res = await GET(new Request("http://localhost/api/platform/ai?action=health"));
  return { status: res.status, body: await res.json() };
};

afterEach(() => {
  process.env.DEEPSEEK_API_KEY = "test-key";
});

describe("GET /api/platform/ai?action=health", () => {
  test("names the provider that actually serves AI features", async () => {
    const { status, body } = await health();

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.health.provider).toBe("deepseek");
  });

  test("takes the model name from the adapter, so the two cannot drift", async () => {
    const { body } = await health();

    expect(body.health.model).toBe(DEFAULT_MODEL);
  });

  test("the DeepSeek key is what decides whether it is ready", async () => {
    const ready = await health();
    expect(ready.body.health.configured).toBe(true);
    expect(ready.body.health.status).toBe("ready");

    delete process.env.DEEPSEEK_API_KEY;
    const unready = await health();
    expect(unready.body.health.configured).toBe(false);
    expect(unready.body.health.status).toBe("unconfigured");
  });
});

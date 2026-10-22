/**
 * Data Room upload route — the category is validated BEFORE the bytes are stored.
 *
 * A refused create used to happen only at the second step, after the file had
 * already been written to the private bucket. The route now refuses an invalid
 * category first, so a refused upload cannot leave an orphan object.
 */

jest.mock("@/server/auth/session", () => ({ getSession: jest.fn() }));
jest.mock("@/services/ventures/dataRoom", () => ({ resolveDataRoomViewer: jest.fn() }));
jest.mock("@/lib/storage", () => ({ uploadDataRoomDocument: jest.fn() }));

const { getSession } = require("@/server/auth/session");
const { resolveDataRoomViewer } = require("@/services/ventures/dataRoom");
const { uploadDataRoomDocument } = require("@/lib/storage");
const { POST } = require("@/app/api/ventures/[id]/data-room/upload/route");

const VENTURE = "VNT-1";

function uploadRequest(category) {
  const form = new FormData();
  form.append("file", new File([new Uint8Array([1, 2, 3])], "deck.pdf", { type: "application/pdf" }));
  form.append("category", category);
  return new Request(`http://localhost/api/ventures/${VENTURE}/data-room/upload`, {
    method: "POST",
    body: form,
  });
}

const context = { params: Promise.resolve({ id: VENTURE }) };

beforeEach(() => {
  jest.clearAllMocks();
  getSession.mockResolvedValue({ cid: "USR-FOUNDER", role: "member", name: "Founder" });
  resolveDataRoomViewer.mockResolvedValue({ allowed: true, canManage: true });
  uploadDataRoomDocument.mockResolvedValue({
    success: true,
    path: "data-room/VNT-1/pitch_deck_business_plan/deck.pdf",
    name: "deck.pdf",
    size: 3,
    type: "application/pdf",
    max_file_mb: 10,
  });
});

describe("POST /api/ventures/[id]/data-room/upload", () => {
  test("refuses an unknown category before writing any bytes", async () => {
    const response = await POST(uploadRequest("not_a_category"), context);

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("dataRoom.errors.categoryInvalid");
    expect(uploadDataRoomDocument).not.toHaveBeenCalled();
  });

  test("accepts a Data Room category and returns the private path", async () => {
    const response = await POST(uploadRequest("pitch_deck_business_plan"), context);

    expect(response.status).toBe(200);
    expect((await response.json()).success).toBe(true);
    expect(uploadDataRoomDocument).toHaveBeenCalledWith(
      expect.any(File),
      { ventureId: VENTURE, category: "pitch_deck_business_plan" },
    );
  });
});

/**
 * @jest-environment jsdom
 *
 * SESSION RESOURCES — uploader UI (drag & drop)
 *
 * Component tests for the Program Manager picker in
 * src/components/lms/SessionResourcesSection.js. The network is mocked, so what
 * is asserted is the CONTRACT:
 *   - what the panel sends when a file is dropped (form fields, kind, scope)
 *   - the drop feedback (drag over / drag leave)
 *   - refusals happen client-side too (type, size) — no request is made
 *   - replacing a not-yet-saved upload cleans up the previous object
 *
 * i18n runs without a provider, so `t(key)` returns the key itself: assertions
 * on those keys double as a "this text goes through t()" check.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";

// framer-motion powers AppModal's transitions; the animation layer is irrelevant
// here (and its DOM APIs are not implemented by jsdom), so it is replaced by
// plain passthrough components.
//
// The passthrough components are CACHED per tag: a fresh component type on every
// `motion.x` access would make React unmount/remount the modal on each render,
// leaving stale detached nodes behind for the assertions below.
jest.mock("framer-motion", () => {
  const React = require("react");
  const MOTION_PROPS = [
    "initial",
    "animate",
    "exit",
    "transition",
    "variants",
    "whileHover",
    "whileTap",
    "whileInView",
    "layout",
    "layoutId",
  ];
  const cache = new Map();
  const passthrough = (tag) => {
    if (cache.has(tag)) return cache.get(tag);
    const Component = ({ children, ...props }) => {
      const domProps = { ...props };
      for (const key of MOTION_PROPS) delete domProps[key];
      return React.createElement(tag, domProps, children);
    };
    Component.displayName = `motion.${tag}`;
    cache.set(tag, Component);
    return Component;
  };
  return {
    motion: new Proxy({}, { get: (_target, tag) => passthrough(tag) }),
    AnimatePresence: ({ children }) => children,
  };
});

const SessionResourcesSection = require("@/components/lms/SessionResourcesSection").default;

const PROGRAM = "P-2026-001";
const SESSION = "S-1";
const UPLOAD_URL = "/api/lms/session-resources/upload";
const STORAGE_PATH = "sessions/P-2026-001/S-1/123-handout.pdf";
const PUBLIC_URL = `https://cdn.impactos.test/lms-session-resources/${STORAGE_PATH}`;

const jsonResponse = (body) => Promise.resolve({ ok: true, status: 200, json: async () => body });

let uploads; // responses for POST /upload, consumed in order

function mockNetwork() {
  uploads = [
    {
      success: true,
      url: PUBLIC_URL,
      storage_path: STORAGE_PATH,
      file_name: "handout.pdf",
      file_size: 2048,
      mime_type: "application/pdf",
      kind: "document",
    },
  ];
  const fetchMock = jest.fn((url, options = {}) => {
    if (String(url).includes(UPLOAD_URL)) {
      if (options.method === "DELETE") return jsonResponse({ success: true, removed: true });
      return jsonResponse(uploads.shift() || { success: false, error: "lms.errors.fileUploadFailed" });
    }
    if (String(url).includes("/api/lms/session-resources")) {
      return jsonResponse({ success: true, resources: [] });
    }
    return jsonResponse({ success: true });
  });
  global.fetch = fetchMock;
  return fetchMock;
}

const pdf = (name = "handout.pdf", bytes = 16) =>
  new File([new ArrayBuffer(bytes)], name, { type: "application/pdf" });

/** Render the panel and wait for the initial resource list to settle. */
async function renderPanel() {
  const result = render(
    <SessionResourcesSection programId={PROGRAM} sessionId={SESSION} weekNumber={1} canEdit />,
  );
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  return result;
}

/** Open the modal in "upload a file" mode and return the drop target button. */
function openFilePicker() {
  fireEvent.click(screen.getByText("lms.sessionResources.add"));
  fireEvent.click(screen.getByText("lms.sessionResources.originFile"));
  return screen.getByText("lms.sessionResources.chooseFile").closest("button");
}

const uploadCalls = () =>
  global.fetch.mock.calls.filter(
    ([url, options]) => String(url).includes(UPLOAD_URL) && (!options || options.method !== "DELETE"),
  );

beforeEach(() => {
  mockNetwork();
});

describe("session resource uploader — drag & drop", () => {
  test("dragging over the zone switches it to the drop state, leaving restores it", async () => {
    await renderPanel();
    const zone = openFilePicker();

    fireEvent.dragOver(zone, { dataTransfer: { files: [] } });
    expect(screen.getByText("lms.sessionResources.dropHere")).toBeTruthy();
    expect(screen.getByText("lms.sessionResources.orBrowse")).toBeTruthy();

    fireEvent.dragLeave(zone, { relatedTarget: null });
    expect(screen.getByText("lms.sessionResources.chooseFile")).toBeTruthy();
  });

  test("a dropped file is uploaded with the session scope and the chosen kind", async () => {
    await renderPanel();
    const zone = openFilePicker();

    fireEvent.drop(zone, { dataTransfer: { files: [pdf()] } });

    await waitFor(() => expect(uploadCalls()).toHaveLength(1));
    const [url, options] = uploadCalls()[0];
    expect(url).toBe(UPLOAD_URL);
    expect(options.method).toBe("POST");

    const body = options.body;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get("file")).toBeInstanceOf(File);
    expect(body.get("file").name).toBe("handout.pdf");
    expect(body.get("kind")).toBe("document");
    expect(body.get("program_id")).toBe(PROGRAM);
    expect(body.get("session_id")).toBe(SESSION);
  });

  test("the uploaded file becomes the resource, titled after its filename", async () => {
    await renderPanel();
    fireEvent.drop(openFilePicker(), { dataTransfer: { files: [pdf()] } });

    // The stored object is shown, with its human-readable size…
    expect(await screen.findByText("handout.pdf")).toBeTruthy();
    expect(screen.getByText("2 KB")).toBeTruthy();
    // …and the empty title was filled in from the filename (extension stripped).
    expect(screen.getByDisplayValue("handout")).toBeTruthy();
  });

  test("a dropped video keeps the video kind on the wire", async () => {
    await renderPanel();
    fireEvent.click(screen.getByText("lms.sessionResources.add"));
    fireEvent.click(screen.getByText("lms.sessionResources.originFile"));
    fireEvent.click(screen.getByText("lms.sessionResources.kind.video"));
    const zone = screen.getByText("lms.sessionResources.chooseFile").closest("button");

    uploads = [
      {
        success: true,
        url: PUBLIC_URL,
        storage_path: "sessions/P-2026-001/S-1/123-intro.mp4",
        file_name: "intro.mp4",
        file_size: 4096,
        mime_type: "video/mp4",
        kind: "video",
      },
    ];
    fireEvent.drop(zone, {
      dataTransfer: { files: [new File([new ArrayBuffer(16)], "intro.mp4", { type: "video/mp4" })] },
    });

    await waitFor(() => expect(uploadCalls()).toHaveLength(1));
    expect(uploadCalls()[0][1].body.get("kind")).toBe("video");
    expect(await screen.findByText("intro.mp4")).toBeTruthy();
  });

  test("a dropped file of the wrong type is refused without any request", async () => {
    await renderPanel();
    const zone = openFilePicker();

    fireEvent.drop(zone, {
      dataTransfer: {
        files: [new File([new ArrayBuffer(16)], "payload.exe", { type: "application/x-msdownload" })],
      },
    });

    expect(await screen.findByText("lms.errors.invalidDocumentFile")).toBeTruthy();
    expect(uploadCalls()).toHaveLength(0);
  });

  test("a dropped file over the size ceiling is refused without any request", async () => {
    await renderPanel();
    const zone = openFilePicker();

    fireEvent.drop(zone, {
      dataTransfer: { files: [pdf("huge.pdf", 5 * 1024 * 1024 + 1)] },
    });

    expect(await screen.findByText("lms.errors.fileTooLarge")).toBeTruthy();
    expect(uploadCalls()).toHaveLength(0);
  });

  test("dropping a file onto an existing upload replaces it and drops the orphan", async () => {
    await renderPanel();
    fireEvent.drop(openFilePicker(), { dataTransfer: { files: [pdf()] } });
    await screen.findByText("handout.pdf");

    // Second drop, on the file row this time (same zone, "replace" case).
    uploads = [
      {
        success: true,
        url: PUBLIC_URL,
        storage_path: "sessions/P-2026-001/S-1/456-handout-v2.pdf",
        file_name: "handout-v2.pdf",
        file_size: 2048,
        mime_type: "application/pdf",
        kind: "document",
      },
    ];
    fireEvent.drop(screen.getByText("2 KB").closest("div"), {
      dataTransfer: { files: [pdf("handout-v2.pdf")] },
    });

    await waitFor(() => expect(uploadCalls()).toHaveLength(2));
    expect(await screen.findByText("handout-v2.pdf")).toBeTruthy();

    // The first upload was never saved → its object must not survive the swap.
    const deletes = global.fetch.mock.calls.filter(
      ([url, options]) => String(url).includes(UPLOAD_URL) && options?.method === "DELETE",
    );
    expect(deletes).toHaveLength(1);
    expect(String(deletes[0][0])).toContain(encodeURIComponent(STORAGE_PATH));
  });
});

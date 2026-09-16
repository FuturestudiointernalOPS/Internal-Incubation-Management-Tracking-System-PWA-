/**
 * @jest-environment jsdom
 *
 * SESSION RESOURCES EDITOR — add / edit forms (Phase 8)
 *
 * The editor is the single resource form, used both by the session card panel
 * (which saves every change immediately) and by the session creation form
 * (which buffers the resources until the session exists). These tests drive it
 * in its BUFFERED mode with `inlineForm`: the form must hand the values to its
 * host and never talk to the resources API itself.
 *
 * i18n runs without a provider, so `t(key)` returns the key itself: assertions
 * on those keys double as a "this text goes through t()" check.
 */

import { fireEvent, render, screen } from "@testing-library/react";

const SessionResourcesEditor = require("@/components/lms/SessionResourcesEditor").default;
const { discardUnsavedUploads } = require("@/components/lms/SessionResourcesEditor");

const PROGRAM = "P-2026-001";

const jsonResponse = (body) => Promise.resolve({ ok: true, status: 200, json: async () => body });

/** A host that behaves like the session form: buffered resources, no API. */
function renderEditor({ resources = [], onCreate, onUpdate, onDelete, sessionId = null } = {}) {
  return render(
    <SessionResourcesEditor
      inlineForm
      canEdit
      title="lms.sessionResources.title"
      resources={resources}
      onCreate={onCreate}
      onUpdate={onUpdate}
      onDelete={onDelete}
      programId={PROGRAM}
      sessionId={sessionId}
    />,
  );
}

/** Open the form, fill it and submit — the path a PM walks every time. */
function fillAndSubmit({ title, url, recommended = false, note = "" } = {}) {
  fireEvent.click(screen.getByText("lms.sessionResources.add"));
  if (title) {
    fireEvent.change(screen.getByPlaceholderText("lms.sessionResources.fieldTitlePlaceholder"), {
      target: { value: title },
    });
  }
  if (url) {
    fireEvent.change(screen.getByPlaceholderText("lms.sessionResources.fieldUrlPlaceholder"), {
      target: { value: url },
    });
  }
  if (recommended) {
    fireEvent.click(screen.getByRole("checkbox"));
    if (note) {
      fireEvent.change(screen.getByPlaceholderText("lms.sessionResources.fieldNotePlaceholder"), {
        target: { value: note },
      });
    }
  }
  fireEvent.click(screen.getByText("lms.sessionResources.addResource"));
}

beforeEach(() => {
  global.fetch = jest.fn(() => jsonResponse({ success: true }));
  window.confirm = jest.fn(() => true);
});

describe("session resources editor — add form", () => {
  test("a link resource is handed to the host and never saved by the editor", () => {
    const onCreate = jest.fn();
    renderEditor({ onCreate });

    fillAndSubmit({ title: "Reader", url: "https://example.test/reader.pdf" });

    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "document",
        title: "Reader",
        url: "https://example.test/reader.pdf",
        source: "link",
        storage_path: null,
        is_recommended: false,
        recommendation_note: null,
      }),
    );
    // The editor is a form: persistence belongs to the host.
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("a recommended video keeps its kind, its flag and its note", () => {
    const onCreate = jest.fn();
    renderEditor({ onCreate });

    fireEvent.click(screen.getByText("lms.sessionResources.add"));
    fireEvent.click(screen.getByText("lms.sessionResources.kind.video"));
    fireEvent.change(screen.getByPlaceholderText("lms.sessionResources.fieldTitlePlaceholder"), {
      target: { value: "Founder interview" },
    });
    fireEvent.change(screen.getByPlaceholderText("lms.sessionResources.fieldUrlPlaceholder"), {
      target: { value: "https://youtu.be/dQw4w9WgXcQ" },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.change(screen.getByPlaceholderText("lms.sessionResources.fieldNotePlaceholder"), {
      target: { value: "Watch before the workshop" },
    });
    fireEvent.click(screen.getByText("lms.sessionResources.addResource"));

    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "video",
        title: "Founder interview",
        is_recommended: true,
        recommendation_note: "Watch before the workshop",
      }),
    );
  });

  test("the note is dropped when the resource is not recommended", () => {
    const onCreate = jest.fn();
    renderEditor({ onCreate });

    fireEvent.click(screen.getByText("lms.sessionResources.add"));
    fireEvent.change(screen.getByPlaceholderText("lms.sessionResources.fieldTitlePlaceholder"), {
      target: { value: "Slides" },
    });
    fireEvent.change(screen.getByPlaceholderText("lms.sessionResources.fieldUrlPlaceholder"), {
      target: { value: "https://example.test/slides.pdf" },
    });
    // Mark it recommended, write a note, then change your mind before saving.
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.change(screen.getByPlaceholderText("lms.sessionResources.fieldNotePlaceholder"), {
      target: { value: "Do this first" },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByText("lms.sessionResources.addResource"));

    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({ is_recommended: false, recommendation_note: null }),
    );
  });

  test("a dropped file is uploaded against the host scope and reported on submit", async () => {
    const onCreate = jest.fn();
    global.fetch = jest.fn((url) => {
      if (String(url).includes("/upload")) {
        return jsonResponse({
          success: true,
          url: "https://cdn.test/lms-session-resources/sessions/P/S/handout.pdf",
          storage_path: "sessions/P-2026-001/program/handout.pdf",
          file_name: "handout.pdf",
          file_size: 2048,
          mime_type: "application/pdf",
          kind: "document",
        });
      }
      return jsonResponse({ success: true });
    });
    renderEditor({ onCreate });

    fireEvent.click(screen.getByText("lms.sessionResources.add"));
    fireEvent.click(screen.getByText("lms.sessionResources.originFile"));
    const zone = screen.getByText("lms.sessionResources.chooseFile").closest("button");
    fireEvent.drop(zone, {
      dataTransfer: {
        files: [new File([new ArrayBuffer(16)], "handout.pdf", { type: "application/pdf" })],
      },
    });

    expect(await screen.findByText("handout.pdf")).toBeTruthy();
    const [, options] = global.fetch.mock.calls.find(([url]) => String(url).includes("/upload"));
    expect(options.body.get("program_id")).toBe(PROGRAM);
    // No session yet — the object lands in the program folder until it exists.
    expect(options.body.get("session_id")).toBeNull();

    fireEvent.click(screen.getByText("lms.sessionResources.addResource"));
    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "upload",
        storage_path: "sessions/P-2026-001/program/handout.pdf",
        file_name: "handout.pdf",
        file_size: 2048,
        mime_type: "application/pdf",
        // The filename seeds the title when the PM did not type one.
        title: "handout",
      }),
    );
  });
});

describe("session resources editor — edit and delete", () => {
  const buffered = {
    localId: "pending-1",
    kind: "document",
    source: "link",
    title: "Old title",
    url: "https://example.test/old.pdf",
    description: "",
    is_recommended: false,
    recommendation_note: null,
  };

  test("editing a buffered resource reports it back with its local id", () => {
    const onUpdate = jest.fn();
    renderEditor({ resources: [buffered], onUpdate });

    fireEvent.click(screen.getByTitle("lms.sessionResources.edit"));
    // The edit form knows it is an edit, and carries the local id.
    expect(screen.getByText("lms.sessionResources.saveChanges")).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText("lms.sessionResources.fieldTitlePlaceholder"), {
      target: { value: "New title" },
    });
    fireEvent.click(screen.getByText("lms.sessionResources.saveChanges"));

    expect(onUpdate).toHaveBeenCalledTimes(1);
    const [resource, values] = onUpdate.mock.calls[0];
    expect(resource).toEqual({ id: null, localId: "pending-1" });
    expect(values).toEqual(expect.objectContaining({ title: "New title" }));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("deleting asks for confirmation before reporting the resource", () => {
    const onDelete = jest.fn();
    renderEditor({ resources: [buffered], onDelete });

    fireEvent.click(screen.getByTitle("lms.sessionResources.delete"));
    expect(window.confirm).toHaveBeenCalledWith("lms.sessionResources.confirmDelete");
    expect(onDelete).toHaveBeenCalledWith(buffered);

    window.confirm = jest.fn(() => false);
    fireEvent.click(screen.getByTitle("lms.sessionResources.delete"));
    expect(onDelete).toHaveBeenCalledTimes(1); // refused → nothing reported
  });

  test("an empty list invites the PM to add material", () => {
    renderEditor({});
    expect(screen.getByText("lms.sessionResources.empty")).toBeTruthy();
  });
});

describe("discardUnsavedUploads", () => {
  test("only objects that were never saved are deleted", () => {
    global.fetch = jest.fn(() => jsonResponse({ success: true }));
    discardUnsavedUploads([
      { localId: "pending-1", storage_path: "sessions/P/S/draft.pdf" },
      { id: "r-1", storage_path: "sessions/P/S/saved.pdf" },
      { localId: "pending-2" }, // no upload at all
    ]);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = global.fetch.mock.calls[0];
    expect(options.method).toBe("DELETE");
    expect(String(url)).toContain(encodeURIComponent("sessions/P/S/draft.pdf"));
  });
});

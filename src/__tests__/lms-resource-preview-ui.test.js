/**
 * @jest-environment jsdom
 *
 * LEARNER RESOURCE PREVIEW — component tests
 *
 * Covers what the learner actually gets from a session's material
 * (src/components/lms/SessionResourcesList.js + ResourcePreview.js):
 *   - an uploaded image shows up directly;
 *   - a PDF or a video is only revealed on request — nothing loads by itself;
 *   - external links and non-renderable documents (Office) show a plain link.
 *
 * i18n runs without a provider, so `t(key)` returns the key itself: the
 * assertions below double as a "this text goes through t()" check.
 */

import { fireEvent, render, screen } from "@testing-library/react";

const SessionResourcesList = require("@/components/lms/SessionResourcesList").default;
const ResourcePreview = require("@/components/lms/ResourcePreview").default;

const url = (path) => `https://cdn.impactos.test/lms-session-resources/${path}`;

const uploaded = (overrides = {}) => ({
  id: overrides.id || "r-1",
  source: "upload",
  kind: "document",
  title: "Handout",
  url: url("sessions/P/S/handout.pdf"),
  file_name: "handout.pdf",
  file_size: 2048,
  mime_type: "application/pdf",
  is_recommended: false,
  ...overrides,
});

describe("ResourcePreview — one resource", () => {
  test("an uploaded image is shown straight away, without a toggle", () => {
    const resource = uploaded({
      kind: "document",
      mime_type: "image/png",
      file_name: "sketch.png",
      title: "Sketch",
    });
    const { container } = render(<ResourcePreview resource={resource} />);

    const img = container.querySelector("img");
    expect(img).toBeTruthy();
    expect(img.getAttribute("src")).toBe(resource.url);
    expect(img.getAttribute("alt")).toBe("Sketch");
    expect(img.getAttribute("loading")).toBe("lazy");
    // The image links to the file itself, so it can be opened full size.
    expect(container.querySelector("a").getAttribute("href")).toBe(resource.url);
    // No viewer to open: an image is already visible.
    expect(screen.queryByText("lms.sessionResources.showPreview")).toBeNull();
  });

  test("a PDF is framed only after the learner asks for it", () => {
    const resource = uploaded();
    const { container } = render(<ResourcePreview resource={resource} />);

    // Nothing is loaded up front — a week can hold several files.
    expect(container.querySelector("iframe")).toBeNull();

    fireEvent.click(screen.getByText("lms.sessionResources.showPreview"));
    const frame = container.querySelector("iframe");
    expect(frame).toBeTruthy();
    expect(frame.getAttribute("src")).toBe(resource.url);
    expect(frame.getAttribute("title")).toBe("Handout");

    fireEvent.click(screen.getByText("lms.sessionResources.hidePreview"));
    expect(container.querySelector("iframe")).toBeNull();
  });

  test("a video reveals a player that only preloads metadata", () => {
    const resource = uploaded({
      kind: "video",
      mime_type: "video/mp4",
      file_name: "intro.mp4",
      title: "Intro",
    });
    const { container } = render(<ResourcePreview resource={resource} />);
    expect(container.querySelector("video")).toBeNull();

    fireEvent.click(screen.getByText("lms.sessionResources.showPreview"));
    const video = container.querySelector("video");
    expect(video).toBeTruthy();
    expect(video.getAttribute("src")).toBe(resource.url);
    expect(video.getAttribute("preload")).toBe("metadata");
    expect(video.hasAttribute("controls")).toBe(true);
  });

  test("an external link is never embedded", () => {
    const { container } = render(
      <ResourcePreview
        resource={uploaded({ source: "link", url: "https://example.test/a.pdf", mime_type: "application/pdf" })}
      />,
    );
    // A third-party page may refuse to be framed: a broken embed is worse than
    // the plain link the list already renders.
    expect(container.firstChild).toBeNull();
  });

  test("a document we cannot render inline has no preview", () => {
    const { container } = render(
      <ResourcePreview
        resource={uploaded({
          mime_type: "application/msword",
          file_name: "plan.doc",
          url: url("sessions/P/S/plan.doc"),
        })}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});

describe("SessionResourcesList — a week's material", () => {
  test("recommended material comes first, with its note and file details", () => {
    const recommended = uploaded({
      id: "r-rec",
      title: "Read this first",
      is_recommended: true,
      recommendation_note: "Bring it filled in",
    });
    const other = uploaded({
      id: "r-2",
      title: "Slides",
      mime_type: "application/pdf",
      file_name: "slides.pdf",
      file_size: 4 * 1024 * 1024,
      url: url("sessions/P/S/slides.pdf"),
    });

    render(<SessionResourcesList resources={[other, recommended]} />);

    expect(screen.getByText("lms.sessionResources.recommendationsTitle")).toBeTruthy();
    expect(screen.getByText("lms.sessionResources.learnerTitle")).toBeTruthy();
    expect(screen.getByText("Bring it filled in")).toBeTruthy();
    // Uploaded files are labelled with what they are.
    expect(screen.getByText("handout.pdf")).toBeTruthy();
    expect(screen.getByText("2 KB")).toBeTruthy();
    expect(screen.getByText("4 MB")).toBeTruthy();
    // Both entries are previewable PDFs, each with its own opener.
    expect(screen.getAllByText("lms.sessionResources.showPreview")).toHaveLength(2);
  });

  test("an image inside the list is previewed inline", () => {
    const image = uploaded({ mime_type: "image/jpeg", file_name: "photo.jpg", title: "Photo" });
    const { container } = render(<SessionResourcesList resources={[image]} />);
    expect(container.querySelector("img")).toBeTruthy();
  });

  test("nothing renders for an empty or missing list", () => {
    const empty = render(<SessionResourcesList resources={[]} />);
    expect(empty.container.firstChild).toBeNull();
    const missing = render(<SessionResourcesList />);
    expect(missing.container.firstChild).toBeNull();
  });

  test("a file that could not be signed is announced, not linked", () => {
    // The server signs uploaded files: without a signed link there is nothing to
    // open, and a dead link would be worse than saying so.
    const { container } = render(
      <SessionResourcesList resources={[uploaded({ url: null })]} />,
    );

    expect(container.querySelector("a")).toBeNull();
    expect(screen.getByText("lms.sessionResources.fileUnavailable")).toBeTruthy();
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector("video")).toBeNull();
  });
});

describe("SessionResourcesList — a video the learner can play", () => {
  const youtubeLink = (overrides = {}) => ({
    id: "r-yt",
    source: "link",
    kind: "video",
    title: "Founder interview",
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    is_recommended: false,
    ...overrides,
  });

  test("a YouTube link plays in the page — never a link the learner can copy", () => {
    const { container } = render(<SessionResourcesList resources={[youtubeLink()]} />);

    // A video the learner is meant to watch here must not become a YouTube link
    // just because it was attached to a session rather than to a course.
    expect(container.querySelector("a")).toBeNull();
    // Nothing loads until the learner asks for it.
    expect(container.querySelector("iframe")).toBeNull();

    fireEvent.click(screen.getByTitle("lms.player.playVideo"));

    const frame = container.querySelector("iframe");
    expect(frame.getAttribute("src")).toContain("youtube-nocookie.com/embed/dQw4w9WgXcQ");
    // Looping is what keeps YouTube's end screen (suggestions + copy control) away.
    expect(frame.getAttribute("src")).toContain("loop=1");
    expect(frame.getAttribute("title")).toBe("Founder interview");
  });

  test("a link to anywhere else keeps the plain link", () => {
    const vimeo = youtubeLink({ url: "https://vimeo.com/123456789" });
    const { container } = render(<SessionResourcesList resources={[vimeo]} />);

    // A third-party page may refuse to be framed: a broken embed would be worse
    // than the link the card already renders.
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector("a").getAttribute("href")).toBe(vimeo.url);
  });
});

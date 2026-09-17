/**
 * @jest-environment jsdom
 *
 * THE EMBEDDED VIDEO BOX — component tests
 *
 * The one box every LMS surface plays a video through: the course presentation,
 * the lesson authoring preview, the learner player, and a session resource that
 * links to a YouTube video. What matters is not the looks but the rules that
 * have to stay identical everywhere:
 *   - an invalid reference renders nothing (the caller owns the empty state);
 *   - the video waits behind a poster until it is clicked;
 *   - the embed is cookie-free and LOOPS, so YouTube's end screen — its
 *     suggested videos and its copy-link control — is never reached;
 *   - nothing here links out to YouTube.
 *
 * i18n runs without a provider, so `t(key)` returns the key itself.
 */

import { fireEvent, render, screen } from "@testing-library/react";

const EmbeddedVideo = require("@/components/lms/EmbeddedVideo").default;

const ID = "dQw4w9WgXcQ";

test("an invalid or missing reference renders nothing at all", () => {
  const missing = render(<EmbeddedVideo videoId={null} title="Lesson" playLabel="Play" />);
  expect(missing.container.firstChild).toBeNull();

  const malformed = render(<EmbeddedVideo videoId="short" title="Lesson" playLabel="Play" />);
  expect(malformed.container.firstChild).toBeNull();
});

test("the video waits behind a poster, then plays in the page", () => {
  const { container } = render(
    <EmbeddedVideo videoId={ID} title="Lesson one" playLabel="Play" />,
  );

  // A poster, and nothing loaded from YouTube yet.
  expect(container.querySelector("img").getAttribute("src")).toContain(`/vi/${ID}/`);
  expect(container.querySelector("iframe")).toBeNull();
  expect(container.querySelector("a")).toBeNull();

  fireEvent.click(screen.getByTitle("Play"));

  const frame = container.querySelector("iframe");
  expect(frame.getAttribute("src")).toContain(`https://www.youtube-nocookie.com/embed/${ID}`);
  // Loop, with the same reference in `playlist`: an embed that never ends never
  // shows YouTube's end screen, and therefore never offers to copy the link.
  expect(frame.getAttribute("src")).toContain("loop=1");
  expect(frame.getAttribute("src")).toContain(`playlist=${ID}`);
  expect(frame.getAttribute("title")).toBe("Lesson one");
  expect(container.querySelector("a")).toBeNull();

  // The close control returns to the poster.
  fireEvent.click(screen.getByTitle("common.close"));
  expect(container.querySelector("iframe")).toBeNull();
  expect(container.querySelector("img")).toBeTruthy();
});

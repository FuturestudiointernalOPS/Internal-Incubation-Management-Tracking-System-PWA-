/**
 * LMS YouTube reference handling — pure unit tests.
 * Verifies URL normalization to the canonical 11-char video ID and rejection
 * of invalid inputs (ticket §14 — YouTube URL handling).
 */

const {
  extractYouTubeVideoId,
  isValidYouTubeVideoId,
  buildYouTubeEmbedUrl,
} = require("@/lib/lms/youtube");

describe("extractYouTubeVideoId", () => {
  test("accepts a bare 11-char video ID", () => {
    expect(extractYouTubeVideoId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  test("extracts from watch URLs", () => {
    expect(extractYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    );
    expect(extractYouTubeVideoId("https://youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    );
  });

  test("extracts from watch URLs with extra params", () => {
    expect(
      extractYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s"),
    ).toBe("dQw4w9WgXcQ");
    expect(
      extractYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123&index=2"),
    ).toBe("dQw4w9WgXcQ");
  });

  test("extracts from youtu.be short links", () => {
    expect(extractYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ?t=10")).toBe("dQw4w9WgXcQ");
  });

  test("extracts from embed / shorts / live URLs", () => {
    expect(extractYouTubeVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    );
    expect(extractYouTubeVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    );
    expect(extractYouTubeVideoId("https://www.youtube.com/live/dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    );
  });

  test("trims surrounding whitespace", () => {
    expect(extractYouTubeVideoId("  dQw4w9WgXcQ  ")).toBe("dQw4w9WgXcQ");
  });

  test("returns null for empty / null input", () => {
    expect(extractYouTubeVideoId("")).toBeNull();
    expect(extractYouTubeVideoId(null)).toBeNull();
    expect(extractYouTubeVideoId(undefined)).toBeNull();
    expect(extractYouTubeVideoId("   ")).toBeNull();
  });

  test("rejects non-YouTube URLs", () => {
    expect(extractYouTubeVideoId("https://vimeo.com/123456789")).toBeNull();
    expect(extractYouTubeVideoId("https://example.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(extractYouTubeVideoId("https://www.youtube.com/")).toBeNull();
  });

  test("rejects malformed IDs", () => {
    expect(extractYouTubeVideoId("dQw4w9WgXc")).toBeNull(); // 10 chars
    expect(extractYouTubeVideoId("dQw4w9WgXcQ1")).toBeNull(); // 12 chars
    expect(extractYouTubeVideoId("not a video!")).toBeNull();
    expect(extractYouTubeVideoId("https://www.youtube.com/watch?v=short")).toBeNull();
  });
});

describe("isValidYouTubeVideoId", () => {
  test("accepts valid 11-char IDs", () => {
    expect(isValidYouTubeVideoId("dQw4w9WgXcQ")).toBe(true);
    expect(isValidYouTubeVideoId("aB_-xYz1234")).toBe(true);
  });

  test("rejects invalid values", () => {
    expect(isValidYouTubeVideoId("")).toBe(false);
    expect(isValidYouTubeVideoId("short")).toBe(false);
    expect(isValidYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe(false);
  });
});

describe("buildYouTubeEmbedUrl", () => {
  test("builds a cookie-free embed URL with the default player params", () => {
    expect(buildYouTubeEmbedUrl("dQw4w9WgXcQ")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1&playsinline=1&color=white",
    );
  });

  test("adds autoplay only when requested", () => {
    expect(buildYouTubeEmbedUrl("dQw4w9WgXcQ", { autoplay: true })).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1&playsinline=1&color=white&autoplay=1",
    );
  });

  test("returns null for invalid IDs", () => {
    expect(buildYouTubeEmbedUrl("")).toBeNull();
    expect(buildYouTubeEmbedUrl("short")).toBeNull();
    expect(buildYouTubeEmbedUrl("https://youtu.be/dQw4w9WgXcQ")).toBeNull();
  });
});

import { spaceRedirects } from "./src/spaces/redirects.js";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    // Security headers applied to every response. The CSP is shipped REPORT-ONLY
    // on purpose: the app relies on inline scripts (the theme bootstrap) and
    // third-party frames, so an enforcing policy must be designed with that in
    // mind rather than guessed here. The other headers are safe to enforce.
    const cspReportOnly = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      // Inter and JetBrains Mono come from Google Fonts (globals.css @import): the
      // stylesheet from fonts.googleapis.com, the files from fonts.gstatic.com.
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self' https:",
      "frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy-Report-Only", value: cspReportOnly },
        ],
      },
    ];
  },

  async redirects() {
    return [
      // Every legacy space address → its new home. The list lives in a plain
      // module so it can be tested; SPACE_REDIRECTS_PERMANENT flips the whole
      // set from temporary (307, reversible) to permanent (308, cached).
      ...spaceRedirects(),
      {
        source: "/sa-hq-sp-2026-v1/:path*",
        destination: "/admin",
        permanent: true,
      },
      {
        source: "/sa-hq-sp-2026-v1",
        destination: "/admin",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

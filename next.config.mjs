import withPWAInit from "next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  reloadOnOnline: true,
  cleanupOutdatedCaches: true,
  clientsClaim: true,
  // Runtime caching: JS files use NetworkFirst so we always get the freshest bundle
  runtimeCaching: [
    {
      urlPattern: /\.(?:js)$/i,
      handler: "NetworkFirst",
      options: {
        cacheName: "js-assets",
        expiration: {
          maxEntries: 64,
          maxAgeSeconds: 86400, // 1 day max cache
        },
        networkTimeoutSeconds: 5,
      },
    },
    {
      urlPattern: /\.(?:css|less)$/i,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "style-assets",
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 86400,
        },
      },
    },
    {
      urlPattern: /\/_next\/data\/.+\/.+\.json$/i,
      handler: "NetworkFirst",
      options: {
        cacheName: "next-data",
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 86400,
        },
      },
    },
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
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

export default withPWA(nextConfig);

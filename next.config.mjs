import withPWAInit from 'next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  reloadOnOnline: true
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: '/sa-hq-sp-2026-v1/:path*',
        destination: '/v2/superadmin',
        permanent: true,
      },
      {
        source: '/sa-hq-sp-2026-v1',
        destination: '/v2/superadmin',
        permanent: true,
      }
    ]
  },
  // We disable the PWA in development to prevent "loading till infinity"
};

export default withPWA(nextConfig);

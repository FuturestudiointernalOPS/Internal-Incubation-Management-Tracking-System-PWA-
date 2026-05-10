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
        source: '/admin/programs/:path*',
        destination: '/v2/superadmin/programs/:path*',
        permanent: true,
      },
      {
        source: '/api/pm/programs/:path*',
        destination: '/api/v2/pm/programs/:path*',
        permanent: true,
      },
      {
        source: '/admin/programs',
        destination: '/v2/superadmin/programs',
        permanent: true,
      },
      {
        source: '/api/pm/programs',
        destination: '/api/v2/pm/programs',
        permanent: true,
      }
    ]
  },
  // We disable the PWA in development to prevent "loading till infinity"
};

export default withPWA(nextConfig);

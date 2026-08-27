/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['mssql', 'tedious', 'iconv-lite'],
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  // TODO(seguranca): Resolver warnings de lint e remover ignoreDuringBuilds
  eslint: {
    ignoreDuringBuilds: true,
  },
  // TODO(seguranca): Tratar erros de tipo remanescentes e remover ignoreBuildErrors
  typescript: {
    ignoreBuildErrors: true,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https://*.googleapis.com https://*.gstatic.com; font-src 'self' data:; connect-src 'self' https://*.googleapis.com; frame-ancestors 'none';",
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/respostas-google',
        destination: '/avaliacoes',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

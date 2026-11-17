import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "zftkbolgcnnkkdfzmtix.supabase.co",
      },
      {
        protocol: "https",
        hostname: "pub-dcb2789e802043768fa5c6c649f9c405.r2.dev",
      },
    ],
  },
  async headers() {
    return [
      {
        // Evita caché en rutas HTML y APIs, permitiendo que Next.js cachee assets inmutables (/_next/static) e imágenes
        source: '/((?!_next/static|_next/image|images/|favicon\\.ico|logo-amex\\.jpg).*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      // Retrocompatibilidad total con enlaces antiguos que contenían el prefijo /clientes
      {
        source: '/clientes',
        destination: '/',
      },
      {
        source: '/clientes/:path*',
        destination: '/:path*',
      },
      {
        source: '/api/clientes/:path*',
        destination: '/api/:path*',
      },
    ];
  },
};

export default nextConfig;

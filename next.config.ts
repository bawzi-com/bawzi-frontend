import type { NextConfig } from 'next';

const isProd = process.env.NODE_ENV === 'production';

// CSP apenas em produção — em desenvolvimento pode bloquear HMR, API local, etc.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://accounts.google.com https://apis.google.com https://js.stripe.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://app.bawzi.com https://*.railway.app https://accounts.google.com https://api.stripe.com https://*.stripe.com wss:",
  "frame-src https://accounts.google.com https://js.stripe.com https://hooks.stripe.com https://*.stripe.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join('; ');

const securityHeaders = [
  { key: 'X-Content-Type-Options',  value: 'nosniff' },
  { key: 'X-Frame-Options',         value: 'DENY' },
  { key: 'X-XSS-Protection',        value: '1; mode=block' },
  { key: 'Referrer-Policy',         value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy',      value: 'geolocation=(), microphone=(), camera=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  ...(isProd ? [{ key: 'Content-Security-Policy', value: CSP }] : []),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,

  async headers() {
    return [
      { source: '/(.*)', headers: securityHeaders },
    ];
  },
};

export default nextConfig;

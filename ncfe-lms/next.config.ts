import type { NextConfig } from "next";

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https:",
      "media-src 'self' https: blob:",
      // frame-src: lets the in-app file preview embed S3 signed URLs and the
      // Microsoft Office Online viewer in an <iframe>. Without this it falls
      // back to default-src 'self' and the browser blocks the preview.
      "frame-src 'self' https: blob:",
      "object-src 'self' https: blob:",
      // frame-ancestors / X-Frame-Options still prevent OUR pages being framed
      // by third parties — this only governs what we are allowed to embed.
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  // pdfkit reads its built-in font metrics (data/*.afm) from its own package
  // directory at runtime. Bundling it strands those files — none of the 14 .afm
  // files land in .next — so `new PDFDocument()` throws ENOENT and every
  // assessment PDF export 500s. Keeping it external lets it resolve them from
  // node_modules as it expects.
  serverExternalPackages: ['pdfkit'],

  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;

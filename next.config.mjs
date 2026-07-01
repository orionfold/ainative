// When the operator opts into LAN binding (`--hostname` to a non-loopback host,
// see bin/cli.ts), the CLI sets RELAY_ALLOW_LAN_ORIGINS=true. In dev mode Next
// otherwise blocks cross-origin requests to /_next/* dev assets from the LAN
// client's IP — which silently breaks the whole app over the network (issue
// #13). The client IP is unknowable at config-load time (the bind host is
// 0.0.0.0 = "all interfaces"), and Next's matcher explicitly rejects a bare
// "*"/"**" catch-all, so we allow every RFC1918 private-network range instead.
// This matches the "trusted network" assumption the --hostname warning already
// states, while still blocking public origins. (Prod `next start` has no such
// gate; this only affects the dev-mode npx path.)
const RFC1918_DEV_ORIGINS = [
  "10.*.*.*",
  "192.168.*.*",
  // 172.16.0.0/12 — Next's matcher globs per-octet, so enumerate 16–31.
  ...Array.from({ length: 16 }, (_, i) => `172.${16 + i}.*.*`),
];
const allowLanDevOrigins = process.env.RELAY_ALLOW_LAN_ORIGINS === "true";

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["better-sqlite3", "pdf-parse", "pdfjs-dist"],
  devIndicators: false,
  allowedDevOrigins: allowLanDevOrigins
    ? ["127.0.0.1", ...RFC1918_DEV_ORIGINS]
    : ["127.0.0.1"],
  // The in-app kindle reader was removed; the book lives at ainative.business.
  // Redirect legacy /book links (and any chapter-anchored deep links) there.
  async redirects() {
    return [
      {
        source: "/book/:path*",
        destination: "https://ainative.business/book",
        permanent: true,
      },
      {
        source: "/book",
        destination: "https://ainative.business/book",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

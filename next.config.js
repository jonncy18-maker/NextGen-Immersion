/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Serve the SPA for any non-API, non-asset path (deep links / hard refresh on
  // a non-hash path). The app uses HashRouter, so routing lives in the URL hash
  // and the server only ever needs to return the SPA shell at "/".
  //
  // The negative lookahead below must also exclude the PWA surfaces so they
  // resolve to their real handlers instead of the SPA shell:
  //   - manifest.webmanifest  (app/manifest.js Next metadata route)
  //   - sw.js                 (static hand-rolled service worker in public/)
  //   - icons/                (public/icons/*.png referenced by the manifest)
  async rewrites() {
    return [
      {
        source:
          '/((?!api|_next|favicon.ico|manifest.webmanifest|sw.js|icons/).*)',
        destination: '/',
      },
    ]
  },
}

export default nextConfig

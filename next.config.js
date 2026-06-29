/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Serve the SPA for any non-API, non-asset path (deep links / hard refresh on
  // a non-hash path). The app uses HashRouter, so routing lives in the URL hash
  // and the server only ever needs to return the SPA shell at "/".
  async rewrites() {
    return [
      {
        source: '/((?!api|_next|favicon.ico).*)',
        destination: '/',
      },
    ]
  },
}

export default nextConfig

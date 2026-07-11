// Next.js metadata route — served at /manifest.webmanifest with the correct
// MIME type. See docs/PWA.md for the full PWA groundwork spec.
export default function manifest() {
  return {
    name: 'NGS Immersion',
    short_name: 'Immersion',
    description:
      'Comprehensible input platform for NextGen Scholars — track cumulative listening hours toward level-based milestones.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#162040',
    theme_color: '#162040',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icons/maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}

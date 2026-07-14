import '../src/styles/tokens.css'
import '../src/styles/global.css'
import ServiceWorkerRegistration from '../src/components/pwa/ServiceWorkerRegistration.jsx'

export const metadata = {
  title: 'NGS Immersion',
  // iOS Safari ignores the web app manifest's theme_color/display — these
  // apple-* tags are the iOS equivalent so "Add to Home Screen" behaves like
  // an installed app there too. See docs/PWA.md "Gotchas — iOS install".
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'NGS Immersion',
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#162040',
}

// Sets data-theme on <html> before paint, so the very first frame already
// matches the user's saved preference (or OS preference) instead of flashing
// light and then re-rendering dark. Runs as a blocking inline script in
// <head> — the idiomatic App Router pattern for this since RootLayout itself
// renders on the server and has no access to localStorage/matchMedia.
const themeInitScript = `
(function () {
  try {
    var stored = window.localStorage.getItem('ngsi-theme');
    var theme = stored === 'dark' || stored === 'light'
      ? stored
      : (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
`

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  )
}

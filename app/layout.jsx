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

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  )
}

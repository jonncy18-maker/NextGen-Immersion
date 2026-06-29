import '../src/styles/tokens.css'
import '../src/styles/global.css'

export const metadata = {
  title: 'NGS Immersion',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

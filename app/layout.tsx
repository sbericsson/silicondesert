import type { Metadata } from 'next'
import '@fontsource/inter/index.css'
import '@/app/globals.css'

export const metadata: Metadata = {
  title: 'Silicon Desert Golf League',
  description: 'Commissioner workspace and public league updates for the Silicon Desert Golf League.'
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  )
}

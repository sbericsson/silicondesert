import type { Metadata } from 'next'
import '@fontsource/inter/index.css'
import '@/app/globals.css'

export const metadata: Metadata = {
  title: 'Silicone Desert Golf League',
  description: 'Commissioner workspace for the Silicone Desert Golf League.'
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="bg-surface-base font-sans text-text-primary antialiased">
        {children}
      </body>
    </html>
  )
}

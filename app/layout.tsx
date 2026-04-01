import type { Metadata } from 'next'
import { Barlow, Barlow_Condensed } from 'next/font/google'
import '@/app/globals.css'

const barlow = Barlow({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-barlow',
  display: 'swap',
})

const barlowCondensed = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-barlow-condensed',
  display: 'swap',
})

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
    <html lang="en" className={`${barlow.variable} ${barlowCondensed.variable}`}>
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  )
}

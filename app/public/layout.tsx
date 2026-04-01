import Link from 'next/link'
import { PublicNav } from '@/app/public/public-nav'

export default function PublicLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  const instagramUrl = process.env.NEXT_PUBLIC_INSTAGRAM_URL

  return (
    <div className="min-h-screen bg-surface-base text-text-primary">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-6">
        <header className="overflow-hidden rounded-3xl border border-surface-border bg-surface-elevated px-5 py-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-condensed text-xs font-semibold uppercase tracking-widest text-accent-text">
                Silicon Desert Golf League
              </p>
              <h1 className="font-condensed mt-2 text-2xl font-bold uppercase tracking-wide text-text-primary">League Updates</h1>
              <p className="mt-2 max-w-xl text-sm text-text-secondary">
                Weekly results, standings, schedule, and public league info in one place.
              </p>
            </div>
            <div className="rounded-2xl border border-accent/20 bg-accent-dim px-4 py-3 text-right">
              <p className="font-condensed text-[11px] font-semibold uppercase tracking-widest text-accent-text">
                Public Links
              </p>
              <p className="mt-1 text-sm text-text-secondary">Built for quick Friday-night sharing.</p>
            </div>
          </div>
          <PublicNav />
        </header>

        <main className="flex-1 py-6">{children}</main>

        <footer className="border-t border-surface-border pt-4 text-sm text-text-secondary">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p>Silicon Desert Golf League</p>
            <div className="flex flex-wrap gap-4">
            <a
              href="https://www.silicondesertgolf.org/"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-accent-text"
            >
              Main Website
            </a>
            {instagramUrl ? (
              <a
                href={instagramUrl}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-accent-text"
              >
                Instagram
              </a>
            ) : null}
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}

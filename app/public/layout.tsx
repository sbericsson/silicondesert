import { PublicNav } from '@/app/public/public-nav'

export default function PublicLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  const instagramUrl = process.env.NEXT_PUBLIC_INSTAGRAM_URL

  return (
    <div className="min-h-screen bg-surface-base text-text-primary">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-4">
        <header className="overflow-hidden rounded-2xl border border-surface-border bg-surface-elevated px-4 py-3 shadow-sm">
          <p className="font-condensed text-sm font-semibold uppercase tracking-widest text-accent-text">
            Silicon Desert Golf League
          </p>
          <PublicNav />
        </header>

        <main className="flex-1 py-4">{children}</main>

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

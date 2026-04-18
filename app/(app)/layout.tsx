import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { MobileNav, DesktopSidebar } from '@/app/(app)/app-nav'

export default async function AppLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-surface-base text-text-primary">
      <DesktopSidebar />

      {/* mobile: max-w-5xl centered with bottom nav padding */}
      {/* desktop: offset by sidebar width, full height */}
      <div className="mx-auto min-h-screen max-w-5xl pb-24 xl:ml-[200px] xl:max-w-none xl:pb-0">
        <header className="border-b border-surface-border bg-surface-elevated px-4 py-4 xl:px-6 xl:py-3">
          <p className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted xl:hidden">
            Silicon Desert Golf League
          </p>
          <h1 className="font-condensed mt-1 text-2xl font-bold uppercase tracking-wide text-text-primary xl:mt-0 xl:text-lg">
            Commissioner Workspace
          </h1>
        </header>
        <main>{children}</main>
      </div>

      <MobileNav />
    </div>
  )
}

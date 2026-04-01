import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'

const navItems = [
  { href: '/week', label: 'Week' },
  { href: '/standings', label: 'Standings' },
  { href: '/roster', label: 'Roster' },
  { href: '/history', label: 'History' }
]

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
    <div className="mx-auto min-h-screen max-w-5xl pb-24">
      <header className="border-b border-surface-border bg-surface-elevated px-4 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">
          Silicon Desert Golf League
        </p>
        <h1 className="mt-1 text-xl font-bold text-text-primary">Commissioner Workspace</h1>
      </header>
      <main>{children}</main>
      <nav className="fixed bottom-0 left-0 right-0 border-t border-surface-border bg-surface-sunken/95 backdrop-blur">
        <div className="mx-auto grid max-w-md grid-cols-4">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="px-2 py-3 text-center text-[11px] font-medium text-text-secondary"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  )
}

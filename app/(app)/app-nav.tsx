'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/week', label: 'Week' },
  { href: '/standings', label: 'Standings' },
  { href: '/roster', label: 'Roster' },
  { href: '/history', label: 'History' }
]

export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="xl:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-surface-border bg-surface-sunken/95 backdrop-blur print:hidden">
      <div className="mx-auto grid max-w-md grid-cols-4">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`font-condensed px-2 py-3 text-center text-[11px] font-semibold uppercase tracking-wide ${
                active ? 'text-accent-text' : 'text-text-secondary'
              }`}
            >
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

export function DesktopSidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden xl:flex fixed left-0 top-0 bottom-0 w-[200px] flex-col border-r border-surface-border bg-surface-elevated z-10 print:hidden">
      <div className="border-b border-surface-border px-4 py-4">
        <p className="font-condensed text-[10px] font-semibold uppercase tracking-widest text-text-muted">
          Silicon Desert
        </p>
        <p className="font-condensed mt-0.5 text-sm font-bold uppercase tracking-wide text-text-primary">
          Commissioner
        </p>
      </div>
      <nav className="flex-1 py-2">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`font-condensed flex items-center px-3 py-1.5 text-sm font-semibold uppercase tracking-wide ${
                active
                  ? 'border-l-[3px] border-accent bg-accent-dim text-accent-text'
                  : 'border-l-[3px] border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}

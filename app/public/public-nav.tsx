'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/public/week', label: 'This Week' },
  { href: '/public/standings', label: 'Standings' },
  { href: '/public/schedule', label: 'Schedule' },
  { href: '/public/roster', label: 'Roster' }
]

export function PublicNav() {
  const pathname = usePathname()

  return (
    <nav className="mt-4 flex flex-wrap gap-2">
      {navItems.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href === '/public/week' && pathname.startsWith('/public/weeks/'))

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-full px-3 py-2 text-sm font-medium transition ${
              isActive
                ? 'bg-accent text-white shadow-sm'
                : 'border border-surface-border bg-surface-base text-text-secondary hover:border-accent hover:text-accent-text'
            }`}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

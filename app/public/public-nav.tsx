'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/public/week', label: 'Results' },
  { href: '/public/standings', label: 'Standings' },
  { href: '/public/schedule', label: 'Schedule' },
  { href: '/public/roster', label: 'Roster' }
]

export function PublicNav() {
  const pathname = usePathname()

  return (
    <nav className="mt-2 flex gap-1.5">
      {navItems.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href === '/public/week' && pathname.startsWith('/public/weeks/'))

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 min-h-[44px] rounded-full px-2 py-2 text-center text-sm font-medium transition ${
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

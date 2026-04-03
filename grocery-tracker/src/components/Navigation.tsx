'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/receipts', label: 'Receipts', icon: '🧾' },
  { href: '/pantry', label: 'Pantry', icon: '🥫' },
  { href: '/shopping-list', label: 'Shopping', icon: '🛒' },
]

export default function Navigation() {
  const pathname = usePathname()

  return (
    <>
      {/* Top bar */}
      <header className="bg-blue-700 text-white px-4 py-3 flex items-center justify-between shadow-md">
        <h1 className="font-bold text-lg tracking-tight">Grocery Tracker</h1>
      </header>

      {/* Bottom nav — mobile first */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
        <div className="flex justify-around max-w-2xl mx-auto">
          {links.map(({ href, label, icon }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center py-2 px-3 text-xs gap-0.5 flex-1 transition-colors ${
                  active ? 'text-blue-700 font-semibold' : 'text-gray-500'
                }`}
              >
                <span className="text-xl">{icon}</span>
                {label}
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
